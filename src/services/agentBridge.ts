/**
 * Agent-to-Agent Testing Bridge
 *
 * Enables two Sarvam agents to communicate with each other:
 * - Tester Agent: Simulates a user with specific goals
 * - Bot Agent: The bot being tested
 *
 * This eliminates the need for external LLMs (OpenRouter) for user simulation.
 */

import { TextChatClient } from './textChatClient';
import type { ApiConfig, BotConfiguration, Issue } from '@/types';
import { generateId } from '@/lib/utils';

// Test goal that the tester agent will try to achieve
export interface TestGoal {
  id: string;
  name: string;
  description: string;
  language: string;
  persona: string;  // e.g., "Tamil-speaking office worker"
  goal: string;     // e.g., "Book a table for 5 people tomorrow at 7pm"
  successCriteria: string[];  // Patterns that indicate success
  maxTurns: number;
  tags: string[];
}

// Result of an agent-to-agent test
export interface AgentTestResult {
  id: string;
  goalId: string;
  goalName: string;
  status: 'passed' | 'failed' | 'error';
  goalAchieved: boolean;
  transcript: Array<{
    speaker: 'tester' | 'bot';
    text: string;
    timestamp: number;
  }>;
  turnsUsed: number;
  durationMs: number;
  testerReasoning: string[];  // Why tester made each decision
  issues: Issue[];
  metadata: {
    testerAgentId?: string;
    botAgentId: string;
    language: string;
    persona: string;
  };
}

// Configuration for the tester agent
export interface TesterAgentConfig {
  appId: string;           // App ID of the tester agent on Sarvam
  version?: number;
}

// Bridge callbacks for real-time updates
export interface AgentBridgeCallbacks {
  onTesterMessage?: (message: string, reasoning?: string) => void;
  onBotMessage?: (message: string) => void;
  onGoalEvaluated?: (achieved: boolean, reason: string) => void;
  onError?: (error: Error) => void;
  onComplete?: (result: AgentTestResult) => void;
}

/**
 * Agent-to-Agent Bridge
 *
 * Routes messages between a Tester Agent and a Bot Agent
 */
export class AgentBridge {
  private apiConfig: ApiConfig;
  private testerClient: TextChatClient | null = null;
  private botClient: TextChatClient | null = null;
  private callbacks: AgentBridgeCallbacks;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(apiConfig: ApiConfig, callbacks: AgentBridgeCallbacks = {}) {
    this.apiConfig = apiConfig;
    this.callbacks = callbacks;
  }

