// Bot Configuration Types
export interface BotConfiguration {
  config_version: string;
  org_id: string;
  workspace_id: string;
  app_id: string;
  app_name: string;
  app_version: number;
  channel_type: 'v2v' | 't2t' | 'v2t';
  llm_config: LLMConfig;
  intro_message_config: IntroMessageConfig;
  language_config: LanguageConfig;
  text_to_speech_config: TTSConfig;
  speech_to_text_config: STTConfig;
  interaction_config: InteractionConfig;
  privacy_config: PrivacyConfig;
  status: 'draft' | 'published';
  is_deployed: boolean;
}

export interface LLMConfig {
  config_version: string;
  llm_model_variant: string;
  tool_llm_model_variant: string;
  temperature: number;
  agent_config: AgentConfig;
  fallback_messages: string[];
}

export interface AgentConfig {
  global_prompt: string;
  response_style: string;
  agent_variables: Record<string, AgentVariable>;
  internal_variables: Record<string, AgentVariable>;
  states: Record<string, BotState>;
  initial_state_name: string;
  supported_languages: string[];
}

export interface AgentVariable {
  name: string;
  value: string;
  description: string;
  is_agent_updatable: boolean;
  needs_initial_value: boolean;
  type: 'string' | 'number' | 'boolean';
  one_of: string[];
}

export interface BotState {
  name: string;
  goal: string;
  instructions: string;
  context: string | null;
  tool_names: string[];
  next_states: string[];
  agent_variables_in_context: string[];
}

export interface IntroMessageConfig {
  config_version: string;
  audio: string;
  multilingual_audio: {
    language_text_mapping: Record<string, string>;
    default_language: string;
  };
}

export interface LanguageConfig {
  config_version: string;
  initial_language_name: string;
  supported_languages: string[];
  enable_language_identification: boolean;
}

export interface TTSConfig {
  config_version: string;
  speaker_id: string;
  language_speaker_mapping: Record<string, string>;
  language_voice_settings_mapping: Record<string, VoiceSettings>;
}

export interface VoiceSettings {
  src_speaker: string;
  tgt_speaker: string;
  pitch: number;
  pace: number;
  volume: number;
  tts_model_name: string;
}

export interface STTConfig {
  config_version: string;
  asr_model_name: string | null;
  speech_hotwords: string[];
  system_prompt: string | null;
}

export interface InteractionConfig {
  config_version: string;
  allow_interrupt_during_playback: boolean;
  nudge_config: NudgeConfig;
}

export interface NudgeConfig {
  enable_inactivity_nudge: boolean;
  user_nudge_message_configs: NudgeMessageConfig[];
}

export interface NudgeMessageConfig {
  timeout_seconds: number;
  nudge_type: string;
  template_messages: string[];
  choice: string;
}

export interface PrivacyConfig {
  header: {
    version: string;
    timestamp: string;
  };
}

// State Graph Types
export interface StateGraph {
  states: Map<string, StateNode>;
  initialState: string;
  edges: StateEdge[];
}

export interface StateNode {
  id: string;
  name: string;
  instructions: string;
  tools: string[];
  nextStates: string[];
  variables: string[];
}

export interface StateEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface StatePath {
  id: string;
  states: string[];
  description: string;
  category: 'happy_path' | 'edge_case' | 'error_handling';
}

// Test Scenario Types
export interface TestScenario {
  id: string;
  name: string;
  description: string;
  language: string;
  turns: ConversationTurn[];
  expectedStates: string[];
  expectedVariables: Record<string, string>;
  expectedToolCalls: string[];
  tags: string[];
  status: 'pending' | 'running' | 'passed' | 'failed' | 'error';
  // End goal that must be achieved for the test to pass
  endGoal?: string;
  // Success criteria patterns (bot responses that indicate goal achieved)
  successPatterns?: string[];
}

export interface ConversationTurn {
  id: string;
  speaker: 'user' | 'bot';
  text: string;
  expectedIntent?: string;
  expectedEntities?: Record<string, string>;
  audioFile?: string;
  actualResponse?: string;
  timestamp?: number;
}

// Test Result Types
export interface TestResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: 'passed' | 'failed' | 'error';
  responses: BotResponse[];
  transcript?: Transcript;
  durationSeconds: number;
  statesVisited: string[];
  toolsCalled: string[];
  issues: Issue[];
  timestamp: Date;
}

export interface BotResponse {
  turnId: string;
  text: string;
  audio?: ArrayBuffer;
  state: string;
  toolCalls: ToolCall[];
  latencyMs: number;
}

export interface ToolCall {
  name: string;
  parameters: Record<string, unknown>;
  result: unknown;
}

export interface Transcript {
  id: string;
  turns: TranscriptTurn[];
  duration: number;
}

export interface TranscriptTurn {
  speaker: 'user' | 'bot';
  text: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

// Issue Types
export interface Issue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: IssueCategory;
  description: string;
  scenarioId: string;
  turnNumber: number;
  expected: string;
  actual: string;
  suggestedFix?: string;
  stateName?: string;
}

export type IssueCategory =
  | 'translation_error'
  | 'transliteration_error'
  | 'state_transition_bug'
  | 'tool_call_error'
  | 'response_quality'
  | 'latency_issue'
  | 'intent_mismatch'
  | 'entity_extraction_error';

// Prompt Modification Types
export interface PromptModification {
  id: string;
  stateName: string;
  field: 'instructions' | 'global_prompt' | 'context';
  originalValue: string;
  suggestedValue: string;
  reason: string;
  confidence: number;
  relatedIssues: string[];
  status: 'pending' | 'applied' | 'rejected';
}

// Test Report Types
export interface TestReport {
  id: string;
  timestamp: Date;
  botConfig: BotConfiguration;
  scenariosRun: number;
  passed: number;
  failed: number;
  results: TestResult[];
  issues: Issue[];
  suggestedModifications: PromptModification[];
  summary: TestSummary;
}

export interface TestSummary {
  totalScenarios: number;
  passRate: number;
  avgDuration: number;
  issuesByCategory: Record<IssueCategory, number>;
  issuesBySeverity: Record<Issue['severity'], number>;
  coverageByState: Record<string, number>;
}

// Auth Types
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  accessToken: string;
  refreshToken?: string;
  orgId?: string;
  workspaceId?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// API Config Types
export interface ApiConfig {
  apiKey: string;
  orgId: string;
  workspaceId: string;
  baseUrl: string;
}
