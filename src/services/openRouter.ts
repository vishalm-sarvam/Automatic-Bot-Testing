import { OpenRouter } from '@openrouter/sdk';
import type { BotConfiguration, BotState, TestScenario, ConversationTurn } from '@/types';
import { generateId } from '@/lib/utils';
import { fetchToolFile, type ToolFile } from './sarvamLogAnalyzer';

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

// Free model on OpenRouter
const MODEL = 'openai/gpt-oss-120b:free';

// Cache for tool files by app ID
const toolFileCache: Map<string, ToolFile> = new Map();

// Fetch and cache tool file for an app
export async function getToolFile(
  orgId: string,
  workspaceId: string,
  appId: string,
  version?: number,
  forceRefresh: boolean = false
): Promise<ToolFile | null> {
  const cacheKey = `${appId}-${version || 'latest'}`;

  if (!forceRefresh && toolFileCache.has(cacheKey)) {
    return toolFileCache.get(cacheKey)!;
  }

  try {
    const toolFile = await fetchToolFile(orgId, workspaceId, appId, version);
    toolFileCache.set(cacheKey, toolFile);
    console.log('[OpenRouter] Fetched tool file for', appId, ':', toolFile.tools?.length, 'tools');
    return toolFile;
  } catch (error) {
    console.error('[OpenRouter] Failed to fetch tool file:', error);
    return null;
  }
}

// Clear tool file cache (call when app changes)
export function clearToolFileCache(): void {
  toolFileCache.clear();
}

// Initialize OpenRouter SDK
const openrouter = new OpenRouter({
  apiKey: OPENROUTER_API_KEY,
});

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callOpenRouter(messages: Message[]): Promise<string> {
  const response = await openrouter.chat.send({
    model: MODEL,
    messages,
    temperature: 0.7,
    maxTokens: 2000,
  });

  const content = response.choices?.[0]?.message?.content;

  // Handle different content types
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    // Extract text from content blocks
    return content
      .filter((block): block is { type: 'text'; text: string } =>
        typeof block === 'object' && 'type' in block && block.type === 'text'
      )
      .map(block => block.text)
      .join('');
  }

  return '';
}

