import type { ApiConfig } from '@/types';

// Use Bearer JWT for REST API (not the Samvaad SDK token)
const BEARER_TOKEN = import.meta.env.VITE_SARVAM_BEARER_TOKEN || '';

interface TextChatResponse {
  text: string;
  interaction_id: string;
  debug_logs: unknown | null;
}

interface TextChatCallbacks {
  onResponse?: (text: string) => void;
  onError?: (error: Error) => void;
}

export class TextChatClient {
  private baseUrl: string;
  private orgId: string;
  private workspaceId: string;
  private interactionId: string | null = null;
  private callbacks: TextChatCallbacks;

  constructor(apiConfig: ApiConfig, callbacks: TextChatCallbacks = {}) {
    // Use the app-runtime endpoint, not app-authoring
    this.baseUrl = 'https://apps.sarvam.ai/api/app-runtime';
    this.orgId = apiConfig.orgId;
    this.workspaceId = apiConfig.workspaceId;
    this.callbacks = callbacks;
  }

  async startConversation(
    appId: string,
    version?: number
  ): Promise<{ success: boolean; text: string }> {
    const url = new URL(
      `${this.baseUrl}/channels/text-chat/orgs/${this.orgId}/workspaces/${this.workspaceId}/apps/${appId}/text-chat`
    );

    if (version) {
      url.searchParams.set('app_version', version.toString());
    }

    console.log('[TextChatClient] Starting conversation:', url.toString());

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BEARER_TOKEN}`,
        },
        body: JSON.stringify({
          stream: false,
          start_interaction: true,
          debug: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start conversation: ${response.status} - ${errorText}`);
      }

      const data: TextChatResponse = await response.json();
      console.log('[TextChatClient] Conversation started:', data);

      this.interactionId = data.interaction_id;
      this.callbacks.onResponse?.(data.text);

      return { success: true, text: data.text };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[TextChatClient] Start error:', err);
      this.callbacks.onError?.(err);
      return { success: false, text: '' };
    }
  }

  async sendMessage(
    appId: string,
    message: string,
    version?: number
  ): Promise<{ success: boolean; text: string }> {
    if (!this.interactionId) {
      throw new Error('No active conversation. Call startConversation first.');
    }

    const url = new URL(
      `${this.baseUrl}/channels/text-chat/orgs/${this.orgId}/workspaces/${this.workspaceId}/apps/${appId}/text-chat`
    );

    if (version) {
      url.searchParams.set('app_version', version.toString());
    }

    console.log('[TextChatClient] Sending message:', message);

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${BEARER_TOKEN}`,
        },
        body: JSON.stringify({
          stream: false,
          start_interaction: false,
          interaction_id: this.interactionId,
          text: message,
          debug: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
      }

      const data: TextChatResponse = await response.json();
      console.log('[TextChatClient] Response received:', data);

      this.callbacks.onResponse?.(data.text);

      return { success: true, text: data.text };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[TextChatClient] Send error:', err);
      this.callbacks.onError?.(err);
      return { success: false, text: '' };
    }
  }

  getInteractionId(): string | null {
    return this.interactionId;
  }

  endConversation(): void {
    this.interactionId = null;
  }
}
