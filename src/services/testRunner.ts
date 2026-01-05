import { TextChatClient } from './textChatClient';
import { OpenRouter } from '@openrouter/sdk';
import { detectRuleBasedIssues, detectLLMIssues } from './issueDetector';
import { waitForAgent, getPoolStats, type PooledAgent } from './agentPool';
import type {
  TestScenario,
  TestResult,
  BotResponse,
  Issue,
  ApiConfig,
  ConversationTurn,
  ToolCall
} from '@/types';
import { generateId } from '@/lib/utils';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
const LLM_MODEL = 'openai/gpt-oss-120b:free';

const openrouter = new OpenRouter({
  apiKey: OPENROUTER_API_KEY,
});

interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GeneratedUserResponse {
  userMessage: string;
  shouldContinue: boolean;
  reasoning: string;
}

// Detect if bot is stuck in a loop (repeating same/similar responses)
function detectBotLoop(conversationHistory: Array<{ speaker: 'user' | 'bot'; text: string }>): {
  isLooping: boolean;
  loopCount: number;
  repeatedMessage: string | null;
} {
  const botMessages = conversationHistory
    .filter(m => m.speaker === 'bot')
    .map(m => m.text.trim().toLowerCase());

  if (botMessages.length < 2) {
    return { isLooping: false, loopCount: 0, repeatedMessage: null };
  }

  // Check last 4 bot messages for repetition
  const recentMessages = botMessages.slice(-4);

  // Exact match detection
  const messageCounts: Record<string, number> = {};
  for (const msg of recentMessages) {
    // Normalize message (remove punctuation, extra spaces)
    const normalized = msg.replace(/[^\w\s\u0B80-\u0BFF\u0900-\u097F]/g, '').trim();
    messageCounts[normalized] = (messageCounts[normalized] || 0) + 1;
  }

  // Find most repeated message
  let maxCount = 0;
  let repeatedMsg: string | null = null;
  for (const [msg, count] of Object.entries(messageCounts)) {
    if (count > maxCount) {
      maxCount = count;
      repeatedMsg = msg;
    }
  }

  // Also check for similar messages (asking same question pattern)
  const questionPatterns = [
    /புது reservation பண்ணனுமா|new reservation/i,
    /எப்படி உதவ முடியும்|how can i help/i,
    /reservation.*(பார்க்க|check|modify|cancel)/i,
  ];

  let patternMatchCount = 0;
  for (const pattern of questionPatterns) {
    const matches = recentMessages.filter(m => pattern.test(m)).length;
    if (matches >= 2) {
      patternMatchCount = matches;
      break;
    }
  }

  const isLooping = maxCount >= 2 || patternMatchCount >= 2;
  return {
    isLooping,
    loopCount: Math.max(maxCount, patternMatchCount),
    repeatedMessage: repeatedMsg,
  };
}