  /**
   * Run a test with two agents communicating
   */
  async runTest(
    goal: TestGoal,
    botConfig: BotConfiguration,
    testerConfig: TesterAgentConfig
  ): Promise<AgentTestResult> {
    const startTime = Date.now();
    const transcript: AgentTestResult['transcript'] = [];
    const testerReasoning: string[] = [];
    const issues: Issue[] = [];

    this.isRunning = true;
    this.shouldStop = false;

    try {
      // Initialize bot client
      this.botClient = new TextChatClient(this.apiConfig, {
        onResponse: (text) => {
          console.log('[AgentBridge] Bot response:', text.substring(0, 100));
        },
        onError: (error) => {
          this.callbacks.onError?.(error);
        },
      });

      // Initialize tester client
      this.testerClient = new TextChatClient(this.apiConfig, {
        onResponse: (text) => {
          console.log('[AgentBridge] Tester response:', text.substring(0, 100));
        },
        onError: (error) => {
          this.callbacks.onError?.(error);
        },
      });

      // Start bot conversation and get intro message
      console.log('[AgentBridge] Starting bot conversation...');
      const botIntro = await this.botClient.startConversation(
        botConfig.app_id,
        botConfig.app_version
      );

      if (!botIntro.success) {
        throw new Error('Failed to start bot conversation');
      }

      transcript.push({
        speaker: 'bot',
        text: botIntro.text,
        timestamp: Date.now(),
      });
      this.callbacks.onBotMessage?.(botIntro.text);

      // Start tester agent with goal context
      // The tester agent needs to know the bot's intro and the goal
      console.log('[AgentBridge] Starting tester agent...');
      const testerIntro = await this.testerClient.startConversation(
        testerConfig.appId,
        testerConfig.version
      );

      if (!testerIntro.success) {
        throw new Error('Failed to start tester agent');
      }

      // Send initial context to tester
      // Format: Tell tester about the goal and the bot's intro message
      const contextMessage = this.buildTesterContext(goal, botIntro.text);
      const testerFirstResponse = await this.testerClient.sendMessage(
        testerConfig.appId,
        contextMessage,
        testerConfig.version
      );

      if (!testerFirstResponse.success) {
        throw new Error('Tester agent failed to process context');
      }

      // Parse tester's response (should be their first message to the bot)
      let testerMessage = this.extractTesterMessage(testerFirstResponse.text);
      let testerReasoningText = this.extractTesterReasoning(testerFirstResponse.text);

      transcript.push({
        speaker: 'tester',
        text: testerMessage,
        timestamp: Date.now(),
      });
      testerReasoning.push(testerReasoningText);
      this.callbacks.onTesterMessage?.(testerMessage, testerReasoningText);

      // Conversation loop
      let turnCount = 1;
      let goalAchieved = false;
      let conversationEnded = false;

      while (!conversationEnded && turnCount < goal.maxTurns && !this.shouldStop) {
        // Send tester's message to bot
        const botResponse = await this.botClient.sendMessage(
          botConfig.app_id,
          testerMessage,
          botConfig.app_version
        );

        if (!botResponse.success) {
          issues.push({
            id: generateId(),
            severity: 'high',
            category: 'response_quality',
            description: 'Bot failed to respond',
            scenarioId: goal.id,
            turnNumber: turnCount,
            expected: 'Bot response',
            actual: 'No response',
          });
          break;
        }

        transcript.push({
          speaker: 'bot',
          text: botResponse.text,
          timestamp: Date.now(),
        });
        this.callbacks.onBotMessage?.(botResponse.text);

        // Check if goal might be achieved
        goalAchieved = this.checkGoalAchieved(botResponse.text, goal.successCriteria);

        // Send bot's response to tester and get next action
        const testerEvaluation = await this.testerClient.sendMessage(
          testerConfig.appId,
          `Bot said: "${botResponse.text}"\n\nWhat do you say next? Or if your goal is achieved/impossible, indicate that.`,
          testerConfig.version
        );

        if (!testerEvaluation.success) {
          break;
        }

        // Parse tester's response
        const parsedResponse = this.parseTesterResponse(testerEvaluation.text);

        if (parsedResponse.goalAchieved || parsedResponse.goalImpossible) {
          conversationEnded = true;
          goalAchieved = parsedResponse.goalAchieved;
          this.callbacks.onGoalEvaluated?.(
            parsedResponse.goalAchieved,
            parsedResponse.reason || ''
          );
          testerReasoning.push(parsedResponse.reason || 'Goal evaluation completed');
        } else {
          testerMessage = parsedResponse.nextMessage;
          testerReasoningText = parsedResponse.reasoning || '';

          transcript.push({
            speaker: 'tester',
            text: testerMessage,
            timestamp: Date.now(),
          });
          testerReasoning.push(testerReasoningText);
          this.callbacks.onTesterMessage?.(testerMessage, testerReasoningText);
        }

        turnCount++;

        // Small delay between turns
        await this.delay(500);
      }

      // Analyze conversation for issues
      this.analyzeConversation(transcript, issues, goal.id);

      const result: AgentTestResult = {
        id: generateId(),
        goalId: goal.id,
        goalName: goal.name,
        status: goalAchieved ? 'passed' : 'failed',
        goalAchieved,
        transcript,
        turnsUsed: turnCount,
        durationMs: Date.now() - startTime,
        testerReasoning,
        issues,
        metadata: {
          testerAgentId: testerConfig.appId,
          botAgentId: botConfig.app_id,
          language: goal.language,
          persona: goal.persona,
        },
      };

      this.callbacks.onComplete?.(result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      issues.push({
        id: generateId(),
        severity: 'critical',
        category: 'response_quality',
        description: `Test execution error: ${errorMessage}`,
        scenarioId: goal.id,
        turnNumber: -1,
        expected: 'Successful test execution',
        actual: errorMessage,
      });

      const result: AgentTestResult = {
        id: generateId(),
        goalId: goal.id,
        goalName: goal.name,
        status: 'error',
        goalAchieved: false,
        transcript,
        turnsUsed: transcript.filter(t => t.speaker === 'tester').length,
        durationMs: Date.now() - startTime,
        testerReasoning,
        issues,
        metadata: {
          testerAgentId: testerConfig.appId,
          botAgentId: botConfig.app_id,
          language: goal.language,
          persona: goal.persona,
        },
      };

      this.callbacks.onError?.(error instanceof Error ? error : new Error(errorMessage));
      this.callbacks.onComplete?.(result);
      return result;

    } finally {
      // Cleanup
      this.botClient?.endConversation();
      this.testerClient?.endConversation();
      this.isRunning = false;
    }
  }

  /**
   * Build context message for tester agent
   */
  private buildTesterContext(goal: TestGoal, botIntro: string): string {
    return `
=== YOUR TEST MISSION ===

PERSONA: ${goal.persona}
LANGUAGE: ${goal.language}
GOAL: ${goal.goal}

SUCCESS CRITERIA:
${goal.successCriteria.map(c => `- ${c}`).join('\n')}

MAX TURNS: ${goal.maxTurns}

=== BOT'S INTRO MESSAGE ===
"${botIntro}"

=== INSTRUCTIONS ===
1. Respond naturally as your persona in ${goal.language}
2. Work towards achieving your goal
3. Be conversational, not robotic
4. If your goal is achieved, respond with: [GOAL_ACHIEVED] reason
5. If your goal is impossible, respond with: [GOAL_IMPOSSIBLE] reason
6. Otherwise respond with: [MESSAGE] your response [REASONING] why you said this

Start the conversation now. What do you say to the bot?
`;
  }

  /**
   * Extract the actual message from tester's response
   */
  private extractTesterMessage(response: string): string {
    // Try to extract [MESSAGE] content
    const messageMatch = response.match(/\[MESSAGE\]\s*(.+?)(?:\[REASONING\]|$)/s);
    if (messageMatch) {
      return messageMatch[1].trim();
    }

    // Fallback: use the whole response, cleaning up any markers
    return response
      .replace(/\[GOAL_ACHIEVED\].*$/s, '')
      .replace(/\[GOAL_IMPOSSIBLE\].*$/s, '')
      .replace(/\[REASONING\].*$/s, '')
      .trim();
  }

  /**
   * Extract reasoning from tester's response
   */
  private extractTesterReasoning(response: string): string {
    const reasoningMatch = response.match(/\[REASONING\]\s*(.+?)$/s);
    return reasoningMatch ? reasoningMatch[1].trim() : '';
  }

  /**
   * Parse tester's response to determine next action
   */
  private parseTesterResponse(response: string): {
    goalAchieved: boolean;
    goalImpossible: boolean;
    nextMessage: string;
    reasoning?: string;
    reason?: string;
  } {
    // Check for goal achieved
    if (response.includes('[GOAL_ACHIEVED]')) {
      const reason = response.replace(/.*\[GOAL_ACHIEVED\]\s*/s, '').trim();
      return {
        goalAchieved: true,
        goalImpossible: false,
        nextMessage: '',
        reason,
      };
    }

    // Check for goal impossible
    if (response.includes('[GOAL_IMPOSSIBLE]')) {
      const reason = response.replace(/.*\[GOAL_IMPOSSIBLE\]\s*/s, '').trim();
      return {
        goalAchieved: false,
        goalImpossible: true,
        nextMessage: '',
        reason,
      };
    }

    // Extract message and reasoning
    const message = this.extractTesterMessage(response);
    const reasoning = this.extractTesterReasoning(response);

    return {
      goalAchieved: false,
      goalImpossible: false,
      nextMessage: message,
      reasoning,
    };
  }

  /**
   * Check if goal is achieved based on success criteria patterns
   */
  private checkGoalAchieved(botResponse: string, successCriteria: string[]): boolean {
    const lowerResponse = botResponse.toLowerCase();

    for (const criteria of successCriteria) {
      // Check if criteria is a regex pattern
      if (criteria.startsWith('/') && criteria.endsWith('/')) {
        const pattern = new RegExp(criteria.slice(1, -1), 'i');
        if (pattern.test(botResponse)) {
          return true;
        }
      } else {
        // Simple string match
        if (lowerResponse.includes(criteria.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Analyze conversation for issues
   */
  private analyzeConversation(
    transcript: AgentTestResult['transcript'],
    issues: Issue[],
    goalId: string
  ): void {
    // Check for bot loops
    const botMessages = transcript
      .filter(t => t.speaker === 'bot')
      .map(t => t.text.toLowerCase().trim());

    const messageCounts: Record<string, number> = {};
    for (const msg of botMessages) {
      const normalized = msg.replace(/[^\w\s]/g, '').slice(0, 100);
      messageCounts[normalized] = (messageCounts[normalized] || 0) + 1;
    }

    for (const [msg, count] of Object.entries(messageCounts)) {
      if (count >= 2) {
        issues.push({
          id: generateId(),
          severity: count >= 3 ? 'high' : 'medium',
          category: 'state_transition_bug',
          description: `Bot repeated similar message ${count} times`,
          scenarioId: goalId,
          turnNumber: -1,
          expected: 'Progressive conversation',
          actual: `"${msg.slice(0, 50)}..." repeated ${count}x`,
          suggestedFix: 'Add handling for ambiguous user responses',
        });
        break;
      }
    }

    // Check for very short bot responses
    for (let i = 0; i < transcript.length; i++) {
      const turn = transcript[i];
      if (turn.speaker === 'bot' && turn.text.length < 10) {
        issues.push({
          id: generateId(),
          severity: 'medium',
          category: 'response_quality',
          description: 'Very short bot response',
          scenarioId: goalId,
          turnNumber: i,
          expected: 'Meaningful response',
          actual: turn.text,
        });
      }
    }
  }

  /**
   * Stop the current test
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Check if a test is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Generate test goals from bot configuration
 * This replaces the scenario generator - instead of full scenarios,
 * we generate goals that the tester agent will try to achieve.
 */
export function generateTestGoals(
  botConfig: BotConfiguration,
  count: number = 5
): TestGoal[] {
  const language = botConfig.language_config?.initial_language_name || 'Tamil';
  const states = botConfig.llm_config?.agent_config?.states || {};
  const tools = new Set<string>();

  // Collect all tools from states
  for (const state of Object.values(states)) {
    const s = state as { tool_names?: string[] };
    s.tool_names?.forEach(t => tools.add(t));
  }

  const goals: TestGoal[] = [];

  // Generate goals based on available tools
  if (tools.has('create_reservation') || tools.has('book_table')) {
    goals.push({
      id: generateId(),
      name: 'New Reservation - Happy Path',
      description: 'Successfully book a table with all required details',
      language,
      persona: `${language}-speaking customer wanting to dine out`,
      goal: 'Book a table for 4 people tomorrow at 7:30 PM under the name Ravi',
      successCriteria: [
        'confirm',
        'booked',
        'reservation',
        'உறுதி',
        'முன்பதிவு',
        'successful',
      ],
      maxTurns: 10,
      tags: ['happy_path', 'create'],
    });

    goals.push({
      id: generateId(),
      name: 'Large Party Booking',
      description: 'Test booking for a large group',
      language,
      persona: `${language}-speaking office manager organizing team lunch`,
      goal: 'Book a table for 15 people this Saturday at 1 PM for an office lunch',
      successCriteria: ['confirm', 'booked', '15', 'உறுதி'],
      maxTurns: 12,
      tags: ['edge_case', 'large_party'],
    });
  }

  if (tools.has('check_reservation') || tools.has('lookup_reservation')) {
    goals.push({
      id: generateId(),
      name: 'Check Non-existent Reservation',
      description: 'Test error handling when reservation not found',
      language,
      persona: `${language}-speaking customer who thinks they have a booking`,
      goal: 'Try to check a reservation with phone number 9876543210',
      successCriteria: ['not found', 'no reservation', 'கிடைக்கவில்லை', 'இல்லை'],
      maxTurns: 6,
      tags: ['error_handling', 'lookup'],
    });
  }

  if (tools.has('modify_reservation') || tools.has('update_reservation')) {
    goals.push({
      id: generateId(),
      name: 'Modify Booking Time',
      description: 'Change reservation time after booking',
      language,
      persona: `${language}-speaking customer who needs to reschedule`,
      goal: 'First book a table for 3 people tomorrow at 6 PM, then change it to 8 PM',
      successCriteria: ['updated', 'changed', 'modified', 'மாற்றப்பட்டது'],
      maxTurns: 15,
      tags: ['modify', 'multi_step'],
    });
  }

  if (tools.has('cancel_reservation')) {
    goals.push({
      id: generateId(),
      name: 'Cancel Reservation',
      description: 'Cancel an existing booking',
      language,
      persona: `${language}-speaking customer who needs to cancel`,
      goal: 'First book a table, then cancel it',
      successCriteria: ['cancelled', 'canceled', 'ரத்து'],
      maxTurns: 12,
      tags: ['cancel', 'multi_step'],
    });
  }

  // Add a language edge case
  goals.push({
    id: generateId(),
    name: 'Code-Mixed Language',
    description: 'Test handling of mixed language input',
    language,
    persona: `Bilingual customer mixing ${language} and English`,
    goal: 'Book a table using mixed language - some Tamil, some English words',
    successCriteria: ['confirm', 'booked', 'உறுதி'],
    maxTurns: 10,
    tags: ['language', 'code_mixing'],
  });

  // Add an ambiguous input test
  goals.push({
    id: generateId(),
    name: 'Vague Initial Request',
    description: 'Test how bot handles unclear user intent',
    language,
    persona: `${language}-speaking customer who is unsure what they want`,
    goal: 'Start with vague responses like "ok" and "hmm" before stating clear intent to book',
    successCriteria: ['confirm', 'booked', 'உறுதி'],
    maxTurns: 12,
    tags: ['edge_case', 'ambiguous'],
  });

  return goals.slice(0, count);
}

// Export singleton creator
let bridgeInstance: AgentBridge | null = null;

export function getAgentBridge(
  apiConfig: ApiConfig,
  callbacks: AgentBridgeCallbacks = {}
): AgentBridge {
  if (!bridgeInstance) {
    bridgeInstance = new AgentBridge(apiConfig, callbacks);
  }
  return bridgeInstance;
}

export function createAgentBridge(
  apiConfig: ApiConfig,
  callbacks: AgentBridgeCallbacks = {}
): AgentBridge {
  bridgeInstance = new AgentBridge(apiConfig, callbacks);
  return bridgeInstance;
}

export function resetAgentBridge(): void {
  bridgeInstance = null;
}
