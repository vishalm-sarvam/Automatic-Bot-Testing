/**
 * Agent Configurator Service
 *
 * Manages Sarvam agent configurations via API.
 * Automatically configures tester agents with appropriate prompts.
 */

import type { ApiConfig } from '@/types';

const BEARER_TOKEN = import.meta.env.VITE_SARVAM_BEARER_TOKEN || '';

// Predefined prompts for different agent types
const USER_SIMULATOR_PROMPT = `You are a dynamic user simulator for testing conversational AI bots.

ROLE:
- Simulate realistic users interacting with bots
- Respond naturally in the specified language
- Work towards achieving the given goal
- Report when the goal is achieved

RULES:
1. Respond naturally as the persona would in the specified language
2. Use code-mixed language naturally (Tamil/Hindi + English)
3. Use realistic Indian data:
   - Names: Ravi, Priya, Arjun, Meena, Kumar
   - Phone: 10 digits starting with 9/8/7
   - Dates: dd/mm/yyyy format
   - Times: Between 11:00-22:00
4. Keep responses concise and conversational
5. When goal is achieved, include GOAL_ACHIEVED in your response
6. If goal is impossible (e.g., repeated not found), say GOAL_FAILED

BEHAVIOR:
- Be patient and polite
- Answer bot questions directly
- Dont change details once provided (consistent phone, name, etc.)
- If bot repeats same question, give clearer answer
- After 3+ failures, gracefully end conversation

OUTPUT:
Respond ONLY with the user message in the target language.
Add GOAL_ACHIEVED or GOAL_FAILED at the end if applicable.`;

const SCENARIO_GENERATOR_PROMPT = `You are an expert test scenario generator for conversational AI bots.

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
- userMessages: Array of user message strings in the target language
- expectedStates: States the conversation should visit
- expectedTools: Tools that should be called
- successCriteria: Patterns indicating goal achievement
- tags: Categories for the scenario

RULES:
1. Use realistic Indian data (names like Ravi, Priya, Arjun; 10-digit phone numbers starting with 9/8/7)
2. Write natural conversational messages, not robotic scripts
3. Include code-mixed language (e.g., Tamil + English words mixed naturally)
4. Cover: new bookings, lookups, modifications, cancellations, edge cases
5. Return ONLY valid JSON array, no explanations or markdown

Analyze the bot config provided and generate scenarios. Return ONLY JSON.`;

export interface AgentConfig {
  appId: string;
  name: string;
  type: 'user_simulator' | 'scenario_generator' | 'custom';
  instructions?: string;
  language?: string;
}

/**
 * Get agent configuration from Sarvam
 * Uses /api/sarvam proxy to avoid CORS issues
 */
export async function getAgentConfig(
  apiConfig: ApiConfig,
  appId: string,
  version?: number
): Promise<Record<string, unknown> | null> {
  const url = new URL(
    `/api/sarvam/app-authoring/orgs/${apiConfig.orgId}/workspaces/${apiConfig.workspaceId}/apps/${appId}`,
    window.location.origin
  );

  if (version) {
    url.searchParams.set('app_version', version.toString());
    url.searchParams.set('version_filter', 'specific');
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[AgentConfigurator] Failed to get agent: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[AgentConfigurator] Error getting agent config:', error);
    return null;
  }
}

/**
 * Update agent with new instructions
 * Uses /api/sarvam proxy to avoid CORS issues
 * Configures as single prompt agent
 */
