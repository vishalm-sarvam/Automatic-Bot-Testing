/**
 * Sarvam-powered Scenario Generator
 *
 * Uses a Sarvam Agent in single-prompt mode to generate test scenarios.
 * This replaces OpenRouter with Sarvam's own LLM, providing:
 * - Better multilingual support (Tamil, Hindi, etc.)
 * - Native understanding of Sarvam bot patterns
 * - No external API dependencies
 */

import { TextChatClient } from './textChatClient';
import type { ApiConfig, BotConfiguration, TestScenario, ConversationTurn } from '@/types';
import { generateId } from '@/lib/utils';

// Scenario Creator Agent configuration
const SCENARIO_CREATOR_APP_ID = 'Example-Sin-e20a5d32-00fa';
const SCENARIO_CREATOR_VERSION = 1;

export interface ScenarioGeneratorConfig {
  apiConfig: ApiConfig;
  scenarioCreatorAppId?: string;
  scenarioCreatorVersion?: number;
}

/**
 * Generate test scenarios using Sarvam's Scenario Creator Agent
 */
export async function generateScenariosWithSarvam(
  botConfig: BotConfiguration,
  count: number = 5,
  config: ScenarioGeneratorConfig
): Promise<TestScenario[]> {
  const { apiConfig } = config;
  const appId = config.scenarioCreatorAppId || SCENARIO_CREATOR_APP_ID;
  const version = config.scenarioCreatorVersion || SCENARIO_CREATOR_VERSION;

  // Build the prompt for the scenario generator
  const prompt = buildScenarioPrompt(botConfig, count);

  // Create a text chat client to talk to the Scenario Creator Agent
  const client = new TextChatClient(apiConfig, {
    onError: (error) => {
      console.error('[SarvamScenarioGenerator] Error:', error);
    },
  });

  try {
    // Start conversation with Scenario Creator
    console.log('[SarvamScenarioGenerator] Starting conversation with Scenario Creator...');
    const introResponse = await client.startConversation(appId, version);

    if (!introResponse.success) {
      throw new Error('Failed to connect to Scenario Creator Agent');
    }

    // Send the scenario generation prompt
    console.log('[SarvamScenarioGenerator] Sending prompt to generate scenarios...');
    const response = await client.sendMessage(appId, prompt, version);

    if (!response.success || !response.text) {
      throw new Error('Scenario Creator did not respond');
    }

    // Parse the response as JSON
    const scenarios = parseScenarioResponse(response.text, botConfig);

    console.log(`[SarvamScenarioGenerator] Generated ${scenarios.length} scenarios`);
    return scenarios;

  } finally {
    client.endConversation();
  }
}

/**
 * Build the prompt for generating scenarios
 */
function buildScenarioPrompt(botConfig: BotConfiguration, count: number): string {
  const states = botConfig.llm_config?.agent_config?.states || {};
  const globalPrompt = botConfig.llm_config?.agent_config?.global_prompt || '';
  const initialState = botConfig.llm_config?.agent_config?.initial_state_name || '';
  const variables = botConfig.llm_config?.agent_config?.agent_variables || {};
  const language = botConfig.language_config?.initial_language_name || 'Tamil';

  // Build state info
  const stateInfo = Object.entries(states)
    .map(([name, state]) => {
      const s = state as { instructions?: string; tool_names?: string[]; next_states?: string[] };
      return `
State: ${name}
- Tools: ${s.tool_names?.join(', ') || 'none'}
- Next States: ${s.next_states?.join(', ') || 'none'}
- Instructions Summary: ${s.instructions?.slice(0, 300) || 'N/A'}...`;
    })
    .join('\n');

  // Build variable info
  const variableInfo = Object.entries(variables)
    .map(([name, v]) => `- ${name}: ${(v as { description?: string; type?: string }).description || (v as { type?: string }).type || 'unknown'}`)
    .join('\n');

  // Get today's date for realistic scenarios
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return `
You are a test scenario generator. Generate ${count} diverse test scenarios for a ${language} voice bot.

=== BOT INFORMATION ===
App Name: ${botConfig.app_name || 'Unknown Bot'}
Language: ${language}
Initial State: ${initialState}

Global Prompt:
${globalPrompt?.slice(0, 500) || 'Not available'}

Variables to collect:
${variableInfo}

States:
${stateInfo}

=== TODAY'S DATE ===
${today.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
Tomorrow: ${tomorrowStr}

=== GENERATE SCENARIOS ===
Generate ${count} test scenarios with realistic ${language} user messages.

REQUIREMENTS:
1. Use realistic data:
   - Phone numbers: 10 digits starting with 9/8/7 (e.g., 9876543210)
   - Dates: Use tomorrow or next few days in dd/mm/yyyy format
   - Times: Between 11:00 and 22:00
   - Party sizes: 1-20 people
   - Names: Common Indian names

2. Cover different intents:
   - New booking (happy path)
   - Booking with special requests
   - Lookup/View reservation
   - Modify reservation
   - Cancel reservation
   - Edge cases (large party, invalid time, etc.)

3. Write user messages in ${language}:
   - Natural, conversational style
   - Mix of formal and informal speech
   - Include code-mixed responses (${language} + English words)

4. Include success criteria for each scenario

Return ONLY valid JSON array:
[
  {
    "name": "Scenario Name",
    "description": "What this tests",
    "language": "${language}",
    "persona": "Who the user is",
    "goal": "What the user wants to achieve",
    "userMessages": [
      "First user message in ${language}",
      "Second message...",
      "Third message..."
    ],
    "expectedStates": ["State1", "State2"],
    "expectedTools": ["tool_name"],
    "successCriteria": ["pattern1", "pattern2"],
    "tags": ["tag1", "tag2"]
  }
]

Generate the scenarios now. Return ONLY JSON, no explanations.
`;
}

