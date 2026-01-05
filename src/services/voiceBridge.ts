/**
 * Voice Agent Bridge
 *
 * Enables voice-to-voice testing between two Sarvam agents:
 * - Tester Agent: Simulates a user (generates responses based on goals)
 * - Bot Agent: The bot being tested (runs in full voice mode)
 *
 * Both agents run in CALL mode, audio is routed directly between them.
 */

import { ConversationAgent, InteractionType, UserIdentifierType } from 'sarvam-conv-ai-sdk';
import type { ApiConfig, BotConfiguration, Issue } from '@/types';
import { generateId } from '@/lib/utils';

// Simple audio player - no queue, just play immediately
let audioContext: AudioContext | null = null;

function playAudioChunk(base64Audio: string, sampleRate: number = 16000): void {
  try {
    if (!audioContext) {
      audioContext = new AudioContext({ sampleRate });
    }

    // Decode base64
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert to float samples (16-bit PCM)
    const samples = new Float32Array(bytes.length / 2);
    const dataView = new DataView(bytes.buffer);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = dataView.getInt16(i * 2, true) / 32768.0;
    }

    if (samples.length < 50) return;

    // Create and play buffer
    const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start();
  } catch (e) {
    // Ignore errors
  }
}

// Voice test goal
export interface VoiceTestGoal {
  id: string;
  name: string;
  description: string;
  language: string;
  persona: string;
  goal: string;
  successCriteria: string[];
  maxTurns: number;
  tags: string[];
}

// Voice test result
export interface VoiceTestResult {
  id: string;
  goalId: string;
  goalName: string;
  status: 'passed' | 'failed' | 'error';
  goalAchieved: boolean;
  transcript: Array<{
    speaker: 'tester' | 'bot';
    text: string;
    timestamp: number;
    audioUrl?: string;
  }>;
  turnsUsed: number;
  durationMs: number;
  issues: Issue[];
  metadata: {
    testerAgentId: string;
    botAgentId: string;
    language: string;
    testMode: 'voice' | 'hybrid';
  };
}

// Tester agent config
export interface VoiceTesterConfig {
  appId: string;
  version?: number;
}

// Bridge callbacks
export interface VoiceBridgeCallbacks {
  onTesterMessage?: (message: string) => void;
  onBotMessage?: (message: string) => void;
  onBotAudio?: (audioData: ArrayBuffer) => void;
  onStateChange?: (state: string) => void;
  onError?: (error: Error) => void;
  onComplete?: (result: VoiceTestResult) => void;
  onAudioPlaying?: (source: 'bot' | 'tester', duration: number) => void;
}

// Bridge options
export interface VoiceBridgeOptions {
  playAudio?: boolean; // Enable audio playback for debugging
  routeAudio?: boolean; // Route audio between agents
}

interface TextMessage {
  text: string;
  is_final?: boolean;
}

interface ServerAudioChunkMsg {
  type: string;
  audio_base64: string;
  format: string;
  sample_rate?: number;
  status: string;
}

interface ConversationEvent {
  type: string;
  data?: unknown;
}

// Helper to convert base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Voice Bridge for Agent-to-Agent Testing
 * Routes audio directly between two voice agents
 */
export class VoiceBridge {
  private apiConfig: ApiConfig;
  private callbacks: VoiceBridgeCallbacks;
  private options: VoiceBridgeOptions;
  private botAgent: ConversationAgent | null = null;
  private testerAgent: ConversationAgent | null = null;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  // State tracking
  private currentBotText: string = '';
  private currentTesterText: string = '';
  private currentState: string = '';
  private transcript: VoiceTestResult['transcript'] = [];
  private turnCount: number = 0;
  private goalAchieved: boolean = false;
  private bothAgentsReady: boolean = false;

  // Track when agents end
  private botEnded: boolean = false;
  private testerEnded: boolean = false;

  constructor(apiConfig: ApiConfig, callbacks: VoiceBridgeCallbacks = {}, options: VoiceBridgeOptions = {}) {
    this.apiConfig = apiConfig;
    this.callbacks = callbacks;
    this.options = {
      playAudio: options.playAudio ?? true, // Enable audio playback by default
      routeAudio: options.routeAudio ?? true, // Enable audio routing by default
    };
  }

