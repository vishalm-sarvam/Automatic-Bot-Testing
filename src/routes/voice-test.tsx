import { createFileRoute, Navigate, Link } from '@tanstack/react-router';
import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import {
  Mic,
  Play,
  Square,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
  Bot,
  User,
  Volume2,
  VolumeX,
  Unplug
} from 'lucide-react';
import { VoiceTestRunner, VoiceTestProgress, VoiceTestRunResult } from '@/services/voiceTestRunner';
import { VoiceTestResult, VoiceTestGoal } from '@/services/voiceBridge';
import { getAudioDebugPlayer, destroyAudioDebugPlayer } from '@/services/audioDebugPlayer';
import backupScenarios from '@/data/backupScenarios.json';

// Pre-configured Voice Tester Agent
const TESTER_AGENT_ID = 'Voice-Testi-8b5d704f-3959';

function VoiceTestPage() {
  const { isAuthenticated } = useAuthStore();
  const { botConfig, getApiConfigWithFreshToken } = useConfigStore();

  // State
  const [isRunning, setIsRunning] = useState(false);
  const [agentConfigured] = useState<boolean>(true); // Pre-configured manually
  const [progress, setProgress] = useState<VoiceTestProgress | null>(null);
  const [results, setResults] = useState<VoiceTestResult[]>([]);
  const [runResult, setRunResult] = useState<VoiceTestRunResult | null>(null);
  const [selectedScenarios, setSelectedScenarios] = useState<Set<string>>(new Set());
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runner, setRunner] = useState<VoiceTestRunner | null>(null);
  const [playAudio, setPlayAudio] = useState<boolean>(true);
  const [audioSource, setAudioSource] = useState<'bot' | 'tester' | null>(null);
  const [audioInitialized, setAudioInitialized] = useState<boolean>(false);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      destroyAudioDebugPlayer();
    };
  }, []);

  // Load scenarios as goals
  const scenarios: VoiceTestGoal[] = backupScenarios.map((s, idx) => ({
    id: `backup-${idx}`,
    name: s.name,
    description: s.description,
    language: s.language,
    persona: s.persona,
    goal: s.goal,
    successCriteria: s.successCriteria,
    maxTurns: 10,
    tags: s.tags,
  }));

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  // Toggle scenario selection
  const toggleScenario = (id: string) => {
    setSelectedScenarios(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all scenarios
  const selectAll = () => {
    setSelectedScenarios(new Set(scenarios.map(s => s.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedScenarios(new Set());
  };

  // Run voice tests
  const handleRunTests = useCallback(async () => {
    const apiConfig = getApiConfigWithFreshToken();
    if (!apiConfig || !botConfig) {
      setError('Missing API or bot configuration');
      return;
    }

    setIsRunning(true);
    setError(null);
    setResults([]);
    setRunResult(null);
    setAudioSource(null);

    // Initialize audio player (requires user gesture)
    if (playAudio) {
      try {
        const player = getAudioDebugPlayer();
        await player.init();
        setAudioInitialized(true);
        console.log('[VoiceTest] Audio player initialized');
      } catch (err) {
        console.warn('[VoiceTest] Failed to initialize audio player:', err);
      }
    }

    const testRunner = new VoiceTestRunner(apiConfig);
    setRunner(testRunner);

    // Get selected scenarios or all if none selected
    const scenariosToRun = selectedScenarios.size > 0
      ? scenarios.filter(s => selectedScenarios.has(s.id))
      : scenarios;

    try {
      const result = await testRunner.runTests({
        botConfig,
        scenarios: scenariosToRun,
        onProgress: (p) => setProgress(p),
        onResult: (r) => setResults(prev => [...prev, r]),
        onAudioPlaying: (source, duration) => {
          setAudioSource(source);
          // Clear after duration
          setTimeout(() => setAudioSource(null), duration * 1000 + 100);
        },
        bridgeOptions: {
          playAudio,
          routeAudio: true,
        },
      });

      setRunResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test execution failed');
    } finally {
      setIsRunning(false);
      setRunner(null);
      setAudioSource(null);
    }
  }, [getApiConfigWithFreshToken, botConfig, scenarios, selectedScenarios, playAudio]);

  // Stop tests
  const handleStop = useCallback(() => {
    runner?.stop();
  }, [runner]);

  // Force stop - immediately disconnect websockets
  const handleForceStop = useCallback(async () => {
    console.log('[VoiceTest] Force stopping...');
    if (runner) {
      await runner.forceStop();
    }
    // Clear audio
    const player = getAudioDebugPlayer();
    player.clearQueue();

    setIsRunning(false);
    setRunner(null);
    setAudioSource(null);
    setProgress(null);
  }, [runner]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-5 w-5 text-success" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />;
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Volume2 className="h-6 w-6" />
            Voice Testing
          </h1>
          <p className="text-muted-foreground">
            Agent-to-Agent voice testing with Dynamic Voice Simulator
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Audio Toggle */}
          <button
            className={`btn-ghost ${playAudio ? 'text-success' : 'text-muted-foreground'}`}
            onClick={() => setPlayAudio(!playAudio)}
            title={playAudio ? 'Audio playback enabled' : 'Audio playback disabled'}
          >
            {playAudio ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>

          {/* Audio Source Indicator */}
          {isRunning && audioSource && (
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full animate-pulse ${
              audioSource === 'bot' ? 'bg-primary/20 text-primary' : 'bg-accent/50 text-accent-foreground'
            }`}>
              {audioSource === 'bot' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              <span className="text-sm font-medium capitalize">{audioSource} speaking</span>
            </div>
          )}

          {isRunning ? (
            <>
              <button className="btn-secondary" onClick={handleStop}>
                <Square className="h-4 w-4" />
                Stop
              </button>
              <button className="btn-destructive" onClick={handleForceStop}>
                <Unplug className="h-4 w-4" />
                Force Disconnect
              </button>
            </>
          ) : (
            <button
              className="btn-primary"
              onClick={handleRunTests}
              disabled={!botConfig || !agentConfigured}
            >
              <Play className="h-4 w-4" />
              Run Voice Tests
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive border-2 border-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Agent Configuration Status */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-success/10">
              <Bot className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="font-medium">Tester Agent</p>
              <p className="text-sm text-muted-foreground">
                Pre-configured as User Simulator
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                {TESTER_AGENT_ID}
              </p>
            </div>
          </div>
          <span className="badge-success">Ready</span>
        </div>
      </div>

      {/* Bot Config Check */}
      {!botConfig && (
        <div className="card p-6 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">No Bot Configuration</h3>
          <p className="text-muted-foreground mb-4">
            Load a bot configuration first to run voice tests.
          </p>
          <Link to="/config" className="btn-primary">
            Load Configuration
          </Link>
        </div>
      )}

      {/* Progress Bar */}
      {progress && isRunning && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-medium">{progress.message}</span>
            <span className="text-sm text-muted-foreground">
              {progress.completedScenarios} / {progress.totalScenarios}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{
                width: progress.totalScenarios > 0
                  ? `${(progress.completedScenarios / progress.totalScenarios) * 100}%`
                  : '0%'
              }}
            />
          </div>
          {progress.currentScenario && (
            <p className="text-sm text-muted-foreground">
              Current: {progress.currentScenario}
            </p>
          )}
        </div>
      )}

      {/* Run Summary */}
      {runResult && !isRunning && (
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold">{runResult.totalTests}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-success">{runResult.passed}</p>
            <p className="text-sm text-muted-foreground">Passed</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{runResult.failed}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-warning">{runResult.errors}</p>
            <p className="text-sm text-muted-foreground">Errors</p>
          </div>
        </div>
      )}

      {/* Test Scenarios Selection */}
      {botConfig && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h2 className="card-title text-lg">Test Scenarios ({scenarios.length})</h2>
              <div className="flex gap-2">
                <button className="btn-ghost text-sm" onClick={selectAll}>
                  Select All
                </button>
                <button className="btn-ghost text-sm" onClick={clearSelection}>
                  Clear
                </button>
              </div>
            </div>
            <p className="card-description">
              Select scenarios to run or run all ({selectedScenarios.size > 0 ? selectedScenarios.size : scenarios.length} selected)
            </p>
          </div>
          <div className="divide-y max-h-96 overflow-y-auto">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className={`p-4 cursor-pointer transition-colors ${
                  selectedScenarios.has(scenario.id) ? 'bg-primary/5' : 'hover:bg-muted/50'
                }`}
                onClick={() => toggleScenario(scenario.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedScenarios.has(scenario.id)}
                    onChange={() => toggleScenario(scenario.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <h3 className="font-medium">{scenario.name}</h3>
                    <p className="text-sm text-muted-foreground">{scenario.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="badge-secondary text-xs">{scenario.language}</span>
                      <span className="badge-outline text-xs">{scenario.persona}</span>
                      {scenario.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="badge-outline text-xs">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title text-lg">Test Results</h2>
          </div>
          <div className="divide-y">
            {results.map((result) => (
              <div key={result.id} className="p-4">
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandedResult(
                    expandedResult === result.id ? null : result.id
                  )}
                >
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <h3 className="font-medium">{result.goalName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {result.turnsUsed} turns • {(result.durationMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                  </div>
                  <span className={`badge ${
                    result.status === 'passed' ? 'badge-success' :
                    result.status === 'failed' ? 'badge-destructive' : 'badge-warning'
                  }`}>
                    {result.goalAchieved ? 'Goal Achieved' : 'Goal Not Achieved'}
                  </span>
                </div>

                {/* Expanded Transcript */}
                {expandedResult === result.id && (
                  <div className="mt-4 border-t-2 border-foreground pt-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Mic className="h-4 w-4" />
                      Conversation Transcript
                    </h4>
                    <div className="bg-muted/30 p-4 space-y-3 max-h-80 overflow-y-auto">
                      {result.transcript.map((entry, idx) => (
                        <div
                          key={idx}
                          className={`flex gap-2 ${
                            entry.speaker === 'tester' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {entry.speaker === 'bot' && (
                            <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground flex items-center justify-center">
                              <Bot className="h-4 w-4" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] p-3 text-sm ${
                              entry.speaker === 'tester'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background border-2 border-foreground'
                            }`}
                          >
                            {entry.text}
                          </div>
                          {entry.speaker === 'tester' && (
                            <div className="flex-shrink-0 w-6 h-6 bg-accent flex items-center justify-center">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Issues */}
                    {result.issues.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-semibold mb-2 text-destructive">Issues Detected</h4>
                        <div className="space-y-2">
                          {result.issues.map((issue) => (
                            <div key={issue.id} className="p-2 bg-destructive/10 border border-destructive/20 text-sm">
                              <span className="font-medium">[{issue.severity}]</span> {issue.description}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute('/voice-test')({
  component: VoiceTestPage,
});
