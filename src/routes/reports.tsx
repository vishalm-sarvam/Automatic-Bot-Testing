import { createFileRoute, Navigate, Link } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';
import { useTestStore } from '@/stores/testStore';
import { useConfigStore } from '@/stores/configStore';
import { generateIssueSummary } from '@/services/issueDetector';
import {
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  FileText,
  Download,
  RefreshCw,
  Bug,
  Zap,
  MessageSquare,
  Globe,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';
import type { Issue, IssueCategory, TestResult } from '@/types';

const CATEGORY_LABELS: Record<IssueCategory, { label: string; icon: React.ReactNode; color: string }> = {
  translation_error: { label: 'Translation', icon: <Globe className="h-4 w-4" />, color: 'text-blue-600' },
  transliteration_error: { label: 'Transliteration', icon: <FileText className="h-4 w-4" />, color: 'text-purple-600' },
  state_transition_bug: { label: 'State Bug', icon: <Bug className="h-4 w-4" />, color: 'text-red-600' },
  tool_call_error: { label: 'Tool Error', icon: <Zap className="h-4 w-4" />, color: 'text-orange-600' },
  response_quality: { label: 'Response Quality', icon: <MessageSquare className="h-4 w-4" />, color: 'text-yellow-600' },
  latency_issue: { label: 'Latency', icon: <Clock className="h-4 w-4" />, color: 'text-cyan-600' },
  intent_mismatch: { label: 'Intent Mismatch', icon: <AlertTriangle className="h-4 w-4" />, color: 'text-pink-600' },
  entity_extraction_error: { label: 'Entity Error', icon: <FileText className="h-4 w-4" />, color: 'text-indigo-600' },
};

const SEVERITY_COLORS = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

function ReportsPage() {
  const { isAuthenticated } = useAuthStore();
  const { results, clearResults } = useTestStore();
  const { botConfig } = useConfigStore();

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  // Aggregate all issues from results
  const allIssues: Issue[] = results.flatMap(r => r.issues);
  const summary = generateIssueSummary(allIssues);

  // Calculate statistics
  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const passRate = results.length > 0 ? (passedCount / results.length) * 100 : 0;
  const avgDuration = results.length > 0
    ? results.reduce((sum, r) => sum + r.durationSeconds, 0) / results.length
    : 0;

  // Export report as JSON
  const exportReport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      botName: botConfig?.app_name || 'Unknown',
      summary: {
        totalTests: results.length,
        passed: passedCount,
        failed: failedCount,
        errors: errorCount,
        passRate: passRate.toFixed(1) + '%',
        avgDuration: avgDuration.toFixed(2) + 's',
      },
      issues: {
        total: summary.totalIssues,
        bySeverity: summary.bySeverity,
        byCategory: summary.byCategory,
        criticalIssues: summary.criticalIssues,
        recommendations: summary.recommendations,
      },
      results: results.map(r => ({
        scenario: r.scenarioName,
        status: r.status,
        duration: r.durationSeconds,
        issues: r.issues,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bot-test-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Test Reports</h1>
          <p className="text-muted-foreground">
            Analysis and insights from your test runs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="btn-outline"
            onClick={clearResults}
            disabled={results.length === 0}
          >
            <RefreshCw className="h-4 w-4" />
            Clear Results
          </button>
          <button
            className="btn-primary"
            onClick={exportReport}
            disabled={results.length === 0}
          >
            <Download className="h-4 w-4" />
            Export Report
          </button>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="card p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="font-semibold mb-2">No Test Results Yet</h3>
          <p className="text-muted-foreground mb-4">
            Run some test scenarios to see reports and analytics.
          </p>
          <Link to="/scenarios" className="btn-primary">
            Go to Test Scenarios
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-5 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Total Tests</span>
              </div>
              <p className="text-3xl font-bold">{results.length}</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span className="text-sm text-muted-foreground">Passed</span>
              </div>
              <p className="text-3xl font-bold text-success">{passedCount}</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <span className="text-sm text-muted-foreground">Failed</span>
              </div>
              <p className="text-3xl font-bold text-destructive">{failedCount}</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-sm text-muted-foreground">Pass Rate</span>
              </div>
              <p className="text-3xl font-bold">{passRate.toFixed(0)}%</p>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Avg Duration</span>
              </div>
              <p className="text-3xl font-bold">{avgDuration.toFixed(1)}s</p>
            </div>
          </div>

          {/* Issues Overview */}
          <div className="grid grid-cols-2 gap-6">
            {/* Issues by Severity */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Issues by Severity
                </h2>
              </div>
              <div className="p-4 space-y-4">
                {Object.entries(summary.bySeverity).map(([severity, count]) => (
                  <div key={severity} className="flex items-center gap-3">
                    <div className={`w-3 h-3 ${SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]}`} />
                    <span className="capitalize flex-1">{severity}</span>
                    <span className="font-bold">{count}</span>
                    <div className="w-32 h-2 bg-muted overflow-hidden">
                      <div
                        className={`h-full ${SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS]}`}
                        style={{
                          width: summary.totalIssues > 0
                            ? `${(count / summary.totalIssues) * 100}%`
                            : '0%'
                        }}
                      />
                    </div>
                  </div>
                ))}
                {summary.totalIssues === 0 && (
                  <p className="text-muted-foreground text-center py-4">No issues detected</p>
                )}
              </div>
            </div>

            {/* Issues by Category */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <Bug className="h-5 w-5" />
                  Issues by Category
                </h2>
              </div>
              <div className="p-4 space-y-3">
                {Object.entries(summary.byCategory)
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, count]) => {
                    const catInfo = CATEGORY_LABELS[category as IssueCategory];
                    return (
                      <div key={category} className="flex items-center gap-3">
                        <span className={catInfo.color}>{catInfo.icon}</span>
                        <span className="flex-1">{catInfo.label}</span>
                        <span className="font-bold">{count}</span>
                      </div>
                    );
                  })}
                {summary.totalIssues === 0 && (
                  <p className="text-muted-foreground text-center py-4">No issues detected</p>
                )}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {summary.recommendations.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2 className="card-title text-lg flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Recommendations
                </h2>
              </div>
              <div className="p-4">
                <ul className="space-y-2">
                  {summary.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <ChevronRight className="h-5 w-5 text-primary flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Critical Issues */}
          {summary.criticalIssues.length > 0 && (
            <div className="card border-destructive">
              <div className="card-header bg-destructive/10">
                <h2 className="card-title text-lg flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  Critical Issues ({summary.criticalIssues.length})
                </h2>
              </div>
              <div className="divide-y">
                {summary.criticalIssues.map((issue) => (
                  <div key={issue.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-red-500 mt-2" />
                      <div className="flex-1">
                        <p className="font-medium">{issue.description}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>Turn: {issue.turnNumber >= 0 ? issue.turnNumber + 1 : 'N/A'}</span>
                          <span className="capitalize">{issue.category.replace(/_/g, ' ')}</span>
                        </div>
                        {issue.suggestedFix && (
                          <p className="mt-2 text-sm text-primary">
                            Fix: {issue.suggestedFix}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Results History */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Test Results History
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted border-b-2 border-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Scenario</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Duration</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Issues</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {results.map((result) => (
                    <tr key={result.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <span className="font-medium">{result.scenarioName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium ${
                          result.status === 'passed'
                            ? 'bg-success/20 text-success'
                            : result.status === 'failed'
                            ? 'bg-destructive/20 text-destructive'
                            : 'bg-warning/20 text-warning'
                        }`}>
                          {result.status === 'passed' && <CheckCircle2 className="h-3 w-3" />}
                          {result.status === 'failed' && <XCircle className="h-3 w-3" />}
                          {result.status === 'error' && <AlertTriangle className="h-3 w-3" />}
                          {result.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {result.durationSeconds.toFixed(2)}s
                      </td>
                      <td className="px-4 py-3">
                        {result.issues.length > 0 ? (
                          <span className="text-destructive font-medium">
                            {result.issues.length} issue{result.issues.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-sm">
                        {new Date(result.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute('/reports')({
  component: ReportsPage,
});