async function generateUserResponse(
  scenario: TestScenario,
  conversationHistory: Array<{ speaker: 'user' | 'bot'; text: string }>,
  botResponse: string,
  turnNumber: number,
  maxTurns: number = 10
): Promise<GeneratedUserResponse> {
  // Check for repeated failure patterns (e.g., "not found" responses)
  const recentBotMessages = conversationHistory
    .filter(m => m.speaker === 'bot')
    .slice(-3)
    .map(m => m.text.toLowerCase());

  const failurePatterns = [
    'not found', 'no reservation', 'cannot find', 'doesn\'t exist',
    'no record', 'unable to locate', 'no booking', 'இல்லை', 'கிடைக்கவில்லை'
  ];

  const consecutiveFailures = recentBotMessages.filter(msg =>
    failurePatterns.some(pattern => msg.includes(pattern))
  ).length;

  // Detect bot loop
  const loopDetection = detectBotLoop(conversationHistory);

  // Get current date for context
  const today = new Date();
  const currentDateStr = today.toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const systemPrompt = `You are simulating a user testing a conversational AI bot. Your goal is to complete the test scenario by having a natural conversation.

TODAY'S DATE: ${currentDateStr}

SCENARIO CONTEXT:
- Name: ${scenario.name}
- Description: ${scenario.description}
- Language: ${scenario.language}
- Expected States to Visit: ${scenario.expectedStates.join(', ')}
- Expected Tool Calls: ${scenario.expectedToolCalls.join(', ')}

IMPORTANT - DATE HANDLING:
- TODAY is ${currentDateStr}. ALWAYS use dates in the PRESENT or FUTURE.
- When making reservations, use dates that are at least 1 day from today (tomorrow or later).
- NEVER use dates from past years (2024 or earlier). The current year is ${today.getFullYear()}.
- Example valid dates: "tomorrow", "next week", "${today.getDate() + 2} ${today.toLocaleDateString('en-IN', { month: 'long' })} ${today.getFullYear()}"

CRITICAL RULES FOR STOPPING:
1. If the bot says something is "not found" or doesn't exist 2+ times, the scenario goal is UNACHIEVABLE - set shouldContinue to FALSE
2. DO NOT keep trying different phone numbers, dates, or IDs if lookups keep failing
3. If the bot clearly cannot help (e.g., no reservations exist to look up), END the conversation politely
4. This bot uses IN-MEMORY storage - there is NO persistent database. If you're trying to look up/modify/cancel a reservation that wasn't created in THIS conversation, it will ALWAYS fail.

${consecutiveFailures >= 2 ? `
**IMPORTANT**: The bot has responded with "not found" or similar ${consecutiveFailures} times. This scenario cannot be completed. You MUST set shouldContinue to FALSE and end gracefully.
` : ''}

${loopDetection.isLooping ? `
**BOT LOOP DETECTED**: The bot is repeating the same question/response ${loopDetection.loopCount} times.
This indicates the bot doesn't understand your previous response.

REQUIRED ACTIONS:
1. DO NOT give vague responses like "சரி, நன்றி" (Ok, thanks) or just "ok"
2. Provide a CLEAR, SPECIFIC answer to the bot's question
3. If the bot asks "Do you want new reservation or check existing?", answer with ONE of:
   - "புது reservation வேணும்" (I want a new reservation)
   - "என் booking-ஐ check பண்ணணும்" (I want to check my booking)
   - "cancel பண்ணணும்" (I want to cancel)
4. If you've already given a clear answer and the bot still repeats, set shouldContinue to FALSE and report the loop issue.
` : ''}

WHEN TO END (shouldContinue: false):
- Scenario goal achieved (e.g., reservation confirmed)
- Bot indicates operation is impossible (data not found, repeated failures)
- Conversation naturally concludes (goodbye, thank you, etc.)
- You've tried the same type of action 2+ times without success

CRITICAL - CONSISTENCY RULES:
- NEVER change or correct details you already provided (phone numbers, names, party size, dates, times)
- If you said "25 people", ALWAYS confirm "25 people" - do NOT reduce to a smaller number
- If the bot asks for confirmation, simply CONFIRM what you originally said
- Do NOT introduce new problems, corrections, or changes to your original request
- Your job is to TEST the bot, not to simulate a confused user who changes their mind
- Only provide NEW information if the bot asks for something you haven't provided yet

INSTRUCTIONS:
1. Respond as a user would in ${scenario.language} language
2. Work towards completing the scenario goal
3. If the bot asks questions, provide appropriate answers matching your original request
4. Stay in character as a consistent, clear user (not one who changes their mind)
5. Keep responses concise and natural
6. If the goal is unachievable, thank the bot and end politely
7. When confirming details, use "yes/ஆம்/हाँ" or similar - do NOT restate with different values

CURRENT TURN: ${turnNumber + 1} of max ${maxTurns}

Return ONLY a JSON object:
{
  "userMessage": "Your response in ${scenario.language}",
  "shouldContinue": true/false (MUST be false if goal is unachievable or achieved),
  "reasoning": "Brief explanation of why this response"
}`;

  const messages: ConversationMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  // Add conversation history
  for (const turn of conversationHistory) {
    messages.push({
      role: turn.speaker === 'user' ? 'user' : 'assistant',
      content: turn.text,
    });
  }

  // Add the latest bot response
  messages.push({
    role: 'assistant',
    content: `Bot just said: "${botResponse}"`,
  });

  messages.push({
    role: 'user',
    content: 'Generate the next user message based on the scenario and bot response. Return only valid JSON.',
  });

  try {
    const response = await openrouter.chat.send({
      model: LLM_MODEL,
      messages,
      temperature: 0.7,
      maxTokens: 500,
    });

    const content = response.choices?.[0]?.message?.content;
    let textContent = '';

    if (typeof content === 'string') {
      textContent = content;
    } else if (Array.isArray(content)) {
      textContent = content
        .filter((block): block is { type: 'text'; text: string } =>
          typeof block === 'object' && 'type' in block && block.type === 'text'
        )
        .map(block => block.text)
        .join('');
    }

    // Parse JSON from response
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    // Force stop if we've had too many consecutive failures or bot is looping
    const forceStopFailure = consecutiveFailures >= 2;
    const forceStopLoop = loopDetection.isLooping && loopDetection.loopCount >= 3;
    const forceStop = forceStopFailure || forceStopLoop;

    let reasoningSuffix = '';
    if (forceStopFailure) {
      reasoningSuffix = ` [FORCED STOP: ${consecutiveFailures} consecutive failures detected]`;
    } else if (forceStopLoop) {
      reasoningSuffix = ` [FORCED STOP: Bot loop detected - repeated same response ${loopDetection.loopCount} times]`;
    }

    return {
      userMessage: parsed.userMessage || '',
      shouldContinue: !forceStop && parsed.shouldContinue !== false && turnNumber < maxTurns - 1,
      reasoning: (parsed.reasoning || '') + reasoningSuffix,
    };
  } catch (error) {
    console.error('Failed to generate user response:', error);

    // Force stop on consecutive failures or loops even in fallback
    const forceStopFailure = consecutiveFailures >= 2;
    const forceStopLoop = loopDetection.isLooping && loopDetection.loopCount >= 2;
    const forceStop = forceStopFailure || forceStopLoop;

    // Better fallback responses that provide clear intent
    let fallbackMessage: string;
    if (loopDetection.isLooping) {
      // If looping, provide a clear intent instead of vague acknowledgment
      fallbackMessage = scenario.language === 'Tamil'
        ? 'புது reservation வேணும்'  // I want a new reservation
        : 'I want to make a new reservation';
    } else {
      fallbackMessage = scenario.language === 'Tamil' ? 'சரி, நன்றி' : 'Okay, thank you';
    }

    let reasoning = 'Fallback due to generation error';
    if (forceStopFailure) {
      reasoning += ` [FORCED STOP: ${consecutiveFailures} consecutive failures]`;
    } else if (forceStopLoop) {
      reasoning += ` [FORCED STOP: Bot loop detected]`;
    }

    return {
      userMessage: fallbackMessage,
      shouldContinue: !forceStop && turnNumber < 3,
      reasoning,
    };
  }
}