export async function generateTestScenarios(
  botConfig: BotConfiguration,
  count: number = 5,
  apiConfig?: { orgId: string; workspaceId: string }
): Promise<TestScenario[]> {
  const states = botConfig.llm_config?.agent_config?.states || {};
  const globalPrompt = botConfig.llm_config?.agent_config?.global_prompt || '';
  const initialState = botConfig.llm_config?.agent_config?.initial_state_name || '';
  const variables = botConfig.llm_config?.agent_config?.agent_variables || {};
  const language = botConfig.language_config?.initial_language_name || 'English';

  // Build state info for the prompt
  const stateInfo = Object.entries(states)
    .map(([name, state]) => {
      const s = state as BotState;
      return `State: ${name}
  - Instructions: ${s.instructions?.slice(0, 500)}...
  - Tools: ${s.tool_names.join(', ')}
  - Next States: ${s.next_states.join(', ')}`;
    })
    .join('\n\n');

  const variableInfo = Object.entries(variables)
    .map(([name, v]) => `${name}: ${v.description || v.type}`)
    .join('\n');

  // Fetch tool file dynamically
  let toolFile: ToolFile | null = null;
  if (apiConfig) {
    toolFile = await getToolFile(
      apiConfig.orgId,
      apiConfig.workspaceId,
      botConfig.app_id,
      botConfig.app_version,
      true // Force refresh to get latest
    );
  }

  // Build tool info from tool file
  let toolInfo = 'No tool file available';
  let recommendedScenarios = '';
  let storageInfo = '';

  if (toolFile && toolFile.tools) {
    toolInfo = toolFile.tools.map(tool => {
      let info = `Tool: ${tool.name}\n  - Description: ${tool.description}`;
      if (tool.required_inputs) {
        info += `\n  - Required inputs: ${tool.required_inputs.join(', ')}`;
      }
      if (tool.optional_inputs) {
        info += `\n  - Optional inputs: ${tool.optional_inputs.join(', ')}`;
      }
      if (tool.inputs) {
        info += `\n  - Inputs: ${tool.inputs.join(', ')}`;
      }
      if (tool.validations) {
        info += `\n  - Validations: ${JSON.stringify(tool.validations)}`;
      }
      if (tool.notes) {
        info += `\n  - Notes: ${tool.notes}`;
      }
      return info;
    }).join('\n\n');

    // Build recommended test scenarios from tool file
    if (toolFile.test_scenarios) {
      recommendedScenarios = Object.entries(toolFile.test_scenarios)
        .map(([name, scenario]) => {
          let info = `${name}: ${scenario.description}\n  - Flow: ${scenario.flow.join(' -> ')}`;
          if (scenario.required_data) {
            info += `\n  - Required data: ${JSON.stringify(scenario.required_data)}`;
          }
          if (scenario.notes) {
            info += `\n  - Notes: ${scenario.notes}`;
          }
          if (scenario.expected) {
            info += `\n  - Expected: ${scenario.expected}`;
          }
          return info;
        }).join('\n\n');
    }

    // Storage info
    if (toolFile.storage_type) {
      storageInfo = `=== CRITICAL: STORAGE INFORMATION ===
Storage Type: ${toolFile.storage_type}
${toolFile.note || ''}

This means:
- You CANNOT look up, modify, or cancel reservations that weren't created in the SAME conversation
- Lookup/modify/cancel scenarios MUST first CREATE a reservation, then operate on it
- Standalone lookup scenarios will ALWAYS fail (use for testing error handling only)
`;
    }
  }

  const systemPrompt = `You are a test scenario generator for a conversational AI bot. Generate realistic test scenarios that a user might have when interacting with this bot.

Bot Context:
${globalPrompt}

Available States:
${stateInfo}

Variables to collect:
${variableInfo}

Initial State: ${initialState}
Language: ${language}

${storageInfo}

=== AVAILABLE TOOLS ===
${toolInfo}

${recommendedScenarios ? `=== RECOMMENDED TEST SCENARIOS ===\n${recommendedScenarios}` : ''}

Generate ${count} diverse test scenarios in JSON format. Each scenario should:
1. Have a clear name and description
2. Include realistic user turns that simulate real conversations
3. Cover different paths through the state graph
4. Include expected states the conversation should traverse
5. Include expected tool calls
6. Test edge cases and error handling
7. RESPECT storage limitations if mentioned above

IMPORTANT: Generate conversations in ${language} language.
IMPORTANT: Use realistic data - real phone numbers (10 digits), valid dates (tomorrow or later), times between 11:00-22:00, party sizes 1-20.

Return ONLY a JSON array with this structure:
[
  {
    "name": "Scenario name",
    "description": "What this tests",
    "language": "${language}",
    "turns": [
      { "speaker": "user", "text": "User message in ${language}" },
      { "speaker": "user", "text": "Next user message" }
    ],
    "expectedStates": ["State1", "State2"],
    "expectedToolCalls": ["tool_name"],
    "tags": ["tag1", "tag2"]
  }
]`;

  const response = await callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Generate ${count} test scenarios now. Return only valid JSON.` },
  ]);

  // Parse the JSON response
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const scenarios = JSON.parse(jsonStr.trim());

    return scenarios.map((s: {
      name: string;
      description: string;
      language: string;
      turns: Array<{ speaker: string; text: string; expectedIntent?: string }>;
      expectedStates: string[];
      expectedVariables?: Record<string, string>;
      expectedToolCalls: string[];
      tags: string[];
    }) => ({
      id: generateId(),
      name: s.name,
      description: s.description,
      language: s.language || language,
      turns: s.turns.map((t) => ({
        id: generateId(),
        speaker: t.speaker as 'user' | 'bot',
        text: t.text,
        expectedIntent: t.expectedIntent,
      })),
      expectedStates: s.expectedStates || [],
      expectedVariables: s.expectedVariables || {},
      expectedToolCalls: s.expectedToolCalls || [],
      tags: [...(s.tags || []), 'ai-generated'],
      status: 'pending' as const,
    }));
  } catch (e) {
    console.error('Failed to parse scenarios:', response);
    throw new Error('Failed to parse generated scenarios');
  }
}

export async function generateConversationTurns(
  botConfig: BotConfiguration,
  targetState: string,
  startState?: string
): Promise<ConversationTurn[]> {
  const states = botConfig.llm_config?.agent_config?.states || {};
  const initialState = startState || botConfig.llm_config?.agent_config?.initial_state_name || '';
  const language = botConfig.language_config?.initial_language_name || 'English';

  const targetStateConfig = states[targetState] as BotState | undefined;
  if (!targetStateConfig) {
    throw new Error(`State ${targetState} not found`);
  }

  const systemPrompt = `You are generating realistic user messages for testing a conversational AI bot.

Current State: ${initialState}
Target State: ${targetState}

Target State Instructions:
${targetStateConfig.instructions}

Generate user messages in ${language} that would naturally lead from ${initialState} to ${targetState}.

Return ONLY a JSON array of user turns:
[
  { "text": "User message in ${language}", "expectedIntent": "intent" }
]`;

  const response = await callOpenRouter([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Generate the user turns now. Return only valid JSON.' },
  ]);

  try {
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const turns = JSON.parse(jsonStr.trim());
    return turns.map((t: { text: string; expectedIntent?: string }) => ({
      id: generateId(),
      speaker: 'user' as const,
      text: t.text,
      expectedIntent: t.expectedIntent,
    }));
  } catch (e) {
    console.error('Failed to parse turns:', response);
    throw new Error('Failed to parse generated turns');
  }
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(OPENROUTER_API_KEY);
}

// AI-powered insights generator
export interface AIInsight {
  category: 'tool' | 'prompt' | 'flow' | 'performance' | 'language' | 'ux';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  codeChanges?: Array<{
    file: string;
    change: string;
    reason: string;
  }>;
  toolChanges?: Array<{
    tool: string;
    currentBehavior: string;
    suggestedChange: string;
  }>;
  promptChanges?: Array<{
    state: string;
    currentPrompt: string;
    suggestedPrompt: string;
  }>;
}

export interface AIInsightsResult {
  summary: string;
  overallScore: number; // 0-100
  insights: AIInsight[];
  prioritizedActions: string[];
}

export async function generateAIInsights(
  interactions: Array<{
    interactionId: string;
    messages: Array<{ role: 'user' | 'bot'; text: string; state: string }>;
    toolCalls: Array<{ name: string; success: boolean; errorMessage?: string; durationMs: number }>;
    states: string[];
    stateHistory: Record<string, string>;
    issues: Array<{ category: string; severity: string; description: string }>;
    goalAchieved: boolean;
    goalDetails?: string;
    durationMs: number;
  }>,
  botConfig?: BotConfiguration,
  toolFile?: ToolFile | null
): Promise<AIInsightsResult> {
  // Detect bot loops in messages
  const detectLoopInMessages = (messages: Array<{ role: 'user' | 'bot'; text: string }>) => {
    const botMessages = messages.filter(m => m.role === 'bot').map(m => m.text.toLowerCase().trim());
    const messageCounts: Record<string, number> = {};
    for (const msg of botMessages) {
      const normalized = msg.replace(/[^\w\s\u0B80-\u0BFF\u0900-\u097F]/g, '').trim().slice(0, 100);
      messageCounts[normalized] = (messageCounts[normalized] || 0) + 1;
    }
    const repeated = Object.entries(messageCounts).filter(([, count]) => count >= 2);
    return {
      hasLoop: repeated.length > 0,
      repeatedCount: Math.max(...Object.values(messageCounts), 0),
      repeatedMessages: repeated.map(([msg]) => msg.slice(0, 50))
    };
  };

  // Detect vague user responses
  const detectVagueResponses = (messages: Array<{ role: 'user' | 'bot'; text: string }>) => {
    const userMessages = messages.filter(m => m.role === 'user');
    const vaguePatterns = /^(ok|okay|சரி|நன்றி|thanks|thank you|hmm|yes|ஆம்|हाँ)[\s.,!]*$/i;
    const vagueMessages = userMessages.filter(m => vaguePatterns.test(m.text.trim()));
    return {
      vagueCount: vagueMessages.length,
      vagueResponses: vagueMessages.map(m => m.text)
    };
  };

  // Prepare interaction summaries for the AI
  const interactionSummaries = interactions.map(i => {
    const loopAnalysis = detectLoopInMessages(i.messages);
    const vagueAnalysis = detectVagueResponses(i.messages);

    return {
      id: i.interactionId,
      messageCount: i.messages.length,
      conversationFlow: i.messages.map(m => `[${m.role}@${m.state}]: ${m.text.slice(0, 100)}...`).join('\n'),
      toolCalls: i.toolCalls.map(t => ({
        tool: t.name,
        success: t.success,
        error: t.errorMessage,
        latency: `${(t.durationMs / 1000).toFixed(2)}s`
      })),
      stateFlow: Object.values(i.stateHistory).join(' → '),
      issues: i.issues,
      goalAchieved: i.goalAchieved,
      goalDetails: i.goalDetails,
      duration: `${(i.durationMs / 1000).toFixed(1)}s`,
      // Loop analysis
      loopDetected: loopAnalysis.hasLoop,
      loopDetails: loopAnalysis.hasLoop ? {
        timesRepeated: loopAnalysis.repeatedCount,
        repeatedMessages: loopAnalysis.repeatedMessages
      } : null,
      // Vague response analysis
      vagueResponsesDetected: vagueAnalysis.vagueCount,
      vagueResponses: vagueAnalysis.vagueResponses
    };
  });

  // Calculate stats
  const totalInteractions = interactions.length;
  const successfulInteractions = interactions.filter(i => i.goalAchieved).length;
  const totalToolCalls = interactions.flatMap(i => i.toolCalls).length;
  const failedToolCalls = interactions.flatMap(i => i.toolCalls).filter(t => !t.success).length;
  const totalIssues = interactions.flatMap(i => i.issues).length;
  const avgDuration = interactions.reduce((sum, i) => sum + i.durationMs, 0) / totalInteractions / 1000;

  // Loop/repetition stats
  const interactionsWithLoops = interactionSummaries.filter(i => i.loopDetected).length;
  const interactionsWithVagueResponses = interactionSummaries.filter(i => i.vagueResponsesDetected > 0).length;

  // Get tool info
  const toolInfo = toolFile?.tools?.map(t => ({
    name: t.name,
    description: t.description,
    inputs: t.required_inputs || t.inputs || []
  })) || [];

  // Get state info from bot config
  const stateInfo = botConfig?.llm_config?.agent_config?.states
    ? Object.entries(botConfig.llm_config.agent_config.states).map(([name, state]) => ({
        name,
        goal: (state as BotState).goal,
        tools: (state as BotState).tool_names,
        nextStates: (state as BotState).next_states,
        promptSnippet: (state as BotState).instructions?.slice(0, 200)
      }))
    : [];

  const systemPrompt = `You are an expert AI bot testing analyst. Analyze the following bot interaction data and provide actionable insights.

## Bot Configuration
- States: ${stateInfo.map(s => s.name).join(', ')}
- Tools: ${toolInfo.map(t => t.name).join(', ')}
- Global Prompt: ${botConfig?.llm_config?.agent_config?.global_prompt?.slice(0, 500) || 'Not available'}

## Tool Definitions
${toolInfo.map(t => `- ${t.name}: ${t.description} (inputs: ${t.inputs.join(', ')})`).join('\n')}

## State Details
${stateInfo.map(s => `- ${s.name}: Goal="${s.goal}", Tools=[${s.tools.join(',')}], Transitions=[${s.nextStates.join(',')}]`).join('\n')}

## Statistics
- Total Interactions: ${totalInteractions}
- Successful (Goal Achieved): ${successfulInteractions} (${((successfulInteractions/totalInteractions)*100).toFixed(0)}%)
- Total Tool Calls: ${totalToolCalls}
- Failed Tool Calls: ${failedToolCalls} (${totalToolCalls > 0 ? ((failedToolCalls/totalToolCalls)*100).toFixed(0) : 0}%)
- Total Issues: ${totalIssues}
- Average Duration: ${avgDuration.toFixed(1)}s
- **Interactions with Bot Loops**: ${interactionsWithLoops} (${((interactionsWithLoops/totalInteractions)*100).toFixed(0)}%)
- **Interactions with Vague User Responses**: ${interactionsWithVagueResponses}

## Interaction Samples (showing up to 5)
${JSON.stringify(interactionSummaries.slice(0, 5), null, 2)}

## Your Task
Analyze this data and provide:
1. An overall assessment summary
2. A score from 0-100 based on bot performance
3. Specific insights categorized by: tool, prompt, flow, performance, language, ux
4. Prioritized action items
5. CONCRETE code/configuration changes including:
   - Tool implementation changes (what to modify in tool logic)
   - Prompt modifications (exact text to change)
   - State flow adjustments

## CRITICAL: Loop/Repetition Analysis
Pay special attention to:
- **Bot loops**: Is the bot repeating the same question/response multiple times?
- **Vague user response handling**: Does the bot fail when user gives vague responses like "ok", "சரி", "thanks"?
- **State stuck patterns**: Is the bot getting stuck in one state without progressing?
- **Intent misunderstanding**: Is the bot asking for clarification repeatedly without understanding?

If you detect loops or repetition issues:
1. Flag as HIGH/CRITICAL severity
2. Identify the exact state where the loop occurs
3. Suggest specific prompt changes to handle vague responses
4. Recommend adding examples or rephrasing options for the user

Example prompt fix for handling vague responses:
  Current: "Do you want new reservation or check existing?"
  Suggested: "Do you want new reservation or check existing? For example, say 'புது reservation வேணும்' for new booking or 'என் booking பார்க்கணும்' to check existing."

Be SPECIFIC and ACTIONABLE. Don't just say "improve error handling" - say exactly what to change.

Return ONLY valid JSON in this exact format:
{
  "summary": "2-3 sentence overall assessment",
  "overallScore": 75,
  "insights": [
    {
      "category": "tool",
      "severity": "critical",
      "title": "Short title",
      "description": "Detailed description of the issue",
      "recommendation": "What to do about it",
      "toolChanges": [
        {
          "tool": "tool_name",
          "currentBehavior": "What it does now",
          "suggestedChange": "Specific code/logic change"
        }
      ]
    },
    {
      "category": "prompt",
      "severity": "warning",
      "title": "Title",
      "description": "Description",
      "recommendation": "Recommendation",
      "promptChanges": [
        {
          "state": "StateName",
          "currentPrompt": "Current problematic text",
          "suggestedPrompt": "Suggested replacement text"
        }
      ]
    }
  ],
  "prioritizedActions": [
    "1. Most important action",
    "2. Second priority",
    "3. Third priority"
  ]
}`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Analyze the bot interactions and generate insights. Return only valid JSON.' },
    ]);

    // Parse JSON from response
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const result = JSON.parse(jsonStr.trim()) as AIInsightsResult;
    return result;
  } catch (e) {
    console.error('Failed to generate AI insights:', e);
    // Return a fallback result
    return {
      summary: 'Unable to generate AI insights. Please check the API configuration.',
      overallScore: 0,
      insights: [{
        category: 'flow',
        severity: 'warning',
        title: 'Analysis Failed',
        description: 'Could not generate AI-powered insights',
        recommendation: 'Ensure OpenRouter API key is configured and try again'
      }],
      prioritizedActions: ['Configure OpenRouter API key', 'Retry analysis']
    };
  }
}

// Generate insights for a single test result
export async function generateTestResultInsights(
  testResult: {
    scenarioName: string;
    status: 'passed' | 'failed' | 'error';
    responses: Array<{ text: string; state?: string }>;
    transcript?: { messages: Array<{ speaker: string; text: string }> };
    statesVisited: string[];
    toolsCalled: string[];
    issues: Array<{ category: string; severity: string; description: string }>;
    durationSeconds: number;
  },
  scenario: {
    name: string;
    description: string;
    endGoal?: string;
    expectedStates: string[];
    expectedToolCalls: string[];
  },
  botConfig?: BotConfiguration
): Promise<{
  goalAchieved: boolean;
  analysis: string;
  improvements: string[];
  promptSuggestions?: Array<{ state: string; suggestion: string }>;
  toolSuggestions?: Array<{ tool: string; suggestion: string }>;
}> {
  const systemPrompt = `You are a QA analyst for conversational AI bots. Analyze this test result and determine if the end goal was achieved.

## Scenario
- Name: ${scenario.name}
- Description: ${scenario.description}
- End Goal: ${scenario.endGoal || 'Not specified - infer from description'}
- Expected States: ${scenario.expectedStates.join(' → ')}
- Expected Tools: ${scenario.expectedToolCalls.join(', ')}

## Test Result
- Status: ${testResult.status}
- Duration: ${testResult.durationSeconds}s
- States Visited: ${testResult.statesVisited.join(' → ')}
- Tools Called: ${testResult.toolsCalled.join(', ')}
- Issues Found: ${testResult.issues.map(i => `[${i.severity}] ${i.description}`).join('; ')}

## Conversation Transcript
${testResult.transcript?.messages.map(m => `[${m.speaker}]: ${m.text}`).join('\n') || 'No transcript available'}

## Bot Responses
${testResult.responses.map(r => `[${r.state || 'unknown'}]: ${r.text}`).join('\n')}

Analyze whether the end goal was achieved and provide:
1. Was the goal achieved? (true/false with reasoning)
2. What went well or wrong
3. Specific improvements for prompts and tools

Return ONLY valid JSON:
{
  "goalAchieved": true/false,
  "analysis": "Detailed analysis of what happened",
  "improvements": ["Improvement 1", "Improvement 2"],
  "promptSuggestions": [
    {"state": "StateName", "suggestion": "What to change in the prompt"}
  ],
  "toolSuggestions": [
    {"tool": "tool_name", "suggestion": "What to change in the tool"}
  ]
}`;

  try {
    const response = await callOpenRouter([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Analyze this test result. Return only valid JSON.' },
    ]);

    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    return JSON.parse(jsonStr.trim());
  } catch (e) {
    console.error('Failed to analyze test result:', e);
    return {
      goalAchieved: testResult.status === 'passed',
      analysis: 'Unable to generate AI analysis',
      improvements: ['Retry with valid API configuration']
    };
  }
}
