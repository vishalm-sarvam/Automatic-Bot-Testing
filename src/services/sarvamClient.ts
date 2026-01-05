import { ConversationAgent, BrowserAudioInterface, InteractionType, UserIdentifierType } from 'sarvam-conv-ai-sdk';
import type { ApiConfig, BotResponse } from '@/types';

interface TextMessage {
  text: string;
  is_final?: boolean;
}

interface ConversationEvent {
  type: string;
  data?: unknown;
}

export class SarvamClient {
  private apiConfig: ApiConfig;
  private agent: ConversationAgent | null = null;
  private audioInterface: BrowserAudioInterface | null = null;
  private responses: BotResponse[] = [];
  private currentState: string = '';
  private onResponse?: (response: BotResponse) => void;
  private onStateChange?: (state: string) => void;
  private onError?: (error: Error) => void;
  private pendingText: string = '';
  private responseStartTime: number = 0;

  constructor(apiConfig: ApiConfig) {
    this.apiConfig = apiConfig;
  }

  async startTextConversation(
    appId: string,
    options: {
      version?: number;
      agentVariables?: Record<string, string>;
      initialLanguage?: string;
      initialState?: string;
      onResponse?: (response: BotResponse) => void;
      onStateChange?: (state: string) => void;
      onError?: (error: Error) => void;
    } = {}
  ): Promise<boolean> {
    const {
      version,
      agentVariables,
      initialLanguage,
      initialState,
      onResponse,
      onStateChange,
      onError,
    } = options;

    this.onResponse = onResponse;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.responses = [];
    this.pendingText = '';
    this.responseStartTime = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      user_identifier_type: UserIdentifierType.CUSTOM,
      user_identifier: `test-user-${Date.now()}`,
      org_id: this.apiConfig.orgId,
      workspace_id: this.apiConfig.workspaceId,
      app_id: appId,
      interaction_type: InteractionType.CHAT,
      sample_rate: 16000,
      version,
      agent_variables: agentVariables,
      initial_language_name: initialLanguage,
      initial_state_name: initialState,
    };

    try {
      console.log('[SarvamClient] Creating ConversationAgent with config:', {
        appId,
        orgId: config.org_id,
        workspaceId: config.workspace_id,
        interactionType: config.interaction_type,
        hasApiKey: !!this.apiConfig.apiKey,
      });

      this.agent = new ConversationAgent({
        apiKey: this.apiConfig.apiKey,
        config,
        textCallback: async (msg: TextMessage) => {
          console.log('[SarvamClient] Text received:', msg);
          this.handleTextResponse(msg);
        },
        eventCallback: async (event: ConversationEvent) => {
          console.log('[SarvamClient] Event received:', event);
          this.handleEvent(event);
        },
      });

      console.log('[SarvamClient] Starting agent...');
      await this.agent.start();
      console.log('[SarvamClient] Agent started, waiting for connect...');
      const connected = await this.agent.waitForConnect(10000);
      console.log('[SarvamClient] Connection result:', connected);
      return connected;
    } catch (error) {
      console.error('[SarvamClient] Connection error:', error);
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async startVoiceConversation(
    appId: string,
    options: {
      version?: number;
      agentVariables?: Record<string, string>;
      initialLanguage?: string;
      initialState?: string;
      onResponse?: (response: BotResponse) => void;
      onStateChange?: (state: string) => void;
      onError?: (error: Error) => void;
    } = {}
  ): Promise<boolean> {
    const {
      version,
      agentVariables,
      initialLanguage,
      initialState,
      onResponse,
      onStateChange,
      onError,
    } = options;

    this.onResponse = onResponse;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.responses = [];
    this.pendingText = '';
    this.responseStartTime = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = {
      user_identifier_type: UserIdentifierType.CUSTOM,
      user_identifier: `test-user-${Date.now()}`,
      org_id: this.apiConfig.orgId,
      workspace_id: this.apiConfig.workspaceId,
      app_id: appId,
      interaction_type: InteractionType.CALL,
      sample_rate: 16000,
      version,
      agent_variables: agentVariables,
      initial_language_name: initialLanguage,
      initial_state_name: initialState,
    };

    try {
      this.audioInterface = new BrowserAudioInterface();

      this.agent = new ConversationAgent({
        apiKey: this.apiConfig.apiKey,
        config,
        audioInterface: this.audioInterface,
        textCallback: async (msg: TextMessage) => {
          this.handleTextResponse(msg);
        },
        eventCallback: async (event: ConversationEvent) => {
          this.handleEvent(event);
        },
      });

      await this.agent.start();
      const connected = await this.agent.waitForConnect(10000);
      return connected;
    } catch (error) {
      this.onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async sendMessage(text: string): Promise<void> {
    if (!this.agent) {
      throw new Error('No active conversation');
    }

    const agentType = this.agent.getAgentType();
    if (agentType !== 'text') {
      throw new Error('Cannot send text in voice mode');
    }

    await this.agent.sendText(text);
  }

  async stopConversation(): Promise<void> {
    if (this.agent) {
      await this.agent.stop();
      this.agent = null;
    }
    this.audioInterface = null;
  }

  isConnected(): boolean {
    return this.agent?.isConnected() ?? false;
  }

  getResponses(): BotResponse[] {
    return [...this.responses];
  }

  getCurrentState(): string {
    return this.currentState;
  }

  private handleTextResponse(msg: TextMessage): void {
    // Start timing from first chunk
    if (!this.pendingText) {
      this.responseStartTime = Date.now();
    }

    // Accumulate text chunks
    this.pendingText += msg.text;

    // Only emit response when we get the final chunk
    if (msg.is_final) {
      const response: BotResponse = {
        turnId: `turn-${this.responses.length + 1}`,
        text: this.pendingText,
        state: this.currentState,
        toolCalls: [],
        latencyMs: Date.now() - this.responseStartTime,
      };

      this.responses.push(response);
      this.onResponse?.(response);

      // Reset for next response
      this.pendingText = '';
      this.responseStartTime = 0;
    }
  }

  private handleEvent(event: ConversationEvent): void {
    switch (event.type) {
      case 'server.action.interaction_connected':
        console.log('Conversation connected');
        break;
      case 'server.event.state_change':
        if (event.data && typeof event.data === 'object' && 'state' in event.data) {
          this.currentState = String((event.data as { state: unknown }).state);
          this.onStateChange?.(this.currentState);
        }
        break;
      case 'server.event.tool_call':
        // Handle tool calls if needed
        break;
      case 'server.event.user_interrupt':
        console.log('User interrupted');
        break;
      case 'server.action.interaction_ended':
        console.log('Conversation ended');
        break;
      default:
        console.log('Unknown event:', event.type);
    }
  }
}

// Singleton instance
let clientInstance: SarvamClient | null = null;

export function getSarvamClient(apiConfig: ApiConfig): SarvamClient {
  if (!clientInstance) {
    clientInstance = new SarvamClient(apiConfig);
  }
  return clientInstance;
}

export function resetSarvamClient(): void {
  clientInstance = null;
}