interface TestRunnerCallbacks {
  onScenarioStart?: (scenario: TestScenario) => void;
  onScenarioComplete?: (result: TestResult) => void;
  onTurnStart?: (turnIndex: number, turn: ConversationTurn) => void;
  onTurnComplete?: (turnIndex: number, response: BotResponse) => void;
  onBotResponse?: (response: BotResponse) => void;
  onUserMessageGenerated?: (message: string, reasoning: string) => void;
  onStateChange?: (state: string) => void;
  onError?: (error: Error, scenario: TestScenario) => void;
}

interface RunScenarioOptions {
  appId: string;
  version?: number;
  timeout?: number;
  delayBetweenTurns?: number;
  maxTurns?: number;
}

export class TestRunner {
  private apiConfig: ApiConfig;
  private client: TextChatClient | null = null;
  private callbacks: TestRunnerCallbacks;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;
  private statesVisited: string[] = [];
  private toolsCalled: ToolCall[] = [];
  private currentResponses: BotResponse[] = [];

  constructor(apiConfig: ApiConfig, callbacks: TestRunnerCallbacks = {}) {
    this.apiConfig = apiConfig;
    this.callbacks = callbacks;
    console.log('[TestRunner] Created with apiConfig:', {
      orgId: apiConfig.orgId,
      hasApiKey: !!apiConfig.apiKey,
    });
  }