export async function updateAgentInstructions(
  apiConfig: ApiConfig,
  appId: string,
  instructions: string,
  agentName?: string
): Promise<boolean> {
  const url = `/api/sarvam/app-authoring/orgs/${apiConfig.orgId}/workspaces/${apiConfig.workspaceId}/apps/${appId}`;

  const payload = {
    app: {
      channel_type: 'v2v',
      tool_runner_parameters: {
        parameters: {},
      },
      privacy_config: {
        user_information_config: {
          phone_number: {
            mask_config: {
              privacy_strategy: 'mask',
              pattern: '(\\d{6})(\\d{4})',
              replacement: '******\\2',
            },
            hash_config: {
              privacy_strategy: 'hash',
              salt: null,
              hash_algorithm: 'sha256',
            },
            encrypt_config: null,
          },
          email: {
            mask_config: {
              privacy_strategy: 'mask',
              pattern: '(\\w{3})\\w*@(\\w{3})\\w*(\\.\\w{2,})',
              replacement: '\\1***@\\2***\\3',
            },
            hash_config: {
              privacy_strategy: 'hash',
              salt: null,
              hash_algorithm: 'sha256',
            },
            encrypt_config: null,
          },
        },
      },
      memory_config: null,
      llm_config: {
        llm_model_variant: 'saaras/saaras-gemini-2.0-flash',
        config_version: '1.0',
        agent_config: {
          global_prompt: null,
          response_style: '',
          agent_variables: {},
          is_single_prompt_mode: true,
          states: {
            start: {
              name: 'start',
              instructions: instructions,
              context: null,
              tool_names: [],
              next_states: [],
              agent_variables_in_context: [],
            },
          },
          send_multiple_messages: false,
          initial_state_name: 'start',
          kb_config: {},
          enable_structured_prompt: false,
          enable_lid: false,
          enable_voicemail_detection: false,
          supported_languages: ['English'],
          global_tool_names: [],
          thread_window: null,
          structured_content_thread_window: null,
        },
      },
      intro_message_config: {
        audio: 'Ready to assist with testing.',
      },
      language_config: {
        initial_language_name: 'English',
        enable_language_identification: false,
        indic_language_style: 'classic_colloquial',
        numbers_in_indic: false,
        supported_languages: ['English'],
        custom_code_mixed_words: [],
        language_identification: null,
      },
      speech_to_text_config: {
        speech_hotwords: [],
      },
      interaction_config: {
        allow_interrupt_during_playback: false,
        send_whatsapp_message_on_end: false,
        skip_translate_transliterate: false,
        max_interaction_time_seconds: null,
        nudge_config: null,
        vad_config: null,
      },
      text_to_speech_config: {
        speaker_id: 'neha',
        speech_settings: {
          pace: null,
          pitch: null,
          volume: null,
        },
      },
      on_start_config: null,
      on_end_config: null,
      output_config: {
        output_type: 'audio',
        background_sound: {
          enabled: false,
          volume_dbfs: -50,
        },
      },
    },
    app_name: agentName || 'Dynamic Voice User Simulator',
  };

  try {
    console.log('[AgentConfigurator] PUT URL:', url);
    console.log('[AgentConfigurator] Payload:', JSON.stringify(payload, null, 2));
    console.log('[AgentConfigurator] Bearer token present:', !!BEARER_TOKEN);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AgentConfigurator] Failed to update agent: ${response.status} - ${errorText}`);
      return false;
    }

    console.log(`[AgentConfigurator] Agent ${appId} updated successfully`);
    return true;
  } catch (error) {
    console.error('[AgentConfigurator] Error updating agent:', error);
    return false;
  }
}

/**
 * Configure agent for user simulation
 */
export async function configureUserSimulator(
  apiConfig: ApiConfig,
  appId: string
): Promise<boolean> {
  return updateAgentInstructions(
    apiConfig,
    appId,
    USER_SIMULATOR_PROMPT,
    'Dynamic Voice User Simulator'
  );
}

/**
 * Configure agent for scenario generation
 */
export async function configureScenarioGenerator(
  apiConfig: ApiConfig,
  appId: string
): Promise<boolean> {
  return updateAgentInstructions(
    apiConfig,
    appId,
    SCENARIO_GENERATOR_PROMPT,
    'Scenario Generator'
  );
}

/**
 * Get predefined prompt by type
 */
export function getPromptByType(type: 'user_simulator' | 'scenario_generator'): string {
  switch (type) {
    case 'user_simulator':
      return USER_SIMULATOR_PROMPT;
    case 'scenario_generator':
      return SCENARIO_GENERATOR_PROMPT;
    default:
      return '';
  }
}

/**
 * Check if agent is properly configured
 */
export async function isAgentConfigured(
  apiConfig: ApiConfig,
  appId: string,
  expectedType: 'user_simulator' | 'scenario_generator'
): Promise<boolean> {
  const config = await getAgentConfig(apiConfig, appId);

  if (!config) return false;

  const instructions = (config as any)?.llm_config?.agent_config?.states?.start?.instructions || '';

  // Check if instructions contain key phrases for the expected type
  if (expectedType === 'user_simulator') {
    return instructions.includes('user simulator') || instructions.includes('GOAL_ACHIEVED');
  } else if (expectedType === 'scenario_generator') {
    return instructions.includes('scenario generator') || instructions.includes('JSON array');
  }

  return false;
}
