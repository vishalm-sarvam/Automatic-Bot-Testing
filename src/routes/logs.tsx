import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { useTestStore } from '@/stores/testStore';
import {
  fetchInteractionIds,
  fetchInteractionEvents,
  parseInteractionLog,
  aggregateAnalysis,
  formatDateForApi,
  type ParsedInteraction,
  type AggregatedAnalysis,
} from '@/services/sarvamLogAnalyzer';
import {
  Search,
  Loader2,
  Calendar,
  Clock,
  MessageSquare,
  Zap,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Download,
  Activity,
  BarChart3,
  Bug,
  GitBranch,
  ArrowRight,
  Play,
  Square,
  Mic,
  MicOff,
  Variable,
  CheckCircle,
  XCircle,
} from 'lucide-react';

function LogsPage() {
  const { isAuthenticated } = useAuthStore();
  const { botConfig, apiConfig } = useConfigStore();
  const { isFetchingLogs, setFetchingLogs } = useTestStore();

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [userIdentifier, setUserIdentifier] = useState('vishalm@sarvam.ai');
  const [error, setError] = useState<string | null>(null);

  const [interactionIds, setInteractionIds] = useState<string[]>([]);
  const [parsedInteractions, setParsedInteractions] = useState<ParsedInteraction[]>([]);
  const [aggregatedData, setAggregatedData] = useState<AggregatedAnalysis | null>(null);
  const [expandedInteraction, setExpandedInteraction] = useState<string | null>(null);

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  const fetchLogs = async () => {
    if (!botConfig || !apiConfig) {
      setError('Bot configuration required');
      return;
    }

    setFetchingLogs(true);
    setError(null);
    setParsedInteractions([]);
    setAggregatedData(null);

    try {
      // Format date
      const dateStr = selectedDate.replace(/-/g, '');

      // Fetch interaction IDs
      const ids = await fetchInteractionIds(
        apiConfig.orgId,
        apiConfig.workspaceId,
        botConfig.app_id,
        userIdentifier,
        dateStr
      );

      setInteractionIds(ids);

      if (ids.length === 0) {
        setError('No interactions found for this date');
        setFetchingLogs(false);
        return;
      }

      // Fetch and parse each interaction
      const parsed: ParsedInteraction[] = [];
      for (const id of ids) {
        try {
          const log = await fetchInteractionEvents(
            apiConfig.orgId,
            apiConfig.workspaceId,
            botConfig.app_id,
            id
          );
          parsed.push(parseInteractionLog(log));
        } catch (err) {
          console.error(`Failed to fetch interaction ${id}:`, err);
        }
      }

      setParsedInteractions(parsed);
      setAggregatedData(aggregateAnalysis(parsed));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    } finally {
      setFetchingLogs(false);
    }
  };

  const exportLogs = () => {
    if (!aggregatedData) return;

    const report = {
      exportedAt: new Date().toISOString(),
      date: selectedDate,
      userIdentifier,
      appId: botConfig?.app_id,
      summary: aggregatedData,
      interactions: parsedInteractions,
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sarvam-logs-${selectedDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Log Analyzer</h1>
          <p className="text-muted-foreground">
            Analyze Sarvam interaction logs for insights
          </p>
        </div>
      </div>

      {/* Search Controls */}
      <div className="card p-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              className="input w-full"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">User Identifier</label>
            <input
              type="text"
              className="input w-full"
              value={userIdentifier}
              onChange={(e) => setUserIdentifier(e.target.value)}
              placeholder="email or user ID"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">App</label>
            <input
              type="text"
              className="input w-full bg-muted"
              value={botConfig?.app_name || 'No bot configured'}
              disabled
            />
          </div>
          <button
            className="btn-primary h-10"
            onClick={fetchLogs}
            disabled={isFetchingLogs || !botConfig}
          >
            {isFetchingLogs ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Fetch Logs
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive border-2 border-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregated Stats */}
      {aggregatedData && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Analysis Summary</h2>
            <button className="btn-outline" onClick={exportLogs}>
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-6 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Interactions</span>
              </div>
              <p className="text-3xl font-bold">{aggregatedData.totalInteractions}</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm text-muted-foreground">Goals Achieved</span>
              </div>
              <p className="text-3xl font-bold text-green-600">
                {parsedInteractions.filter(i => i.goalAchieved).length}
                <span className="text-lg text-muted-foreground">/{parsedInteractions.length}</span>
              </p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                <span className="text-sm text-muted-foreground">Messages</span>
              </div>
              <p className="text-3xl font-bold">{aggregatedData.totalMessages}</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <span className="text-sm text-muted-foreground">Tool Calls</span>
              </div>
              <p className="text-3xl font-bold">{aggregatedData.totalToolCalls}</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Avg Duration</span>
              </div>
              <p className="text-3xl font-bold">
                {(aggregatedData.avgDurationMs / 1000).toFixed(1)}s
              </p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bug className="h-5 w-5 text-destructive" />
                <span className="text-sm text-muted-foreground">Issues</span>
              </div>
              <p className="text-3xl font-bold text-destructive">
                {aggregatedData.allIssues.length}
              </p>
            </div>
          </div>

          {/* Tool & State Frequency */}
          <div className="grid grid-cols-3 gap-6">
            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-lg">Tool Usage</h3>
              </div>
              <div className="p-4 space-y-2">
                {Object.entries(aggregatedData.toolFrequency)
                  .sort(([, a], [, b]) => b - a)
                  .map(([tool, count]) => (
                    <div key={tool} className="flex items-center gap-3">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span className="flex-1 font-mono text-sm">{tool}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
                {Object.keys(aggregatedData.toolFrequency).length === 0 && (
                  <p className="text-muted-foreground">No tool calls</p>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-lg">State Visits</h3>
              </div>
              <div className="p-4 space-y-2">
                {Object.entries(aggregatedData.stateFrequency)
                  .sort(([, a], [, b]) => b - a)
                  .map(([state, count]) => (
                    <div key={state} className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-primary" />
                      <span className="flex-1">{state}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ))}
                {Object.keys(aggregatedData.stateFrequency).length === 0 && (
                  <p className="text-muted-foreground">No states tracked</p>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-lg flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-blue-500" />
                  State Transitions
                </h3>
              </div>
              <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
                {(() => {
                  // Aggregate transition patterns
                  const transitionCounts: Record<string, number> = {};
                  for (const interaction of parsedInteractions) {
                    for (const t of interaction.stateTransitions) {
                      const key = `${t.from} → ${t.to}`;
                      transitionCounts[key] = (transitionCounts[key] || 0) + 1;
                    }
                  }
                  const entries = Object.entries(transitionCounts).sort(([, a], [, b]) => b - a);

                  if (entries.length === 0) {
                    return <p className="text-muted-foreground">No transitions tracked</p>;
                  }

                  return entries.map(([transition, count]) => (
                    <div key={transition} className="flex items-center gap-2 text-sm">
                      <ArrowRight className="h-3 w-3 text-blue-500 flex-shrink-0" />
                      <span className="flex-1 font-mono text-xs truncate">{transition}</span>
                      <span className="font-bold">{count}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Issues Summary */}
          {aggregatedData.allIssues.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Issues Detected ({aggregatedData.allIssues.length})
                </h3>
              </div>
              <div className="divide-y">
                {aggregatedData.allIssues.slice(0, 10).map((issue) => (
                  <div key={issue.id} className="p-3 flex items-start gap-3">
                    <div className={`w-2 h-2 mt-2 ${
                      issue.severity === 'critical' ? 'bg-red-500' :
                      issue.severity === 'high' ? 'bg-orange-500' :
                      issue.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                    }`} />
                    <div>
                      <p className="font-medium">{issue.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {issue.category.replace(/_/g, ' ')} | {issue.severity}
                      </p>
                    </div>
                  </div>
                ))}
                {aggregatedData.allIssues.length > 10 && (
                  <div className="p-3 text-center text-muted-foreground">
                    +{aggregatedData.allIssues.length - 10} more issues
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Individual Interactions */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title text-lg">Interactions ({parsedInteractions.length})</h3>
            </div>
            <div className="divide-y">
              {parsedInteractions.map((interaction) => (
                <div key={interaction.interactionId} className="p-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedInteraction(
                      expandedInteraction === interaction.interactionId
                        ? null
                        : interaction.interactionId
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-mono text-sm">{interaction.interactionId}</p>
                        <p className="text-xs text-muted-foreground">
                          {interaction.startTime.toLocaleTimeString()} |{' '}
                          {(interaction.durationMs / 1000).toFixed(1)}s |{' '}
                          {interaction.messages.length} messages |{' '}
                          {interaction.toolCalls.length} tool calls
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {interaction.issues.length > 0 && (
                        <span className="badge-destructive text-xs">
                          {interaction.issues.length} issues
                        </span>
                      )}
                      {expandedInteraction === interaction.interactionId ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedInteraction === interaction.interactionId && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {/* Goal Status */}
                      <div className="flex items-center gap-2 p-2 bg-muted rounded">
                        {interaction.goalAchieved ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className={`font-medium ${interaction.goalAchieved ? 'text-green-600' : 'text-red-600'}`}>
                          {interaction.goalAchieved ? 'Goal Achieved' : 'Goal Not Achieved'}
                        </span>
                        {interaction.goalDetails && (
                          <span className="text-sm text-muted-foreground">— {interaction.goalDetails}</span>
                        )}
                      </div>

                      {/* State Transitions Timeline */}
                      {interaction.stateTransitions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-blue-500" />
                            State Transitions ({interaction.stateTransitions.length})
                          </h4>
                          <div className="bg-muted p-3 rounded space-y-2">
                            {interaction.stateTransitions.map((transition, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <span className="badge-secondary text-xs font-mono">{transition.from}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="badge-primary text-xs font-mono">{transition.to}</span>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  seq: {transition.seqId}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* States */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">States Visited</h4>
                        <div className="flex flex-wrap gap-2">
                          {interaction.states.map((state, idx) => (
                            <span key={idx} className="badge-secondary text-xs">
                              {state}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Tool Calls with Reasoning */}
                      {interaction.toolCalls.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Tool Calls</h4>
                          <div className="space-y-3">
                            {interaction.toolCalls.map((tool, idx) => (
                              <div key={idx} className="bg-muted p-2 text-sm">
                                <div className="flex items-center gap-2">
                                  <Zap className="h-3 w-3 text-yellow-500" />
                                  <span className="font-mono font-semibold">{tool.name}</span>
                                  <span className="text-muted-foreground">
                                    ({(tool.durationMs / 1000).toFixed(2)}s)
                                  </span>
                                </div>
                                {tool.reasoning && (
                                  <p className="text-xs text-muted-foreground mt-1 pl-5">
                                    Reasoning: {tool.reasoning}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tool LLM Decisions */}
                      {interaction.toolLLMDecisions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Bot Reasoning (Tool LLM)</h4>
                          <div className="space-y-2 bg-muted p-2 max-h-48 overflow-y-auto">
                            {interaction.toolLLMDecisions.map((decision, idx) => (
                              <div key={idx} className="text-xs font-mono">
                                <p className="text-muted-foreground">Input: {decision.inputText}</p>
                                <p className="text-primary">Decision: {decision.decision}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Messages */}
                      <div>
                        <h4 className="text-sm font-semibold mb-2">Conversation</h4>
                        <div className="bg-muted p-3 space-y-2 max-h-64 overflow-y-auto">
                          {interaction.messages.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`text-sm ${
                                msg.role === 'user' ? 'text-primary' : ''
                              }`}
                            >
                              <span className="font-semibold">
                                {msg.role === 'user' ? 'User' : 'Bot'}:
                              </span>{' '}
                              {msg.text}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Variables */}
                      {Object.keys(interaction.variables).length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Variables</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(interaction.variables)
                              .filter(([, v]) => v)
                              .map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="text-muted-foreground">{key}:</span>
                                  <span className="font-mono">{value}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Variable Updates Timeline */}
                      {interaction.variableUpdates.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Variable className="h-4 w-4 text-purple-500" />
                            Variable Updates ({interaction.variableUpdates.length})
                          </h4>
                          <div className="bg-muted p-3 rounded space-y-2 max-h-48 overflow-y-auto">
                            {interaction.variableUpdates.map((update, idx) => (
                              <div key={idx} className="text-sm border-l-2 border-purple-500 pl-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-purple-600">{update.variable}</span>
                                  <span className="text-xs text-muted-foreground">in {update.state}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground line-through">{update.oldValue || '(empty)'}</span>
                                  <ArrowRight className="h-3 w-3" />
                                  <span className="text-green-600 font-medium">{update.newValue || '(empty)'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pipeline & VAD Events */}
                      {(interaction.pipelineEvents.length > 0 || interaction.vadEvents.length > 0) && (
                        <div className="grid grid-cols-2 gap-4">
                          {/* Pipeline Events */}
                          {interaction.pipelineEvents.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-green-500" />
                                Pipeline Events ({interaction.pipelineEvents.length})
                              </h4>
                              <div className="bg-muted p-2 rounded space-y-1 max-h-32 overflow-y-auto">
                                {interaction.pipelineEvents.map((event, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    {event.type === 'ready' ? (
                                      <Play className="h-3 w-3 text-green-500" />
                                    ) : (
                                      <Square className="h-3 w-3 text-red-500" />
                                    )}
                                    <span className={event.type === 'ready' ? 'text-green-600' : 'text-red-600'}>
                                      {event.type.toUpperCase()}
                                    </span>
                                    <span className="text-muted-foreground font-mono">{event.stateId}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* VAD Events */}
                          {interaction.vadEvents.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Mic className="h-4 w-4 text-orange-500" />
                                VAD Events ({interaction.vadEvents.length})
                              </h4>
                              <div className="bg-muted p-2 rounded space-y-1 max-h-32 overflow-y-auto">
                                {interaction.vadEvents.map((event, idx) => (
                                  <div key={idx} className="flex items-center gap-2 text-xs">
                                    {event.type === 'lock' ? (
                                      <MicOff className="h-3 w-3 text-orange-500" />
                                    ) : (
                                      <Mic className="h-3 w-3 text-green-500" />
                                    )}
                                    <span className={event.type === 'lock' ? 'text-orange-600' : 'text-green-600'}>
                                      VAD {event.type.toUpperCase()}
                                    </span>
                                    <span className="text-muted-foreground font-mono">{event.stateId}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* System Variables */}
                      {Object.keys(interaction.systemVariables).length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">System Variables</h4>
                          <div className="bg-muted p-2 rounded text-xs font-mono max-h-32 overflow-y-auto">
                            <pre>{JSON.stringify(interaction.systemVariables, null, 2)}</pre>
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
                        {interaction.language && (
                          <span>Language: <span className="font-medium text-foreground">{interaction.language}</span></span>
                        )}
                        {interaction.llmModel && (
                          <span>Model: <span className="font-medium text-foreground">{interaction.llmModel}</span></span>
                        )}
                        {interaction.channelType && (
                          <span>Channel: <span className="font-medium text-foreground">{interaction.channelType}</span></span>
                        )}
                        {interaction.userIdentifier && (
                          <span>User: <span className="font-medium text-foreground">{interaction.userIdentifier}</span></span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isFetchingLogs && !error && parsedInteractions.length === 0 && (
        <div className="card p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">No Logs Loaded</h3>
          <p className="text-muted-foreground">
            Select a date and fetch logs to analyze interaction data.
          </p>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute('/logs')({
  component: LogsPage,
});