/**
 * Parse the scenario response from the agent
 */
function parseScenarioResponse(response: string, botConfig: BotConfiguration): TestScenario[] {
  const language = botConfig.language_config?.initial_language_name || 'Tamil';

  try {
    // Try to extract JSON from the response
    let jsonStr = response;

    // Handle markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON array
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    const scenarios = JSON.parse(jsonStr.trim());

    if (!Array.isArray(scenarios)) {
      throw new Error('Response is not an array');
    }

    return scenarios.map((s: {
      name: string;
      description: string;
      language?: string;
      persona?: string;
      goal?: string;
      userMessages?: string[];
      turns?: Array<{ speaker: string; text: string }>;
      expectedStates?: string[];
      expectedTools?: string[];
      expectedToolCalls?: string[];
      successCriteria?: string[];
      tags?: string[];
    }) => {
      // Convert userMessages to turns format
      const turns: ConversationTurn[] = [];

      if (s.userMessages && Array.isArray(s.userMessages)) {
        s.userMessages.forEach((msg, idx) => {
          turns.push({
            id: generateId(),
            speaker: 'user',
            text: msg,
          });
        });
      } else if (s.turns && Array.isArray(s.turns)) {
        s.turns.forEach((t) => {
          turns.push({
            id: generateId(),
            speaker: t.speaker as 'user' | 'bot',
            text: t.text,
          });
        });
      }

      return {
        id: generateId(),
        name: s.name || 'Unnamed Scenario',
        description: s.description || '',
        language: s.language || language,
        turns,
        expectedStates: s.expectedStates || [],
        expectedVariables: {},
        expectedToolCalls: s.expectedTools || s.expectedToolCalls || [],
        tags: [...(s.tags || []), 'sarvam-generated'],
        status: 'pending' as const,
        endGoal: s.goal,
        successPatterns: s.successCriteria,
      };
    });

  } catch (error) {
    console.error('[SarvamScenarioGenerator] Failed to parse response:', error);
    console.error('[SarvamScenarioGenerator] Raw response:', response);

    // Return a single fallback scenario
    return [{
      id: generateId(),
      name: 'Fallback: New Reservation',
      description: 'Basic reservation test (fallback due to parse error)',
      language,
      turns: [
        {
          id: generateId(),
          speaker: 'user',
          text: language === 'Tamil'
            ? 'நாளைக்கு 5 பேருக்கு table book பண்ணணும்'
            : 'मुझे कल 5 लोगों के लिए टेबल बुक करना है',
        },
      ],
      expectedStates: ['Greetings', 'Check_Availability'],
      expectedVariables: {},
      expectedToolCalls: ['check_availability_tool', 'create_reservation_tool'],
      tags: ['fallback', 'sarvam-generated'],
      status: 'pending',
      endGoal: 'Book a table for 5 people tomorrow',
      successPatterns: ['confirm', 'booked', 'உறுதி', 'बुक'],
    }];
  }
}

/**
 * Update the Scenario Creator Agent's prompt dynamically
 * This allows customizing the generator for different bot types
 */
export async function updateScenarioCreatorPrompt(
  apiConfig: ApiConfig,
  newPrompt: string
): Promise<boolean> {
  const BEARER_TOKEN = import.meta.env.VITE_SARVAM_BEARER_TOKEN || '';

  try {
    const response = await fetch(
      `/api/sarvam/app-authoring/orgs/${apiConfig.orgId}/workspaces/${apiConfig.workspaceId}/apps/${SCENARIO_CREATOR_APP_ID}?is_prompt_change=true`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app: {
            llm_config: {
              agent_config: {
                states: {
                  start: {
                    name: 'start',
                    instructions: newPrompt,
                    tool_names: [],
                    next_states: [],
                    agent_variables_in_context: [],
                  },
                },
              },
            },
          },
        }),
      }
    );

    return response.ok;
  } catch (error) {
    console.error('[SarvamScenarioGenerator] Failed to update prompt:', error);
    return false;
  }
}

/**
 * Get the recommended prompt for the Scenario Creator Agent
 * This should be set in the Sarvam console
 */
export function getRecommendedScenarioCreatorPrompt(): string {
  return `You are an expert test scenario generator for conversational AI bots.

When given a bot configuration, you generate realistic test scenarios in JSON format.

YOUR ROLE:
- Analyze the bot's states, tools, and variables
- Generate diverse test scenarios covering happy paths and edge cases
- Write user messages in the specified language (Tamil, Hindi, etc.)
- Create realistic personas and goals

OUTPUT FORMAT:
Always return a valid JSON array of scenarios. Each scenario must have:
- name: Short descriptive name
- description: What this scenario tests
- language: The language for user messages
- persona: Who the simulated user is
- goal: What the user wants to achieve
- userMessages: Array of user message strings
- expectedStates: States the conversation should visit
- expectedTools: Tools that should be called
- successCriteria: Patterns indicating goal achievement
- tags: Categories for the scenario

RULES:
1. Use realistic Indian data (names, phone numbers, dates)
2. Write natural conversational messages, not robotic scripts
3. Include code-mixed language (e.g., Tamil + English)
4. Cover: new bookings, lookups, modifications, cancellations, edge cases
5. Return ONLY JSON, no explanations or markdown

When you receive a prompt, analyze it and generate the requested number of scenarios.`;
}