  /**
   * Run voice test with two voice agents
   */
  async runVoiceTest(
    goal: VoiceTestGoal,
    botConfig: BotConfiguration,
    testerConfig: VoiceTesterConfig
  ): Promise<VoiceTestResult> {
    const startTime = Date.now();
    const issues: Issue[] = [];

    this.isRunning = true;
    this.shouldStop = false;
    this.transcript = [];
    this.currentBotText = '';
    this.currentTesterText = '';
    this.turnCount = 0;
    this.goalAchieved = false;
    this.bothAgentsReady = false;
    this.botEnded = false;
    this.testerEnded = false;

    const botAppId = botConfig.app_id;
    const botVersion = botConfig.app_version;

    console.log('[VoiceBridge] Starting voice-to-voice test:', {
      goal: goal.name,
      botAppId,
      testerAppId: testerConfig.appId,
    });

    try {
      // 1. Initialize bot agent first (it will wait for audio input)
      console.log('[VoiceBridge] Starting bot agent...');
      await this.initializeBotAgent(botAppId, botVersion);

      // 2. Wait for bot's intro message to finish
      console.log('[VoiceBridge] Waiting for bot intro...');
      await this.delay(4000);

      // 3. Now start tester agent - it will speak and bot will hear it
      console.log('[VoiceBridge] Starting tester agent...');
      await this.initializeTesterAgent(testerConfig.appId, testerConfig.version, goal);

      // 4. Wait for tester intro and initial exchange
      console.log('[VoiceBridge] Waiting for initial exchange...');
      await this.delay(3000);

      // 5. Now enable audio routing between agents
      this.bothAgentsReady = true;
      console.log('[VoiceBridge] Both agents ready - audio routing enabled');

      // 6. Run conversation loop - agents communicate via audio
      // The routing happens in the audio callbacks
      const maxWaitTime = goal.maxTurns * 15000; // 15 seconds per turn max
      const loopStartTime = Date.now();

      while (!this.shouldStop && !this.goalAchieved && Date.now() - loopStartTime < maxWaitTime) {
        await this.delay(1000);

        // Check for goal achievement in transcript
        if (this.checkGoalInTranscript()) {
          this.goalAchieved = true;
          break;
        }

        // Check turn limit
        if (this.turnCount >= goal.maxTurns) {
          console.log('[VoiceBridge] Max turns reached');
          break;
        }
      }

      // Check success criteria
      if (!this.goalAchieved) {
        this.goalAchieved = this.checkSuccessCriteria(goal.successCriteria);
      }

      const result: VoiceTestResult = {
        id: generateId(),
        goalId: goal.id,
        goalName: goal.name,
        status: this.goalAchieved ? 'passed' : 'failed',
        goalAchieved: this.goalAchieved,
        transcript: this.transcript,
        turnsUsed: this.turnCount,
        durationMs: Date.now() - startTime,
        issues,
        metadata: {
          testerAgentId: testerConfig.appId,
          botAgentId: botAppId,
          language: goal.language,
          testMode: 'voice',
        },
      };

      this.callbacks.onComplete?.(result);
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[VoiceBridge] Test error:', errorMsg);

      issues.push({
        id: generateId(),
        severity: 'critical',
        category: 'response_quality',
        description: `Voice test error: ${errorMsg}`,
        scenarioId: goal.id,
        turnNumber: -1,
        expected: 'Successful voice test',
        actual: errorMsg,
      });

      const result: VoiceTestResult = {
        id: generateId(),
        goalId: goal.id,
        goalName: goal.name,
        status: 'error',
        goalAchieved: false,
        transcript: this.transcript,
        turnsUsed: this.turnCount,
        durationMs: Date.now() - startTime,
        issues,
        metadata: {
          testerAgentId: testerConfig.appId,
          botAgentId: botAppId,
          language: goal.language,
          testMode: 'voice',
        },
      };

      this.callbacks.onError?.(error instanceof Error ? error : new Error(errorMsg));
      this.callbacks.onComplete?.(result);
      return result;

    } finally {
      await this.cleanup();
      this.isRunning = false;
    }
  }

