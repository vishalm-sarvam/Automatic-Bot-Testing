import { createFileRoute, Navigate, Link } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { useTestStore } from '@/stores/testStore';
import {
  Play,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Sparkles,
  FileText,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Square,
  MessageSquare,
  Bot,
  User
} from 'lucide-react';
import { generateId } from '@/lib/utils';
import type { TestScenario, BotState, BotResponse, TestResult } from '@/types';
import { generateTestScenarios } from '@/services/openRouter';
import { createTestRunner } from '@/services/testRunner';

function ScenariosPage() {
  const { isAuthenticated } = useAuthStore();
  const { botConfig, apiConfig, getApiConfigWithFreshToken } = useConfigStore();
  const {
    scenarios,
    setScenarios,
    addScenario,
    updateScenario,
    removeScenario,
    addResult,
    setRunning,
    isRunning,
    isGeneratingScenarios,
    setGeneratingScenarios
  } = useTestStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [scenarioCount, setScenarioCount] = useState(5);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [currentResponses, setCurrentResponses] = useState<Record<string, BotResponse[]>>({});
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Array<{ speaker: 'user' | 'bot'; text: string }>>([]);

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  const addLogEntry = useCallback((message: string) => {
    setExecutionLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  }, []);

  const runSingleScenario = useCallback(async (scenario: TestScenario) => {
    // Get fresh config with API token from environment
    const freshApiConfig = getApiConfigWithFreshToken();

    console.log('[Scenarios] Run clicked. freshApiConfig:', freshApiConfig);
    console.log('[Scenarios] botConfig:', botConfig?.app_id, botConfig?.app_name);

    if (!freshApiConfig || !botConfig) {
      addLogEntry('Error: Missing API or bot configuration');
      console.error('[Scenarios] Missing config:', { hasApiConfig: !!freshApiConfig, hasBotConfig: !!botConfig });
      return;
    }

    if (!freshApiConfig.apiKey) {
      addLogEntry('Error: Sarvam API token not configured. Set VITE_SARVAM_API_TOKEN in .env');
      console.error('[Scenarios] Missing API key - check VITE_SARVAM_API_TOKEN env var');
      return;
    }

    setRunning(true);
    setRunningScenarioId(scenario.id);
    setExpandedScenario(scenario.id);
    setExecutionLog([]);
    setConversationMessages([]);
    setCurrentResponses(prev => ({ ...prev, [scenario.id]: [] }));
    updateScenario(scenario.id, { status: 'running' });

    addLogEntry(`Starting scenario: ${scenario.name}`);

    const runner = createTestRunner(freshApiConfig, {
      onScenarioStart: (s) => {
        addLogEntry(`Connecting to bot: ${botConfig.app_name}...`);
      },
      onTurnStart: (turnIndex, turn) => {
        addLogEntry(`[User ${turnIndex + 1}] ${turn.text}`);
        // Add user message to conversation display
        setConversationMessages(prev => [...prev, { speaker: 'user', text: turn.text }]);
      },
      onBotResponse: (response) => {
        addLogEntry(`[Bot] ${response.text.substring(0, 100)}${response.text.length > 100 ? '...' : ''}`);
        setCurrentResponses(prev => ({
          ...prev,
          [scenario.id]: [...(prev[scenario.id] || []), response]
        }));
        // Add bot message to conversation display
        setConversationMessages(prev => [...prev, { speaker: 'bot', text: response.text }]);
      },
      onUserMessageGenerated: (message, reasoning) => {
        addLogEntry(`[AI Reasoning] ${reasoning}`);
      },
      onStateChange: (state) => {
        addLogEntry(`[State] → ${state}`);
      },
      onScenarioComplete: (result) => {
        addLogEntry(`✓ Scenario completed: ${result.status} (${result.durationSeconds.toFixed(2)}s)`);
        updateScenario(scenario.id, { status: result.status === 'error' ? 'error' : result.status });
        addResult(result);
      },
      onError: (error) => {
        addLogEntry(`✗ Error: ${error.message}`);
      },
    });

    try {
      await runner.runScenario(scenario, {
        appId: botConfig.app_id,
        version: botConfig.app_version,
        timeout: 30000,
        delayBetweenTurns: 1500,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      addLogEntry(`Execution failed: ${msg}`);
      updateScenario(scenario.id, { status: 'error' });
    } finally {
      setRunning(false);
      setRunningScenarioId(null);
    }
  }, [getApiConfigWithFreshToken, botConfig, addLogEntry, updateScenario, addResult, setRunning]);

  const runAllScenarios = useCallback(async () => {
    const freshApiConfig = getApiConfigWithFreshToken();
    if (!freshApiConfig || !botConfig) {
      addLogEntry('Error: Missing API or bot configuration');
      return;
    }

    setRunning(true);
    setExecutionLog([]);
    addLogEntry(`Running ${scenarios.length} scenarios...`);

    for (const scenario of scenarios) {
      await runSingleScenario(scenario);
      // Small delay between scenarios
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    addLogEntry('All scenarios completed');
    setRunning(false);
  }, [getApiConfigWithFreshToken, botConfig, scenarios, addLogEntry, runSingleScenario, setRunning]);

  const stopExecution = useCallback(() => {
    setRunning(false);
    setRunningScenarioId(null);
    addLogEntry('Execution stopped by user');
  }, [addLogEntry, setRunning]);

  const generateScenariosWithAI = async () => {
    if (!botConfig || !apiConfig) return;

    // Get fresh config with API token
    const freshApiConfig = getApiConfigWithFreshToken();
    if (!freshApiConfig) {
      setGenerationError('API configuration not available');
      return;
    }

    setGeneratingScenarios(true);
    setGenerationError(null);

    try {
      // Use OpenRouter for scenario generation
      console.log('[Scenarios] Generating with OpenRouter...');
      const generatedScenarios = await generateTestScenarios(botConfig, scenarioCount);

      setScenarios(generatedScenarios);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Failed to generate scenarios');
      console.error('Error generating scenarios:', err);
    } finally {
      setGeneratingScenarios(false);
    }
  };

  const generateBasicScenarios = async () => {
    if (!botConfig) return;

    setGeneratingScenarios(true);
    setGenerationError(null);

    // Generate basic scenarios from state graph
    const states = botConfig.llm_config?.agent_config?.states || {};
    const initialState = botConfig.llm_config?.agent_config?.initial_state_name || '';

    const generatedScenarios: TestScenario[] = [];

    // Generate happy path scenarios for each main flow
    const stateEntries = Object.entries(states);

    for (const [stateName, stateData] of stateEntries) {
      const state = stateData as BotState;
      const scenario: TestScenario = {
        id: generateId(),
        name: `Test ${stateName}`,
        description: `Test scenario for ${stateName} state`,
        language: botConfig.language_config?.initial_language_name || 'English',
        turns: [
          {
            id: generateId(),
            speaker: 'user',
            text: `[Trigger for ${stateName}]`,
            expectedIntent: stateName.toLowerCase(),
          },
        ],
        expectedStates: [initialState, stateName],
        expectedVariables: {},
        expectedToolCalls: state.tool_names,
        tags: ['auto-generated', stateName.toLowerCase()],
        status: 'pending',
      };

      generatedScenarios.push(scenario);
    }

    setScenarios(generatedScenarios);
    setGeneratingScenarios(false);
  };

  // Use Sarvam AI to generate scenarios
  const generateScenarios = generateScenariosWithAI;

  const addManualScenario = () => {
    const newScenario: TestScenario = {
      id: generateId(),
      name: 'New Test Scenario',
      description: 'Describe this test scenario',
      language: botConfig?.language_config?.initial_language_name || 'English',
      turns: [],
      expectedStates: [],
      expectedVariables: {},
      expectedToolCalls: [],
      tags: ['manual'],
      status: 'pending',
    };
    addScenario(newScenario);
  };

  const getStatusIcon = (status: TestScenario['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'running':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-warning" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Scenarios</h1>
          <p className="text-muted-foreground">
            Generate and manage test scenarios for your bot
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Count:</label>
            <select
              className="input h-9 w-20"
              value={scenarioCount}
              onChange={(e) => setScenarioCount(parseInt(e.target.value))}
              disabled={isGeneratingScenarios}
            >
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>
          <button
            className="btn-outline"
            onClick={addManualScenario}
            disabled={!botConfig}
          >
            <Plus className="h-4 w-4" />
            Add Manual
          </button>

          <button
            className="btn-primary"
            onClick={generateScenarios}
            disabled={!botConfig || isGeneratingScenarios}
            title="Generate scenarios using Sarvam AI"
          >
            {isGeneratingScenarios ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate with Sarvam
              </>
            )}
          </button>
        </div>
      </div>

      {/* Generation Error */}
      {generationError && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive border-2 border-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{generationError}</span>
        </div>
      )}

      {/* AI Info Banner */}
      {!scenarios.length && botConfig && (
        <div className="flex items-center gap-3 p-4 bg-accent/50 border-2 border-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">AI-Powered Testing</p>
            <p className="text-sm text-muted-foreground">
              Using AI to generate realistic test scenarios and dynamically respond during conversations.
            </p>
          </div>
        </div>
      )}

      {/* API Config Warning */}
      {botConfig && !getApiConfigWithFreshToken()?.apiKey && (
        <div className="flex items-center gap-3 p-4 bg-warning/20 border-2 border-warning text-warning">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <p className="font-medium">API Token Missing</p>
            <p className="text-sm opacity-80">
              Sarvam API token is required to run tests. Add VITE_SARVAM_API_TOKEN to your environment.
            </p>
          </div>
        </div>
      )}

      {!botConfig && (
        <div className="card p-6 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">No Bot Configuration</h3>
          <p className="text-muted-foreground mb-4">
            Load a bot configuration first to generate test scenarios.
          </p>
          <Link to="/config" className="btn-primary">
            Load Configuration
          </Link>
        </div>
      )}

      {botConfig && scenarios.length === 0 && (
        <div className="card p-6 text-center">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">No Test Scenarios</h3>
          <p className="text-muted-foreground mb-4">
            Generate scenarios from your bot configuration or add them manually.
          </p>
          <button className="btn-primary" onClick={generateScenarios}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Scenarios
          </button>
        </div>
      )}

      {scenarios.length > 0 && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold">{scenarios.length}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-success">
                {scenarios.filter((s) => s.status === 'passed').length}
              </p>
              <p className="text-sm text-muted-foreground">Passed</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-destructive">
                {scenarios.filter((s) => s.status === 'failed').length}
              </p>
              <p className="text-sm text-muted-foreground">Failed</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-muted-foreground">
                {scenarios.filter((s) => s.status === 'pending').length}
              </p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </div>

          {/* Scenarios List */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-lg">Scenarios ({scenarios.length})</h2>
                {isRunning ? (
                  <button className="btn-destructive" onClick={stopExecution}>
                    <Square className="h-4 w-4" />
                    Stop
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={runAllScenarios}
                    disabled={!apiConfig || scenarios.length === 0}
                  >
                    <Play className="h-4 w-4" />
                    Run All Tests
                  </button>
                )}
              </div>
            </div>
            <div className="divide-y">
              {scenarios.map((scenario) => (
                <div
                  key={scenario.id}
                  className="p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getStatusIcon(scenario.status)}
                      <div>
                        <h3 className="font-medium">{scenario.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {scenario.description}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {scenario.tags.map((tag) => (
                            <span key={tag} className="badge-outline text-xs">
                              {tag}
                            </span>
                          ))}
                          <span className="badge-secondary text-xs">
                            {scenario.language}
                          </span>
                          <span className="badge-secondary text-xs">
                            {scenario.turns.length} turns
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="btn-ghost p-2"
                        title="Edit scenario"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        className="btn-ghost p-2"
                        onClick={() => removeScenario(scenario.id)}
                        title="Delete scenario"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                      {runningScenarioId === scenario.id ? (
                        <button
                          className="btn-destructive p-2"
                          onClick={stopExecution}
                          title="Stop execution"
                        >
                          <Square className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          className="btn-outline p-2"
                          disabled={isRunning}
                          onClick={() => runSingleScenario(scenario)}
                          title="Run this scenario"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Conversation View */}
                  {expandedScenario === scenario.id && (runningScenarioId === scenario.id || conversationMessages.length > 0) && (
                    <div className="mt-4 border-t-2 border-foreground pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Conversation Panel */}
                        <div className="space-y-2">
                          <h4 className="font-semibold flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" />
                            Conversation
                          </h4>
                          <div className="bg-background border-2 border-foreground p-3 h-64 overflow-y-auto space-y-3">
                            {conversationMessages.length === 0 && (
                              <p className="text-muted-foreground text-sm">Waiting for conversation...</p>
                            )}
                            {conversationMessages.map((msg, idx) => (
                              <div
                                key={idx}
                                className={`flex gap-2 ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                              >
                                {msg.speaker === 'bot' && (
                                  <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground flex items-center justify-center">
                                    <Bot className="h-4 w-4" />
                                  </div>
                                )}
                                <div
                                  className={`max-w-[80%] p-2 text-sm ${
                                    msg.speaker === 'user'
                                      ? 'bg-primary text-primary-foreground'
                                      : 'bg-muted'
                                  }`}
                                >
                                  {msg.text}
                                </div>
                                {msg.speaker === 'user' && (
                                  <div className="flex-shrink-0 w-6 h-6 bg-accent flex items-center justify-center">
                                    <User className="h-4 w-4" />
                                  </div>
                                )}
                              </div>
                            ))}
                            {runningScenarioId === scenario.id && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Processing...</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Execution Log Panel */}
                        <div className="space-y-2">
                          <h4 className="font-semibold flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Execution Log
                          </h4>
                          <div className="bg-background border-2 border-foreground p-3 h-64 overflow-y-auto font-mono text-xs">
                            {executionLog.length === 0 && (
                              <p className="text-muted-foreground">No logs yet...</p>
                            )}
                            {executionLog.map((log, idx) => (
                              <div key={idx} className="py-0.5 text-muted-foreground">
                                {log}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute('/scenarios')({
  component: ScenariosPage,
});