  async runScenario(
    scenario: TestScenario,
    options: RunScenarioOptions
  ): Promise<TestResult> {
    const { appId, version, delayBetweenTurns = 1500, maxTurns = 10 } = options;
    const startTime = Date.now();

    console.log('[TestRunner] Starting scenario:', scenario.name);
    console.log('[TestRunner] Options:', { appId, version, maxTurns });

    this.isRunning = true;
    this.shouldStop = false;
    this.statesVisited = [];
    this.toolsCalled = [];
    this.currentResponses = [];

    // Create a fresh REST API client for each test run
    this.client = new TextChatClient(this.apiConfig, {
      onResponse: (text) => {
        console.log('[TestRunner] Bot response:', text.substring(0, 100) + '...');
      },
      onError: (error) => {
        this.callbacks.onError?.(error, scenario);
      },
    });

    this.callbacks.onScenarioStart?.(scenario);

    const issues: Issue[] = [];
    const conversationHistory: Array<{ speaker: 'user' | 'bot'; text: string }> = [];
    let finalStatus: TestResult['status'] = 'passed';
    let turnNumber = 0;

    try {
      console.log('[TestRunner] Starting conversation with bot...');

      // Start conversation and get intro message
      const introResult = await this.client.startConversation(appId, version);

      if (!introResult.success) {
        throw new Error('Failed to start conversation with bot');
      }

      // Create bot response for intro
      const introResponse: BotResponse = {
        turnId: `turn-intro`,
        text: introResult.text,
        state: 'initial',
        toolCalls: [],
        latencyMs: Date.now() - startTime,
      };

      this.currentResponses.push(introResponse);
      this.callbacks.onBotResponse?.(introResponse);
      conversationHistory.push({ speaker: 'bot', text: introResult.text });

      console.log('[TestRunner] Got intro message, starting conversation loop...');

      // Real-time conversation loop
      let shouldContinue = true;
      let latestBotText = introResult.text;

      while (shouldContinue && turnNumber < maxTurns && !this.shouldStop) {
        // Generate contextual user response based on bot's output
        const generated = await generateUserResponse(
          scenario,
          conversationHistory,
          latestBotText,
          turnNumber,
          maxTurns
        );

        this.callbacks.onUserMessageGenerated?.(generated.userMessage, generated.reasoning);

        // Create a turn for tracking
        const turn: ConversationTurn = {
          id: generateId(),
          speaker: 'user',
          text: generated.userMessage,
        };

        this.callbacks.onTurnStart?.(turnNumber, turn);
        conversationHistory.push({ speaker: 'user', text: generated.userMessage });

        // Send the AI-generated user message
        const turnStartTime = Date.now();
        const sendResult = await this.client.sendMessage(appId, generated.userMessage, version);

        if (!sendResult.success) {
          issues.push({
            id: generateId(),
            severity: 'high',
            category: 'response_quality',
            description: 'Failed to get response from bot',
            scenarioId: scenario.id,
            turnNumber,
            expected: 'Bot response',
            actual: 'No response',
          });
          finalStatus = 'failed';
          break;
        }

        // Create bot response
        const botResponse: BotResponse = {
          turnId: `turn-${turnNumber + 1}`,
          text: sendResult.text,
          state: 'unknown',
          toolCalls: [],
          latencyMs: Date.now() - turnStartTime,
        };

        this.currentResponses.push(botResponse);
        this.callbacks.onBotResponse?.(botResponse);
        conversationHistory.push({ speaker: 'bot', text: sendResult.text });
        this.callbacks.onTurnComplete?.(turnNumber, botResponse);

        latestBotText = sendResult.text;

        // Check if we should continue
        shouldContinue = generated.shouldContinue;
        turnNumber++;

        // Delay between turns
        if (shouldContinue && delayBetweenTurns > 0) {
          await this.delay(delayBetweenTurns);
        }
      }

      // Validate expected states (if any were specified)
      if (scenario.expectedStates.length > 0) {
        const missingStates = scenario.expectedStates.filter(
          state => !this.statesVisited.includes(state)
        );

        if (missingStates.length > 0) {
          issues.push({
            id: generateId(),
            severity: 'medium',
            category: 'state_transition_bug',
            description: `Missing expected states: ${missingStates.join(', ')}`,
            scenarioId: scenario.id,
            turnNumber: -1,
            expected: scenario.expectedStates.join(' -> '),
            actual: this.statesVisited.join(' -> ') || 'none tracked',
          });
          // Don't fail for missing states in dynamic mode
        }
      }

      // Validate expected tool calls (if any were specified)
      if (scenario.expectedToolCalls.length > 0) {
        const actualToolNames = this.toolsCalled.map(t => t.name);
        const missingTools = scenario.expectedToolCalls.filter(
          tool => !actualToolNames.includes(tool)
        );

        if (missingTools.length > 0) {
          issues.push({
            id: generateId(),
            severity: 'low',
            category: 'tool_call_error',
            description: `Expected tool calls not observed: ${missingTools.join(', ')}`,
            scenarioId: scenario.id,
            turnNumber: -1,
            expected: scenario.expectedToolCalls.join(', '),
            actual: actualToolNames.join(', ') || 'none observed',
          });
        }
      }

      // Run rule-based issue detection on responses
      const ruleBasedIssues = detectRuleBasedIssues(
        this.currentResponses,
        scenario.id
      );
      issues.push(...ruleBasedIssues);

      // Run LLM-based issue detection for nuanced issues
      try {
        const llmIssues = await detectLLMIssues({
          scenario,
          responses: this.currentResponses,
          conversationHistory,
        });
        issues.push(...llmIssues);
      } catch (llmError) {
        console.warn('[TestRunner] LLM issue detection failed:', llmError);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      issues.push({
        id: generateId(),
        severity: 'critical',
        category: 'response_quality',
        description: `Test execution error: ${errorMessage}`,
        scenarioId: scenario.id,
        turnNumber: -1,
        expected: 'Successful test execution',
        actual: errorMessage,
      });
      finalStatus = 'error';
      this.callbacks.onError?.(error instanceof Error ? error : new Error(errorMessage), scenario);
    } finally {
      // Always cleanup
      if (this.client) {
        this.client.endConversation();
      }
      this.isRunning = false;
    }

    const result: TestResult = {
      id: generateId(),
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: finalStatus,
      responses: [...this.currentResponses],
      durationSeconds: (Date.now() - startTime) / 1000,
      statesVisited: [...this.statesVisited],
      toolsCalled: this.toolsCalled.map(t => t.name),
      issues,
      timestamp: new Date(),
    };

    this.callbacks.onScenarioComplete?.(result);
    return result;
  }

  async runAllScenarios(
    scenarios: TestScenario[],
    options: RunScenarioOptions
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const scenario of scenarios) {
      if (this.shouldStop) break;

      const result = await this.runScenario(scenario, options);
      results.push(result);

      // Small delay between scenarios
      await this.delay(500);
    }

    return results;
  }