  /**
   * Initialize tester agent in voice mode
   */
  private async initializeTesterAgent(appId: string, version: number | undefined, goal: VoiceTestGoal): Promise<void> {
    const config = {
      user_identifier_type: UserIdentifierType.CUSTOM,
      user_identifier: `tester-${Date.now()}`,
      org_id: this.apiConfig.orgId,
      workspace_id: this.apiConfig.workspaceId,
      app_id: appId,
      interaction_type: InteractionType.CALL,
      sample_rate: 16000 as const,
      version,
    };

    this.testerAgent = new ConversationAgent({
      apiKey: this.apiConfig.apiKey,
      config,
      textCallback: async (msg: TextMessage) => {
        console.log('[TESTER TEXT]', JSON.stringify(msg));
        if (msg.text) {
          this.currentTesterText += msg.text;
        }
      },
      audioCallback: async (msg: ServerAudioChunkMsg) => {
        if (!msg.audio_base64) return;

        console.log('[TESTER AUDIO] format:', msg.format, 'rate:', msg.sample_rate, 'len:', msg.audio_base64.length);

        // Play locally (no queue)
        if (this.options.playAudio) {
          playAudioChunk(msg.audio_base64, msg.sample_rate || 16000);
        }

        // Route audio to bot
        if (this.options.routeAudio && this.bothAgentsReady && this.botAgent) {
          try {
            const audioData = base64ToUint8Array(msg.audio_base64);
            console.log('[TESTER->BOT] Sending', audioData.length, 'bytes');
            await this.botAgent.sendAudio(audioData);
          } catch (e) {
            console.log('[TESTER->BOT] Send failed:', e);
          }
        }
      },
      eventCallback: async (event: ConversationEvent) => {
        console.log('[TESTER EVENT]', event.type, JSON.stringify(event.data || {}));

        if (event.type === 'server.event.user_speech_end') {
          // Log accumulated text
          if (this.currentTesterText.trim()) {
            console.log('\n========== TESTER SAYS ==========');
            console.log(this.currentTesterText.trim());
            console.log('==================================\n');
            this.transcript.push({
              speaker: 'tester',
              text: this.currentTesterText.trim(),
              timestamp: Date.now(),
            });
            this.callbacks.onTesterMessage?.(this.currentTesterText.trim());
            if (this.currentTesterText.includes('GOAL_ACHIEVED')) {
              this.goalAchieved = true;
            }
            this.currentTesterText = '';
            this.turnCount++;
          }
        } else if (event.type === 'server.action.interaction_end') {
          console.log('[VoiceBridge] Tester ended');
          this.testerEnded = true;
          this.checkBothEnded();
        }
      },
    });

    await this.testerAgent.start();
    const connected = await this.testerAgent.waitForConnect(10000);

    if (!connected) {
      throw new Error('Failed to connect to Tester Agent');
    }

    console.log('[VoiceBridge] Tester agent connected');
  }

