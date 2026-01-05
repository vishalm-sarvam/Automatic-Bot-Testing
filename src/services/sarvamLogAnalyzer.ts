import type { Issue, IssueCategory } from '@/types';
import { generateId } from '@/lib/utils';

const BEARER_TOKEN = import.meta.env.VITE_SARVAM_BEARER_TOKEN || '';
// Use Vite proxy to avoid CORS - /api/sarvam proxies to https://apps.sarvam.ai/api
const LOG_API_BASE = '/api/sarvam/log';
const APP_API_BASE = '/api/sarvam/app-authoring';

// Event types from Sarvam logs
export interface SarvamLogEvent {
  event_type: string;
  origin: string;
  state_seq_id: number;
  state_id: string;
  is_chunk: boolean;
  element_id: string | null;
  metrics: {
    start_time: number;
    end_time: number;
  };
  parameters: unknown;
  state: string | null;
  cache_metadata: unknown;
  thread: Record<string, unknown>;
  log_type: string;
  input: unknown;
  output: unknown;
}

// State machine state from turns
export interface StateMachineState {
  state_seq_id: number;
  state_id: string;
  state_history: Record<string, string>;
  chat_llm_thread?: Array<{
    role: string;
    content: string;
  }>;
}

// Turn data structure
export interface TurnData {
  state_seq_id?: number;
  state_id?: string;
  events: SarvamLogEvent[];
  state_machine_state?: StateMachineState;
}

// User information from on_start event
export interface UserInformation {
  identifier: string;
  user_identifier_type: string;
  email?: string;
  full_name?: string;
  first_name?: string | null;
  last_name?: string | null;
}

// Authoring config from on_start event
export interface AuthoringConfig {
  initial_bot_message: string;
  initial_state_name: string;
  initial_language_name: string;
  llm_model_name: string;
  tool_llm_model_variant?: string;
  agent_can_end_interaction?: boolean;
  speech_hotwords?: string[];
}

// Channel metadata
export interface ChannelMetadata {
  source_type?: string;
  [key: string]: unknown;
}

// Full interaction log structure
export interface InteractionLog {
  interaction_id: string;
  events: SarvamLogEvent[];
  state_history?: Record<string, string>;
  variables?: {
    agent_variables?: Record<string, string>;
    internal_variables?: Record<string, unknown>;
    system_variables?: Record<string, unknown>;
  };
  turns?: TurnData[];
  channel_type?: string;
  channel_metadata?: ChannelMetadata;
  interaction_duration?: number | null;
  protected_user_information?: Record<string, unknown>;
}

// State events from the logs
export interface StateEvent {
  type: 'state_change' | 'variable_change' | 'vad_lock' | 'vad_release' | 'pipeline' | 'interaction';
  eventType: string;
  timestamp: number;
  stateId: string;
  stateSeqId: number;
  data?: unknown;
}

export interface ParsedInteraction {
  interactionId: string;
  startTime: Date;
  endTime: Date | null;
  durationMs: number;
  states: string[];
  stateHistory: Record<string, string>;
  stateEvents: StateEvent[]; // All state-related events
  stateTransitions: Array<{
    from: string;
    to: string;
    timestamp: number;
    seqId: number;
  }>;
  toolCalls: Array<{
    name: string;
    input: unknown;
    output: unknown;
    durationMs: number;
    success: boolean;
    errorMessage?: string;
    reasoning?: string;
  }>;
  messages: Array<{
    role: 'user' | 'bot';
    text: string;
    timestamp: number;
    state: string;
  }>;
  toolLLMDecisions: Array<{
    decision: string;
    inputText: string;
    timestamp: number;
  }>;
  variables: Record<string, string>;
  variableUpdates: Array<{
    variable: string;
    oldValue: string;
    newValue: string;
    timestamp: number;
    state: string;
  }>;
  systemVariables: Record<string, unknown>;
  pipelineEvents: Array<{
    type: 'ready' | 'stop';
    timestamp: number;
    stateId: string;
  }>;
  vadEvents: Array<{
    type: 'lock' | 'release';
    timestamp: number;
    stateId: string;
  }>;
  issues: Issue[];
  // Additional metadata
  channelType?: string;
  language?: string;
  userIdentifier?: string;
  llmModel?: string;
  // Goal tracking
  goalAchieved: boolean;
  goalDetails?: string;
}