  /**
   * Run scenarios in parallel using the agent pool
   * This method leverages multiple agents to run tests concurrently
   */
  async runParallelScenarios(
    scenarios: TestScenario[],
    options: RunScenarioOptions,
    maxConcurrency: number = 3
  ): Promise<TestResult[]> {
    const poolStats = getPoolStats('user_simulator');
    const availableAgents = poolStats.available;

    // Limit concurrency to available agents
    const effectiveConcurrency = Math.min(maxConcurrency, availableAgents, scenarios.length);

    console.log(`[TestRunner] Running ${scenarios.length} scenarios with concurrency ${effectiveConcurrency}`);
    console.log(`[TestRunner] Pool stats:`, poolStats);

    if (effectiveConcurrency === 0) {
      console.warn('[TestRunner] No agents available, falling back to sequential execution');
      return this.runAllScenarios(scenarios, options);
    }

    const results: TestResult[] = [];
    const pending = [...scenarios];

    // Process scenarios in batches
    while (pending.length > 0 && !this.shouldStop) {
      const batch = pending.splice(0, effectiveConcurrency);

      const batchPromises = batch.map(async (scenario) => {
        // Acquire an agent from the pool
        const agentHandle = await waitForAgent('user_simulator', 30000);

        if (!agentHandle) {
          console.error(`[TestRunner] Failed to acquire agent for scenario: ${scenario.name}`);
          return {
            id: generateId(),
            scenarioId: scenario.id,
            scenarioName: scenario.name,
            status: 'error' as const,
            responses: [],
            durationSeconds: 0,
            statesVisited: [],
            toolsCalled: [],
            issues: [{
              id: generateId(),
              severity: 'critical' as const,
              category: 'response_quality' as const,
              description: 'Failed to acquire agent from pool - all agents busy',
              scenarioId: scenario.id,
              turnNumber: -1,
              expected: 'Available agent',
              actual: 'No agents available',
            }],
            timestamp: new Date(),
          };
        }

        try {
          console.log(`[TestRunner] Running scenario "${scenario.name}" with agent: ${agentHandle.agent.name}`);
          const result = await this.runScenario(scenario, options);
          return result;
        } catch (error) {
          agentHandle.reportError();
          throw error;
        } finally {
          agentHandle.release();
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error('[TestRunner] Scenario failed:', result.reason);
        }
      }

      // Small delay between batches
      if (pending.length > 0) {
        await this.delay(500);
      }
    }

    return results;
  }

  stop(): void {
    this.shouldStop = true;
  }

  isActive(): boolean {
    return this.isRunning;
  }

  private async waitForResponse(timeout: number): Promise<boolean> {
    const startCount = this.currentResponses.length;
    return this.waitForNewResponse(startCount, timeout);
  }

  private async waitForNewResponse(
    previousCount: number,
    timeout: number
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.currentResponses.length > previousCount) {
        return true;
      }
      await this.delay(100);
    }

    return false;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance management
let runnerInstance: TestRunner | null = null;

export function getTestRunner(
  apiConfig: ApiConfig,
  callbacks: TestRunnerCallbacks = {}
): TestRunner {
  if (!runnerInstance) {
    runnerInstance = new TestRunner(apiConfig, callbacks);
  }
  return runnerInstance;
}

export function createTestRunner(
  apiConfig: ApiConfig,
  callbacks: TestRunnerCallbacks = {}
): TestRunner {
  // Always create a new instance
  runnerInstance = new TestRunner(apiConfig, callbacks);
  return runnerInstance;
}

export function resetTestRunner(): void {
  runnerInstance = null;
}
