/**
 * Voice Test Runner
 *
 * Orchestrates automated voice testing:
 * 1. Configures tester agent with user simulator prompt
 * 2. Loads test scenarios
 * 3. Runs voice tests using VoiceBridge
 * 4. Reports results
 */

import { VoiceBridge, VoiceTestGoal, VoiceTestResult, VoiceBridgeOptions } from './voiceBridge';
import type { ApiConfig, BotConfiguration } from '@/types';
import backupScenarios from '@/data/backupScenarios.json';
import { getAudioDebugPlayer } from './audioDebugPlayer';

// Voice Tester Agent ID (pre-configured)
const TESTER_AGENT_ID = 'Voice-Testi-8b5d704f-3959';
const TESTER_VERSION = 5;

export interface VoiceTestRunConfig {
  botConfig: BotConfiguration;
  scenarios?: VoiceTestGoal[];
  maxConcurrent?: number;
  onProgress?: (progress: VoiceTestProgress) => void;
  onResult?: (result: VoiceTestResult) => void;
  onAudioPlaying?: (source: 'bot' | 'tester', duration: number) => void;
  bridgeOptions?: VoiceBridgeOptions;
}

export interface VoiceTestProgress {
  totalScenarios: number;
  completedScenarios: number;
  currentScenario: string | null;
  status: 'configuring' | 'running' | 'completed' | 'error';
  message: string;
}

export interface VoiceTestRunResult {
  totalTests: number;
  passed: number;
  failed: number;
  errors: number;
  results: VoiceTestResult[];
  durationMs: number;
}

/**
 * Voice Test Runner Class
 */
export class VoiceTestRunner {
  private apiConfig: ApiConfig;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;
  private currentBridge: VoiceBridge | null = null;

  constructor(apiConfig: ApiConfig) {
    this.apiConfig = apiConfig;
  }

  /**
   * Run voice tests with automatic agent configuration
   */
  async runTests(config: VoiceTestRunConfig): Promise<VoiceTestRunResult> {
    const startTime = Date.now();
    const results: VoiceTestResult[] = [];

    this.isRunning = true;
    this.shouldStop = false;

    try {
      // 1. Configure tester agent
      config.onProgress?.({
        totalScenarios: 0,
        completedScenarios: 0,
        currentScenario: null,
        status: 'configuring',
        message: 'Configuring tester agent...',
      });

      const configured = await this.ensureTesterConfigured();
      if (!configured) {
        throw new Error('Failed to configure tester agent');
      }

      // 2. Load scenarios
      const scenarios = config.scenarios || this.loadDefaultScenarios();

      config.onProgress?.({
        totalScenarios: scenarios.length,
        completedScenarios: 0,
        currentScenario: null,
        status: 'running',
        message: `Starting ${scenarios.length} voice tests...`,
      });

      // 3. Run tests sequentially (voice tests need exclusive access)
      for (let i = 0; i < scenarios.length && !this.shouldStop; i++) {
        const scenario = scenarios[i];

        config.onProgress?.({
          totalScenarios: scenarios.length,
          completedScenarios: i,
          currentScenario: scenario.name,
          status: 'running',
          message: `Running: ${scenario.name}`,
        });

        const result = await this.runSingleTest(scenario, config.botConfig, config);
        results.push(result);
        config.onResult?.(result);

        // Small delay between tests
        await this.delay(1000);
      }

      // 4. Calculate summary
      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const errors = results.filter(r => r.status === 'error').length;

      config.onProgress?.({
        totalScenarios: scenarios.length,
        completedScenarios: scenarios.length,
        currentScenario: null,
        status: 'completed',
        message: `Completed: ${passed} passed, ${failed} failed, ${errors} errors`,
      });

      return {
        totalTests: scenarios.length,
        passed,
        failed,
        errors,
        results,
        durationMs: Date.now() - startTime,
      };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      config.onProgress?.({
        totalScenarios: 0,
        completedScenarios: 0,
        currentScenario: null,
        status: 'error',
        message: `Error: ${errorMsg}`,
      });

      throw error;

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run a single voice test
   */
  private async runSingleTest(
    goal: VoiceTestGoal,
    botConfig: BotConfiguration,
    config: VoiceTestRunConfig
  ): Promise<VoiceTestResult> {
    const bridge = new VoiceBridge(
      this.apiConfig,
      {
        onTesterMessage: (msg) => console.log(`[Tester] ${msg}`),
        onBotMessage: (msg) => console.log(`[Bot] ${msg}`),
        onStateChange: (state) => console.log(`[State] ${state}`),
        onError: (err) => console.error(`[Error] ${err.message}`),
        onAudioPlaying: config.onAudioPlaying,
      },
      config.bridgeOptions || { playAudio: true, routeAudio: true }
    );

    this.currentBridge = bridge;

    try {
      return await bridge.runVoiceTest(goal, botConfig, {
        appId: TESTER_AGENT_ID,
        version: TESTER_VERSION,
      });
    } finally {
      this.currentBridge = null;
    }
  }

  /**
   * Ensure tester agent is configured (pre-configured manually)
   */
  private async ensureTesterConfigured(): Promise<boolean> {
    // Agent is pre-configured manually, just return true
    console.log('[VoiceTestRunner] Using pre-configured tester agent:', TESTER_AGENT_ID);
    return true;
  }

  /**
   * Load default scenarios from backup
   */
  private loadDefaultScenarios(): VoiceTestGoal[] {
    return backupScenarios.map((scenario, index) => ({
      id: `backup-${index}`,
      name: scenario.name,
      description: scenario.description,
      language: scenario.language,
      persona: scenario.persona,
      goal: scenario.goal,
      successCriteria: scenario.successCriteria,
      maxTurns: 10,
      tags: scenario.tags,
    }));
  }

  /**
   * Stop running tests
   */
  stop(): void {
    this.shouldStop = true;
  }

  /**
   * Force stop - immediately disconnect all websockets
   */
  async forceStop(): Promise<void> {
    console.log('[VoiceTestRunner] Force stopping...');
    this.shouldStop = true;
    this.isRunning = false;
    if (this.currentBridge) {
      await this.currentBridge.forceStop();
      this.currentBridge = null;
    }
  }

  /**
   * Check if tests are running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get tester agent ID
   */
  getTesterAgentId(): string {
    return TESTER_AGENT_ID;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create voice test runner instance
 */
export function createVoiceTestRunner(apiConfig: ApiConfig): VoiceTestRunner {
  return new VoiceTestRunner(apiConfig);
}

/**
 * Quick function to run all backup scenarios
 */
export async function runBackupScenarios(
  apiConfig: ApiConfig,
  botConfig: BotConfiguration,
  onProgress?: (progress: VoiceTestProgress) => void
): Promise<VoiceTestRunResult> {
  const runner = new VoiceTestRunner(apiConfig);
  return runner.runTests({
    botConfig,
    onProgress,
  });
}
