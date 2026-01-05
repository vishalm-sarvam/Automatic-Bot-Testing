/**
 * Agent Pool Management
 *
 * Manages a pool of Sarvam agents for parallel testing.
 * Since a single agent can't handle parallel instances,
 * this pool allows rotating through multiple agents.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Agent types in the pool
export type AgentType = 'scenario_generator' | 'user_simulator' | 'voice_tester';

// Agent entry in the pool
export interface PooledAgent {
  id: string;           // Sarvam App ID
  name: string;         // Display name
  type: AgentType;
  version?: number;
  isActive: boolean;    // Whether this agent is enabled
  isBusy: boolean;      // Whether currently in use
  lastUsed?: number;    // Timestamp of last use
  usageCount: number;   // Total times used
  errorCount: number;   // Number of errors
}

// Pool state
interface AgentPoolState {
  agents: PooledAgent[];

  // Add/remove agents
  addAgent: (agent: Omit<PooledAgent, 'isBusy' | 'lastUsed' | 'usageCount' | 'errorCount'>) => void;
  removeAgent: (id: string) => void;
  updateAgent: (id: string, updates: Partial<PooledAgent>) => void;

  // Get agents
  getAgentsByType: (type: AgentType) => PooledAgent[];
  getAvailableAgent: (type: AgentType) => PooledAgent | null;

  // Mark agent status
  markAgentBusy: (id: string) => void;
  markAgentFree: (id: string) => void;
  markAgentError: (id: string) => void;

  // Bulk operations
  setAgentActive: (id: string, active: boolean) => void;
  clearPool: (type?: AgentType) => void;
}

// Default agents
const DEFAULT_AGENTS: PooledAgent[] = [
  {
    id: 'Example-Sin-e20a5d32-00fa',
    name: 'Scenario Generator v1',
    type: 'scenario_generator',
    version: 1,
    isActive: true,
    isBusy: false,
    usageCount: 0,
    errorCount: 0,
  },
  {
    id: 'Dynamic-Voi-14de4f18-9259',
    name: 'User Simulator v1',
    type: 'user_simulator',
    version: 1,
    isActive: true,
    isBusy: false,
    usageCount: 0,
    errorCount: 0,
  },
];

// Create the store with persistence
export const useAgentPool = create<AgentPoolState>()(
  persist(
    (set, get) => ({
      agents: DEFAULT_AGENTS,

      addAgent: (agent) => {
        set((state) => {
          // Check if agent already exists
          if (state.agents.find(a => a.id === agent.id)) {
            console.warn(`[AgentPool] Agent ${agent.id} already exists`);
            return state;
          }

          return {
            agents: [
              ...state.agents,
              {
                ...agent,
                isBusy: false,
                usageCount: 0,
                errorCount: 0,
              },
            ],
          };
        });
      },

      removeAgent: (id) => {
        set((state) => ({
          agents: state.agents.filter(a => a.id !== id),
        }));
      },

      updateAgent: (id, updates) => {
        set((state) => ({
          agents: state.agents.map(a =>
            a.id === id ? { ...a, ...updates } : a
          ),
        }));
      },

      getAgentsByType: (type) => {
        return get().agents.filter(a => a.type === type && a.isActive);
      },

      getAvailableAgent: (type) => {
        const agents = get().agents.filter(
          a => a.type === type && a.isActive && !a.isBusy
        );

        if (agents.length === 0) {
          console.warn(`[AgentPool] No available agents of type: ${type}`);
          return null;
        }

        // Sort by least recently used, then by least errors
        agents.sort((a, b) => {
          // Prefer agents with fewer errors
          if (a.errorCount !== b.errorCount) {
            return a.errorCount - b.errorCount;
          }
          // Then prefer least recently used
          return (a.lastUsed || 0) - (b.lastUsed || 0);
        });

        return agents[0];
      },

      markAgentBusy: (id) => {
        set((state) => ({
          agents: state.agents.map(a =>
            a.id === id
              ? { ...a, isBusy: true, lastUsed: Date.now(), usageCount: a.usageCount + 1 }
              : a
          ),
        }));
      },

      markAgentFree: (id) => {
        set((state) => ({
          agents: state.agents.map(a =>
            a.id === id ? { ...a, isBusy: false } : a
          ),
        }));
      },

      markAgentError: (id) => {
        set((state) => ({
          agents: state.agents.map(a =>
            a.id === id
              ? { ...a, isBusy: false, errorCount: a.errorCount + 1 }
              : a
          ),
        }));
      },

      setAgentActive: (id, active) => {
        set((state) => ({
          agents: state.agents.map(a =>
            a.id === id ? { ...a, isActive: active, isBusy: false } : a
          ),
        }));
      },

      clearPool: (type) => {
        set((state) => ({
          agents: type
            ? state.agents.filter(a => a.type !== type)
            : DEFAULT_AGENTS,
        }));
      },
    }),
    {
      name: 'agent-pool-storage',
      partialize: (state) => ({
        // Only persist agent configs, not runtime state
        agents: state.agents.map(a => ({
          ...a,
          isBusy: false, // Reset busy state on reload
        })),
      }),
    }
  )
);

// Helper functions for external use

/**
 * Get an available agent and mark it as busy
 * Returns the agent and a release function
 */
export async function acquireAgent(type: AgentType): Promise<{
  agent: PooledAgent;
  release: () => void;
  reportError: () => void;
} | null> {
  const { getAvailableAgent, markAgentBusy, markAgentFree, markAgentError } = useAgentPool.getState();

  const agent = getAvailableAgent(type);
  if (!agent) {
    return null;
  }

  markAgentBusy(agent.id);

  return {
    agent,
    release: () => markAgentFree(agent.id),
    reportError: () => markAgentError(agent.id),
  };
}

/**
 * Wait for an available agent (with timeout)
 */
export async function waitForAgent(
  type: AgentType,
  timeoutMs: number = 30000,
  pollIntervalMs: number = 500
): Promise<{
  agent: PooledAgent;
  release: () => void;
  reportError: () => void;
} | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await acquireAgent(type);
    if (result) {
      return result;
    }

    // Wait before trying again
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  console.error(`[AgentPool] Timeout waiting for agent of type: ${type}`);
  return null;
}

/**
 * Get pool statistics
 */
export function getPoolStats(type?: AgentType) {
  const { agents } = useAgentPool.getState();
  const filtered = type ? agents.filter(a => a.type === type) : agents;

  return {
    total: filtered.length,
    active: filtered.filter(a => a.isActive).length,
    busy: filtered.filter(a => a.isBusy).length,
    available: filtered.filter(a => a.isActive && !a.isBusy).length,
    totalUsage: filtered.reduce((sum, a) => sum + a.usageCount, 0),
    totalErrors: filtered.reduce((sum, a) => sum + a.errorCount, 0),
  };
}
