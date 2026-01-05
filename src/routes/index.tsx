import { createFileRoute } from '@tanstack/react-router';
import { useAuthStore } from '@/stores/authStore';
import { useTestStore } from '@/stores/testStore';
import { useConfigStore } from '@/stores/configStore';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  FileJson,
  Play,
  BarChart3
} from 'lucide-react';
import { LoginPage } from '@/components/LoginPage';

function Dashboard() {
  const { isAuthenticated } = useAuthStore();
  const { scenarios, results, issues } = useTestStore();
  const { botConfig } = useConfigStore();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const passedTests = results.filter((r) => r.status === 'passed').length;
  const failedTests = results.filter((r) => r.status === 'failed').length;
  const totalTests = results.length;
  const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

  const criticalIssues = issues.filter((i) => i.severity === 'critical').length;
  const highIssues = issues.filter((i) => i.severity === 'high').length;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your bot testing progress
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileJson className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Bot Config</p>
              <p className="text-2xl font-bold">
                {botConfig ? botConfig.app_name : 'Not loaded'}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
              <Play className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Test Scenarios</p>
              <p className="text-2xl font-bold">{scenarios.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pass Rate</p>
              <p className="text-2xl font-bold">{passRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Critical Issues</p>
              <p className="text-2xl font-bold">{criticalIssues + highIssues}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title text-lg">Recent Test Results</h2>
            <p className="card-description">Latest test execution results</p>
          </div>
          <div className="card-content">
            {results.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No tests run yet. Generate scenarios and start testing.
              </p>
            ) : (
              <div className="space-y-3">
                {results.slice(-5).reverse().map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {result.status === 'passed' ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : result.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-warning" />
                      )}
                      <span className="font-medium">{result.scenarioName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {result.durationSeconds.toFixed(1)}s
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title text-lg">Issues Overview</h2>
            <p className="card-description">Detected issues by category</p>
          </div>
          <div className="card-content">
            {issues.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No issues detected yet.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(
                  issues.reduce((acc, issue) => {
                    acc[issue.category] = (acc[issue.category] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([category, count]) => (
                  <div
                    key={category}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium capitalize">
                      {category.replace(/_/g, ' ')}
                    </span>
                    <span className="badge-secondary">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {!botConfig && (
        <div className="card p-6">
          <h2 className="font-semibold mb-4">Get Started</h2>
          <p className="text-muted-foreground mb-4">
            To begin testing, you need to load a bot configuration first.
          </p>
          <a href="/config" className="btn-primary">
            Load Bot Configuration
          </a>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: Dashboard,
});
