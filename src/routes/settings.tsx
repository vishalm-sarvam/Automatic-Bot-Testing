import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { useAgentPool, type AgentType, type PooledAgent, getPoolStats } from '@/services/agentPool';
import { Save, Key, Globe, Mic, AlertCircle, Check, Users, Plus, Trash2, Power, Activity } from 'lucide-react';

function SettingsPage() {
  const { isAuthenticated, user } = useAuthStore();
  const { apiConfig, setApiConfig } = useConfigStore();

  // Agent Pool state
  const { agents, addAgent, removeAgent, setAgentActive, clearPool } = useAgentPool();
  const [newAgentId, setNewAgentId] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentType, setNewAgentType] = useState<AgentType>('user_simulator');
  const [newAgentVersion, setNewAgentVersion] = useState(1);

  const [formData, setFormData] = useState({
    apiKey: apiConfig?.apiKey || '',
    orgId: apiConfig?.orgId || '',
    workspaceId: apiConfig?.workspaceId || '',
    baseUrl: apiConfig?.baseUrl || 'https://apps.sarvam.ai/api',
  });

  const [saved, setSaved] = useState(false);

  // Pool statistics
  const poolStats = getPoolStats();

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  const handleSave = () => {
    setApiConfig({
      apiKey: formData.apiKey,
      orgId: formData.orgId,
      workspaceId: formData.workspaceId,
      baseUrl: formData.baseUrl,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddAgent = () => {
    if (!newAgentId.trim()) return;

    addAgent({
      id: newAgentId.trim(),
      name: newAgentName.trim() || `Agent ${newAgentId.slice(-4)}`,
      type: newAgentType,
      version: newAgentVersion,
      isActive: true,
    });

    // Reset form
    setNewAgentId('');
    setNewAgentName('');
    setNewAgentVersion(1);
  };

  const getAgentTypeLabel = (type: AgentType) => {
    switch (type) {
      case 'scenario_generator': return 'Scenario Generator';
      case 'user_simulator': return 'User Simulator';
      case 'voice_tester': return 'Voice Tester';
      default: return type;
    }
  };

  const getAgentTypeColor = (type: AgentType) => {
    switch (type) {
      case 'scenario_generator': return 'text-blue-500';
      case 'user_simulator': return 'text-green-500';
      case 'voice_tester': return 'text-purple-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure API credentials and testing preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* API Configuration */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title text-lg flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Configuration
            </h2>
            <p className="card-description">
              Configure your Sarvam API credentials
            </p>
          </div>
          <div className="card-content space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                API Key
              </label>
              <input
                type="password"
                className="input"
                placeholder="Enter your API key"
                value={formData.apiKey}
                onChange={(e) =>
                  setFormData({ ...formData, apiKey: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Your Sarvam platform API key
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Organization ID
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g., sarvamai"
                value={formData.orgId}
                onChange={(e) =>
                  setFormData({ ...formData, orgId: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Workspace ID
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g., default"
                value={formData.workspaceId}
                onChange={(e) =>
                  setFormData({ ...formData, workspaceId: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Base URL
              </label>
              <input
                type="text"
                className="input"
                placeholder="https://apps.sarvam.ai/api"
                value={formData.baseUrl}
                onChange={(e) =>
                  setFormData({ ...formData, baseUrl: e.target.value })
                }
              />
            </div>

            <button
              className="btn-primary w-full"
              onClick={handleSave}
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>

        {/* Testing Preferences */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title text-lg flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Testing Preferences
            </h2>
            <p className="card-description">
              Configure how tests are executed
            </p>
          </div>
          <div className="card-content space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Test Mode
              </label>
              <select className="input">
                <option value="text">Text Mode (Fast)</option>
                <option value="voice">Voice Mode (Complete)</option>
                <option value="hybrid">Hybrid Mode</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Text mode is faster, voice mode tests the complete pipeline
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Default Language
              </label>
              <select className="input">
                <option value="Tamil">Tamil</option>
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Telugu">Telugu</option>
                <option value="Kannada">Kannada</option>
                <option value="Malayalam">Malayalam</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Timeout (seconds)
              </label>
              <input
                type="number"
                className="input"
                placeholder="30"
                defaultValue={30}
                min={5}
                max={120}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Parallel Tests
              </label>
              <input
                type="number"
                className="input"
                placeholder="3"
                defaultValue={3}
                min={1}
                max={10}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Number of tests to run in parallel
              </p>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title text-lg flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Account Information
            </h2>
            <p className="card-description">
              Your connected account details
            </p>
          </div>
          <div className="card-content space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
              {user?.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="h-12 w-12 rounded-full"
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-semibold">
                    {user?.name?.charAt(0) || 'U'}
                  </span>
                </div>
              )}
              <div>
                <p className="font-medium">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/50 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Connected via Google Workspace. Your session will remain active
                until you sign out.
              </p>
            </div>
          </div>
        </div>

        {/* Agent Pool Management */}
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h2 className="card-title text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Agent Pool Management
            </h2>
            <p className="card-description">
              Manage Sarvam agents for parallel testing. Since agents can't handle concurrent instances,
              add multiple agents to enable parallel test execution.
            </p>
          </div>
          <div className="card-content space-y-6">
            {/* Pool Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{poolStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Agents</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-green-500">{poolStats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-yellow-500">{poolStats.busy}</p>
                <p className="text-xs text-muted-foreground">Busy</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-blue-500">{poolStats.available}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold text-red-500">{poolStats.totalErrors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>

            {/* Add New Agent */}
            <div className="p-4 rounded-lg border border-dashed">
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add New Agent
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-2">
                  <input
                    type="text"
                    className="input"
                    placeholder="Agent App ID (e.g., Dynamic-Voi-14de4f18-9259)"
                    value={newAgentId}
                    onChange={(e) => setNewAgentId(e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    className="input"
                    placeholder="Display Name"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                  />
                </div>
                <div>
                  <select
                    className="input"
                    value={newAgentType}
                    onChange={(e) => setNewAgentType(e.target.value as AgentType)}
                  >
                    <option value="user_simulator">User Simulator</option>
                    <option value="scenario_generator">Scenario Generator</option>
                    <option value="voice_tester">Voice Tester</option>
                  </select>
                </div>
                <div>
                  <button
                    className="btn-primary w-full"
                    onClick={handleAddAgent}
                    disabled={!newAgentId.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* Agent List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Agents in Pool</h3>
                <button
                  className="text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => clearPool()}
                >
                  Reset to Defaults
                </button>
              </div>

              {agents.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg">
                  No agents in pool. Add agents above to enable parallel testing.
                </div>
              ) : (
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className={`p-3 rounded-lg border flex items-center justify-between ${
                        !agent.isActive ? 'opacity-50 bg-muted/30' : agent.isBusy ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${
                          agent.isBusy ? 'bg-yellow-500 animate-pulse' : agent.isActive ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{agent.id}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className={`text-xs font-medium ${getAgentTypeColor(agent.type)}`}>
                          {getAgentTypeLabel(agent.type)}
                        </span>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Activity className="h-3 w-3" />
                          {agent.usageCount} uses
                          {agent.errorCount > 0 && (
                            <span className="text-red-500">({agent.errorCount} errors)</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            className={`p-1.5 rounded hover:bg-muted ${
                              agent.isActive ? 'text-green-500' : 'text-gray-400'
                            }`}
                            onClick={() => setAgentActive(agent.id, !agent.isActive)}
                            title={agent.isActive ? 'Disable agent' : 'Enable agent'}
                          >
                            <Power className="h-4 w-4" />
                          </button>
                          <button
                            className="p-1.5 rounded hover:bg-muted text-red-500"
                            onClick={() => removeAgent(agent.id)}
                            title="Remove agent from pool"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-500">How Agent Pool Works</p>
                <p className="text-muted-foreground">
                  When running parallel tests, the system automatically rotates through available agents.
                  Agents with fewer errors are prioritized. If all agents are busy, tests will wait up to 30 seconds.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});