  /**
   * Initialize bot agent in voice mode
   */
  private async initializeBotAgent(appId: string, version?: number): Promise<void> {
    const config = {
      user_identifier_type: UserIdentifierType.CUSTOM,
      user_identifier: `bot-test-${Date.now()}`,
      org_id: this.apiConfig.orgId,
      workspace_id: this.apiConfig.workspaceId,
      app_id: appId,
      interaction_type: InteractionType.CALL,
      sample_rate: 16000 as const,
      version,
    };

    this.botAgent = new ConversationAgent({
      apiKey: this.apiConfig.apiKey,
      config,
      textCallback: async (msg: TextMessage) => {
        console.log('[BOT TEXT]', JSON.stringify(msg));
        if (msg.text) {
          this.currentBotText += msg.text;
        }
      },
      audioCallback: async (msg: ServerAudioChunkMsg) => {
        if (!msg.audio_base64) return;

        console.log('[BOT AUDIO] format:', msg.format, 'rate:', msg.sample_rate, 'len:', msg.audio_base64.length);

        // Play locally (no queue)
        if (this.options.playAudio) {
          playAudioChunk(msg.audio_base64, msg.sample_rate || 16000);
        }

        // Route audio to tester
        if (this.options.routeAudio && this.bothAgentsReady && this.testerAgent) {
          try {
            const audioData = base64ToUint8Array(msg.audio_base64);
            console.log('[BOT->TESTER] Sending', audioData.length, 'bytes');
            await this.testerAgent.sendAudio(audioData);
          } catch (e) {
            console.error('[BOT->TESTER] Error:', e);
          }
        }
      },
      eventCallback: async (event: ConversationEvent) => {
        console.log('[BOT EVENT]', event.type, JSON.stringify(event.data || {}));

        if (event.type === 'server.event.state_transition') {
          if (event.data && typeof event.data === 'object' && 'state' in event.data) {
            this.currentState = String((event.data as { state: unknown }).state);
            this.callbacks.onStateChange?.(this.currentState);
          }
        } else if (event.type === 'server.event.user_speech_end') {
          // Bot received end of tester's speech - log accumulated bot text
          if (this.currentBotText.trim()) {
            console.log('\n************ BOT SAYS ************');
            console.log(this.currentBotText.trim());
            console.log('**********************************\n');
            this.transcript.push({
              speaker: 'bot',
              text: this.currentBotText.trim(),
              timestamp: Date.now(),
            });
            this.callbacks.onBotMessage?.(this.currentBotText.trim());
            this.currentBotText = '';
          }
        } else if (event.type === 'server.action.interaction_end') {
          console.log('[VoiceBridge] Bot ended');
          this.botEnded = true;
          this.checkBothEnded();
        }
      },
    });

    await this.botAgent.start();
    const connected = await this.botAgent.waitForConnect(10000);

    if (!connected) {
      throw new Error('Failed to connect to Bot Agent');
    }

    console.log('[VoiceBridge] Bot agent connected');
  }

  /**
   * Check if goal keywords are in transcript
   */
  private checkGoalInTranscript(): boolean {
    const fullText = this.transcript.map(t => t.text.toLowerCase()).join(' ');
    return fullText.includes('goal_achieved') || fullText.includes('goal achieved');
  }

  /**
   * Check if success criteria are met in transcript
   */
  private checkSuccessCriteria(criteria: string[]): boolean {
    const fullText = this.transcript
      .map(t => t.text.toLowerCase())
      .join(' ');

    return criteria.some(pattern =>
      fullText.includes(pattern.toLowerCase())
    );
  }

  /**
   * Check if both agents ended - mark test as passed
   */
  private checkBothEnded(): void {
    if (this.botEnded && this.testerEnded) {
      console.log('[VoiceBridge] Both agents ended - TEST PASSED!');
      this.goalAchieved = true;
      this.shouldStop = true;
    }
  }

  /**
   * Stop the test
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Force stop - immediately disconnect all agents
   */
  async forceStop(): Promise<void> {
    console.log('[VoiceBridge] Force stopping...');
    this.shouldStop = true;
    this.isRunning = false;
    await this.cleanup();
  }

  /**
   * Check if test is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    if (this.botAgent) {
      try {
        await this.botAgent.stop();
      } catch (e) {
        console.warn('[VoiceBridge] Error stopping bot agent:', e);
      }
      this.botAgent = null;
    }

    if (this.testerAgent) {
      try {
        await this.testerAgent.stop();
      } catch (e) {
        console.warn('[VoiceBridge] Error stopping tester agent:', e);
      }
      this.testerAgent = null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create voice test goals from scenarios
 */
export function scenarioToVoiceGoal(scenario: {
  id: string;
  name: string;
  description: string;
  language: string;
  endGoal?: string;
  successPatterns?: string[];
  tags: string[];
}): VoiceTestGoal {
  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    language: scenario.language,
    persona: 'Restaurant customer',
    goal: scenario.endGoal || scenario.description,
    successCriteria: scenario.successPatterns || ['confirm', 'booked', 'success'],
    maxTurns: 10,
    tags: scenario.tags,
  };
}