// Fetch tool file for an app
export interface ToolDefinition {
  name: string;
  description: string;
  required_inputs?: string[];
  optional_inputs?: string[];
  inputs?: string[];
  validations?: Record<string, string>;
  notes?: string;
}

export interface ToolFile {
  storage_type?: string;
  note?: string;
  tools: ToolDefinition[];
  test_scenarios?: Record<string, {
    description: string;
    flow: string[];
    required_data?: Record<string, string>;
    notes?: string;
    expected?: string;
  }>;
}

export async function fetchToolFile(
  orgName: string,
  workspaceName: string,
  appId: string,
  version?: number
): Promise<ToolFile> {
  const params = new URLSearchParams({
    app_version: version?.toString() || '5',
  });

  const response = await fetch(
    `${APP_API_BASE}/orgs/${orgName}/workspaces/${workspaceName}/apps/${appId}/tools/download?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${BEARER_TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch tool file: ${response.status}`);
  }

  return response.json();
}

// Fetch interaction IDs for a specific date
export async function fetchInteractionIds(
  orgName: string,
  workspaceName: string,
  appId: string,
  userIdentifier: string,
  date: string // Format: YYYYMMDD
): Promise<string[]> {
  const params = new URLSearchParams({
    org_name: orgName,
    workspace_name: workspaceName,
    app_id: appId,
    user_identifier: userIdentifier,
    date: date,
  });

  const response = await fetch(`${LOG_API_BASE}/interaction-ids?${params}`, {
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch interaction IDs: ${response.status}`);
  }

  const data = await response.json();
  return data.interaction_ids || [];
}

// Fetch events for a specific interaction
export async function fetchInteractionEvents(
  orgName: string,
  workspaceName: string,
  appId: string,
  interactionId: string
): Promise<InteractionLog> {
  const params = new URLSearchParams({
    org_name: orgName,
    workspace_name: workspaceName,
    app_id: appId,
    interaction_id: interactionId,
  });

  const response = await fetch(`${LOG_API_BASE}/events?${params}`, {
    headers: {
      'Authorization': `Bearer ${BEARER_TOKEN}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch interaction events: ${response.status}`);
  }

  return response.json();
}

// Parse interaction log into structured data
export function parseInteractionLog(log: InteractionLog): ParsedInteraction {
  const states: string[] = [];
  const toolCalls: ParsedInteraction['toolCalls'] = [];
  const messages: ParsedInteraction['messages'] = [];
  const toolLLMDecisions: ParsedInteraction['toolLLMDecisions'] = [];
  const issues: Issue[] = [];
  const stateEvents: StateEvent[] = [];
  const stateTransitions: ParsedInteraction['stateTransitions'] = [];
  const variableUpdates: ParsedInteraction['variableUpdates'] = [];
  const pipelineEvents: ParsedInteraction['pipelineEvents'] = [];
  const vadEvents: ParsedInteraction['vadEvents'] = [];
  const systemVariables: Record<string, unknown> = {};

  let startTime: number | null = null;
  let endTime: number | null = null;
  let previousState: string | null = null;

  // Extract states from state_history (top-level field)
  if (log.state_history) {
    const stateValues = Object.values(log.state_history);
    for (const state of stateValues) {
      if (!states.includes(state)) {
        states.push(state);
      }
    }
  }

  // Extract variables from top-level variables field
  const variables: Record<string, string> = {};
  if (log.variables?.agent_variables) {
    Object.entries(log.variables.agent_variables).forEach(([key, value]) => {
      if (value) variables[key] = value;
    });
  }

  // Extract system variables
  if (log.variables?.system_variables) {
    Object.assign(systemVariables, log.variables.system_variables);
  }
  if (log.variables?.internal_variables) {
    Object.assign(systemVariables, log.variables.internal_variables);
  }

  // Process events from turns array (nested structure)
  const allEvents: SarvamLogEvent[] = [];

  if (log.turns && log.turns.length > 0) {
    for (const turn of log.turns) {
      if (turn.events) {
        allEvents.push(...turn.events);
      }
    }
  }

  // Also process top-level events
  if (log.events) {
    allEvents.push(...log.events);
  }

  for (const event of allEvents) {
    // Track timing
    if (event.metrics) {
      if (startTime === null || event.metrics.start_time < startTime) {
        startTime = event.metrics.start_time;
      }
      if (endTime === null || event.metrics.end_time > endTime) {
        endTime = event.metrics.end_time;
      }
    }

    const timestamp = event.metrics?.start_time || 0;

    // Handle state.* events
    if (event.event_type.startsWith('state.')) {
      const stateEventType = event.event_type.replace('state.', '');

      if (stateEventType === 'name_update') {
        // State transition event
        stateEvents.push({
          type: 'state_change',
          eventType: event.event_type,
          timestamp,
          stateId: event.state_id,
          stateSeqId: event.state_seq_id,
          data: event.input,
        });

        if (previousState && previousState !== event.state_id) {
          stateTransitions.push({
            from: previousState,
            to: event.state_id,
            timestamp,
            seqId: event.state_seq_id,
          });
        }
        previousState = event.state_id;
      } else if (stateEventType === 'system_variable_change') {
        stateEvents.push({
          type: 'variable_change',
          eventType: event.event_type,
          timestamp,
          stateId: event.state_id,
          stateSeqId: event.state_seq_id,
          data: event.input,
        });

        // Track variable changes
        const input = event.input as { variable_name?: string; old_value?: string; new_value?: string } | null;
        if (input?.variable_name) {
          variableUpdates.push({
            variable: input.variable_name,
            oldValue: String(input.old_value || ''),
            newValue: String(input.new_value || ''),
            timestamp,
            state: event.state_id,
          });
        }
      } else if (stateEventType === 'lock_vad') {
        vadEvents.push({ type: 'lock', timestamp, stateId: event.state_id });
        stateEvents.push({
          type: 'vad_lock',
          eventType: event.event_type,
          timestamp,
          stateId: event.state_id,
          stateSeqId: event.state_seq_id,
        });
      } else if (stateEventType === 'release_vad') {
        vadEvents.push({ type: 'release', timestamp, stateId: event.state_id });
        stateEvents.push({
          type: 'vad_release',
          eventType: event.event_type,
          timestamp,
          stateId: event.state_id,
          stateSeqId: event.state_seq_id,
        });
      }
    }

    // Handle pipeline.* events
    if (event.event_type.startsWith('pipeline.')) {
      const pipelineType = event.event_type.replace('pipeline.', '') as 'ready' | 'stop';
      pipelineEvents.push({ type: pipelineType, timestamp, stateId: event.state_id });
      stateEvents.push({
        type: 'pipeline',
        eventType: event.event_type,
        timestamp,
        stateId: event.state_id,
        stateSeqId: event.state_seq_id,
      });
    }

    // Handle interaction.* events
    if (event.event_type.startsWith('interaction.')) {
      stateEvents.push({
        type: 'interaction',
        eventType: event.event_type,
        timestamp,
        stateId: event.state_id,
        stateSeqId: event.state_seq_id,
        data: event.input,
      });
    }

    // Handle ServerToolEvent.update_variables
    if (event.event_type === 'ServerToolEvent.update_variables') {
      const input = event.input as Record<string, unknown> | null;
      const output = event.output as Record<string, unknown> | null;
      if (input || output) {
        stateEvents.push({
          type: 'variable_change',
          eventType: event.event_type,
          timestamp,
          stateId: event.state_id,
          stateSeqId: event.state_seq_id,
          data: { input, output },
        });
      }
    }

    // Handle ServerToolEvent.transition_state
    if (event.event_type === 'ServerToolEvent.transition_state') {
      const output = event.output as { new_state?: string } | null;
      if (output?.new_state && previousState) {
        stateTransitions.push({
          from: previousState,
          to: output.new_state,
          timestamp,
          seqId: event.state_seq_id,
        });
        previousState = output.new_state;
      }
      stateEvents.push({
        type: 'state_change',
        eventType: event.event_type,
        timestamp,
        stateId: event.state_id,
        stateSeqId: event.state_seq_id,
        data: event.output,
      });
    }

    // Handle different event types
    if (event.event_type === 'ServerChatLLMEvent.assistant') {
      // Extract bot response from output
      const output = event.output as {
        response?: string;
        output_text?: string;
        text?: string;
        llm_output?: { response?: string; text?: string };
      } | null;

      let responseText = '';
      if (output?.response) {
        responseText = output.response;
      } else if (output?.output_text) {
        responseText = output.output_text;
      } else if (output?.text) {
        responseText = output.text;
      } else if (output?.llm_output?.response) {
        responseText = output.llm_output.response;
      }

      // Also check input for user text
      const input = event.input as { text?: string } | null;

      if (responseText) {
        // Try to parse JSON response (bot often returns {audio: "text"})
        try {
          const parsed = JSON.parse(responseText);
          if (parsed.audio) responseText = parsed.audio;
        } catch {
          // Not JSON, use as-is
        }

        messages.push({
          role: 'bot',
          text: responseText,
          timestamp: event.metrics?.start_time || 0,
          state: event.state_id || '',
        });
      }

      // Add user message if present in input
      if (input?.text && !messages.some(m => m.text === input.text)) {
        messages.push({
          role: 'user',
          text: input.text,
          timestamp: event.metrics?.start_time || 0,
          state: event.state_id || '',
        });
      }
    }

    // Handle Tool LLM decisions (reasoning for tool calls)
    if (event.event_type === 'ServerToolLLMEvent.assistant') {
      const input = event.input as { text?: string } | null;
      const output = event.output as { text?: string } | null;

      if (output?.text) {
        toolLLMDecisions.push({
          decision: output.text,
          inputText: input?.text || '',
          timestamp: event.metrics?.start_time || 0,
        });
      }
    }

    // Handle tool calls
    if (event.event_type.startsWith('ServerToolEvent.') &&
        !['on_start', 'transition_state', 'update_variables'].some(e => event.event_type.endsWith(e))) {
      const toolName = event.event_type.replace('ServerToolEvent.', '');
      const durationMs = event.metrics
        ? (event.metrics.end_time - event.metrics.start_time) * 1000
        : 0;

      // Find matching tool LLM decision for reasoning
      const matchingDecision = toolLLMDecisions.find(d => {
        try {
          const parsed = JSON.parse(d.decision);
          return parsed.name === toolName;
        } catch {
          return false;
        }
      });

      // Check for tool errors or not found
      const output = event.output as {
        error?: string;
        status?: string;
        text?: string;
        result?: { status?: string }
      } | null;

      // Parse text output if present
      let parsedOutput: { message_to_llm?: string; status?: string } | null = null;
      if (output?.text) {
        try {
          parsedOutput = JSON.parse(output.text);
        } catch {
          // Not JSON
        }
      }

      const isNotFound = parsedOutput?.message_to_llm?.includes('RESERVATION_NOT_FOUND') ||
                         parsedOutput?.message_to_llm?.includes('NOT_FOUND') ||
                         output?.result?.status === 'RESERVATION_NOT_FOUND';
      const isError = output?.error || output?.status === 'error';
      const toolSuccess = !isError && !isNotFound;

      toolCalls.push({
        name: toolName,
        input: event.input,
        output: event.output,
        durationMs,
        success: toolSuccess,
        errorMessage: isNotFound ? parsedOutput?.message_to_llm : (isError ? String(output?.error) : undefined),
        reasoning: matchingDecision?.inputText,
      });

      if (isError || isNotFound) {
        issues.push({
          id: generateId(),
          severity: isNotFound ? 'low' : 'high',
          category: 'tool_call_error',
          description: `Tool ${toolName}: ${parsedOutput?.message_to_llm || output?.error || output?.result?.status || 'Error'}`,
          scenarioId: log.interaction_id,
          turnNumber: event.state_seq_id || -1,
          expected: 'Successful tool execution',
          actual: parsedOutput?.message_to_llm || String(output?.error || output?.result?.status || 'Error'),
        });
      }
    }
  }

  // Sort messages by timestamp
  messages.sort((a, b) => a.timestamp - b.timestamp);

  // Analyze for issues
  analyzeForIssues(messages, toolCalls, issues, log.interaction_id);

  // Determine if goal was achieved based on tool success and message patterns
  const successfulToolCalls = toolCalls.filter(t => t.success);
  const failedToolCalls = toolCalls.filter(t => !t.success);
  const hasConfirmation = messages.some(m =>
    m.role === 'bot' &&
    (m.text.toLowerCase().includes('confirm') ||
     m.text.toLowerCase().includes('booked') ||
     m.text.toLowerCase().includes('successful') ||
     m.text.includes('முன்பதிவு') ||
     m.text.includes('உறுதி'))
  );

  const goalAchieved = successfulToolCalls.length > 0 &&
                       failedToolCalls.length < successfulToolCalls.length &&
                       hasConfirmation;

  // Extract metadata from on_start event
  let language: string | undefined;
  let userIdentifier: string | undefined;
  let llmModel: string | undefined;

  const onStartEvent = allEvents.find(e => e.event_type === 'ServerToolEvent.on_start');
  if (onStartEvent?.input) {
    const onStartInput = onStartEvent.input as {
      on_start_input?: {
        authoring_config?: AuthoringConfig;
        user_information?: UserInformation;
      }
    };
    language = onStartInput.on_start_input?.authoring_config?.initial_language_name;
    userIdentifier = onStartInput.on_start_input?.user_information?.identifier;
    llmModel = onStartInput.on_start_input?.authoring_config?.llm_model_name;
  }

  // Sort state events by timestamp
  stateEvents.sort((a, b) => a.timestamp - b.timestamp);

  return {
    interactionId: log.interaction_id,
    startTime: startTime ? new Date(startTime * 1000) : new Date(),
    endTime: endTime ? new Date(endTime * 1000) : null,
    durationMs: startTime && endTime ? (endTime - startTime) * 1000 : 0,
    states,
    stateHistory: log.state_history || {},
    stateEvents,
    stateTransitions,
    toolCalls,
    messages,
    toolLLMDecisions,
    variables,
    variableUpdates,
    systemVariables,
    pipelineEvents,
    vadEvents,
    issues,
    channelType: log.channel_type,
    language,
    userIdentifier,
    llmModel,
    goalAchieved,
    goalDetails: goalAchieved
      ? `Completed with ${successfulToolCalls.length} successful tool calls`
      : `Failed: ${failedToolCalls.length} tool failures, ${issues.length} issues`,
  };
}

// Detect if bot is stuck in a loop (repeating same/similar responses)
function detectBotLoop(messages: ParsedInteraction['messages']): {
  isLooping: boolean;
  loopCount: number;
  repeatedMessage: string | null;
  loopStartIndex: number;
} {
  const botMessages = messages
    .filter(m => m.role === 'bot')
    .map(m => m.text.trim().toLowerCase());

  if (botMessages.length < 2) {
    return { isLooping: false, loopCount: 0, repeatedMessage: null, loopStartIndex: -1 };
  }

  // Exact match detection (normalized)
  const messageCounts: Record<string, { count: number; firstIndex: number }> = {};
  for (let i = 0; i < botMessages.length; i++) {
    const msg = botMessages[i];
    // Normalize message (remove punctuation, extra spaces)
    const normalized = msg.replace(/[^\w\s\u0B80-\u0BFF\u0900-\u097F]/g, '').trim();
    if (!messageCounts[normalized]) {
      messageCounts[normalized] = { count: 0, firstIndex: i };
    }
    messageCounts[normalized].count++;
  }

  // Find most repeated message
  let maxCount = 0;
  let repeatedMsg: string | null = null;
  let loopStartIndex = -1;

  for (const [msg, data] of Object.entries(messageCounts)) {
    if (data.count > maxCount && data.count >= 2) {
      maxCount = data.count;
      repeatedMsg = msg;
      loopStartIndex = data.firstIndex;
    }
  }

  // Also check for similar messages (asking same question pattern)
  const questionPatterns = [
    /புது reservation பண்ணனுமா|new reservation/i,
    /எப்படி உதவ முடியும்|how can i help/i,
    /reservation.*(பார்க்க|check|modify|cancel)/i,
    /என்ன உதவி|what help|how may i assist/i,
  ];

  for (const pattern of questionPatterns) {
    let patternCount = 0;
    let firstMatchIndex = -1;
    for (let i = 0; i < botMessages.length; i++) {
      if (pattern.test(botMessages[i])) {
        patternCount++;
        if (firstMatchIndex === -1) firstMatchIndex = i;
      }
    }
    if (patternCount >= 2 && patternCount > maxCount) {
      maxCount = patternCount;
      repeatedMsg = `Pattern: ${pattern.source}`;
      loopStartIndex = firstMatchIndex;
    }
  }

  return {
    isLooping: maxCount >= 2,
    loopCount: maxCount,
    repeatedMessage: repeatedMsg,
    loopStartIndex,
  };
}

// Analyze parsed interaction for issues
function analyzeForIssues(
  messages: ParsedInteraction['messages'],
  toolCalls: ParsedInteraction['toolCalls'],
  issues: Issue[],
  scenarioId: string
): void {
  // Check for slow tool calls (> 3 seconds)
  for (const tool of toolCalls) {
    if (tool.durationMs > 3000) {
      issues.push({
        id: generateId(),
        severity: tool.durationMs > 5000 ? 'high' : 'medium',
        category: 'latency_issue',
        description: `Tool ${tool.name} took ${(tool.durationMs / 1000).toFixed(1)}s`,
        scenarioId,
        turnNumber: -1,
        expected: 'Tool response < 3s',
        actual: `${(tool.durationMs / 1000).toFixed(1)}s`,
      });
    }
  }

  // Check for empty bot responses
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role === 'bot' && (!msg.text || msg.text.trim().length < 5)) {
      issues.push({
        id: generateId(),
        severity: 'medium',
        category: 'response_quality',
        description: 'Empty or very short bot response',
        scenarioId,
        turnNumber: i,
        expected: 'Meaningful response',
        actual: msg.text || '(empty)',
      });
    }
  }

  // Check for repeated "not found" responses
  const notFoundCount = messages.filter(
    m => m.role === 'bot' &&
    (m.text.toLowerCase().includes('not found') ||
     m.text.toLowerCase().includes('no reservation') ||
     m.text.includes('கிடைக்கவில்லை'))
  ).length;

  if (notFoundCount >= 2) {
    issues.push({
      id: generateId(),
      severity: 'low',
      category: 'response_quality',
      description: `Bot responded "not found" ${notFoundCount} times - possible loop or missing data`,
      scenarioId,
      turnNumber: -1,
      expected: 'Successful lookup or graceful exit',
      actual: `${notFoundCount} failed lookups`,
    });
  }

  // Check for bot loop (repeating same response)
  const loopDetection = detectBotLoop(messages);
  if (loopDetection.isLooping) {
    issues.push({
      id: generateId(),
      severity: loopDetection.loopCount >= 3 ? 'high' : 'medium',
      category: 'state_transition_bug',
      description: `Bot loop detected: Same response repeated ${loopDetection.loopCount} times`,
      scenarioId,
      turnNumber: loopDetection.loopStartIndex,
      expected: 'Progressive conversation with different responses',
      actual: `Repeated "${loopDetection.repeatedMessage?.substring(0, 50)}..." ${loopDetection.loopCount} times`,
      suggestedFix: 'Add handling for ambiguous user responses like "ok", "சரி". Consider rephrasing the question or providing examples when user response is unclear.',
    });
  }

  // Check for user giving vague responses that may cause loops
  const userMessages = messages.filter(m => m.role === 'user');
  const vaguePatterns = [
    /^(ok|okay|சரி|நன்றி|thanks|thank you|hmm|yes|ஆம்)[\s.,!]*$/i,
  ];

  const vagueResponses = userMessages.filter(m =>
    vaguePatterns.some(p => p.test(m.text.trim()))
  );

  if (vagueResponses.length >= 2 && loopDetection.isLooping) {
    issues.push({
      id: generateId(),
      severity: 'medium',
      category: 'intent_mismatch',
      description: `User gave ${vagueResponses.length} vague responses causing potential confusion`,
      scenarioId,
      turnNumber: -1,
      expected: 'Bot should handle vague responses gracefully',
      actual: `Vague responses: "${vagueResponses.map(m => m.text).join('", "')}"`,
      suggestedFix: 'Bot should detect vague responses and provide clearer options or examples. E.g., "உங்களுக்கு புது reservation வேணுமா அல்லது existing booking பார்க்கணுமா என்று சொல்லுங்கள்"',
    });
  }
}

// Aggregate analysis across multiple interactions
export interface AggregatedAnalysis {
  totalInteractions: number;
  totalMessages: number;
  totalToolCalls: number;
  avgDurationMs: number;
  stateFrequency: Record<string, number>;
  toolFrequency: Record<string, number>;
  issuesByCategory: Record<IssueCategory, number>;
  issuesBySeverity: Record<string, number>;
  allIssues: Issue[];
}

export function aggregateAnalysis(interactions: ParsedInteraction[]): AggregatedAnalysis {
  const stateFrequency: Record<string, number> = {};
  const toolFrequency: Record<string, number> = {};
  const issuesByCategory: Record<IssueCategory, number> = {
    translation_error: 0,
    transliteration_error: 0,
    state_transition_bug: 0,
    tool_call_error: 0,
    response_quality: 0,
    latency_issue: 0,
    intent_mismatch: 0,
    entity_extraction_error: 0,
  };
  const issuesBySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const allIssues: Issue[] = [];

  let totalMessages = 0;
  let totalToolCalls = 0;
  let totalDuration = 0;

  for (const interaction of interactions) {
    // Count states
    for (const state of interaction.states) {
      stateFrequency[state] = (stateFrequency[state] || 0) + 1;
    }

    // Count tool calls
    for (const tool of interaction.toolCalls) {
      toolFrequency[tool.name] = (toolFrequency[tool.name] || 0) + 1;
    }

    // Count issues
    for (const issue of interaction.issues) {
      issuesByCategory[issue.category]++;
      issuesBySeverity[issue.severity]++;
      allIssues.push(issue);
    }

    totalMessages += interaction.messages.length;
    totalToolCalls += interaction.toolCalls.length;
    totalDuration += interaction.durationMs;
  }

  return {
    totalInteractions: interactions.length,
    totalMessages,
    totalToolCalls,
    avgDurationMs: interactions.length > 0 ? totalDuration / interactions.length : 0,
    stateFrequency,
    toolFrequency,
    issuesByCategory,
    issuesBySeverity,
    allIssues,
  };
}

// Helper to format date as YYYYMMDD
export function formatDateForApi(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

// Note: AI-powered insights generator is in openRouter.ts
// Use generateAIInsights() from '@/services/openRouter' for intelligent analysis
