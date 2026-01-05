import type { BotConfiguration, StateGraph, StateNode, StateEdge, StatePath, BotState } from '@/types';
import { generateId } from '@/lib/utils';

/**
 * Parse bot configuration and extract the state graph
 */
export function parseStateGraph(config: BotConfiguration): StateGraph {
  const agentConfig = config.llm_config?.agent_config;
  if (!agentConfig?.states) {
    throw new Error('Invalid configuration: missing states');
  }

  const states = new Map<string, StateNode>();
  const edges: StateEdge[] = [];

  // Parse each state
  for (const [name, stateData] of Object.entries(agentConfig.states)) {
    const state = stateData as BotState;
    const node: StateNode = {
      id: name,
      name: state.name,
      instructions: state.instructions,
      tools: state.tool_names || [],
      nextStates: state.next_states || [],
      variables: state.agent_variables_in_context || [],
    };

    states.set(name, node);

    // Create edges for transitions
    for (const nextState of node.nextStates) {
      edges.push({
        from: name,
        to: nextState,
      });
    }
  }

  return {
    states,
    initialState: agentConfig.initial_state_name || '',
    edges,
  };
}

/**
 * Generate all possible paths through the state graph using DFS
 */
export function generateAllPaths(
  graph: StateGraph,
  maxDepth: number = 10
): StatePath[] {
  const paths: StatePath[] = [];
  const visited = new Set<string>();

  function dfs(currentPath: string[], currentState: string, depth: number): void {
    if (depth > maxDepth) return;

    const state = graph.states.get(currentState);
    if (!state) return;

    currentPath.push(currentState);

    // If this is a terminal state (no next states), save the path
    if (state.nextStates.length === 0) {
      paths.push({
        id: generateId(),
        states: [...currentPath],
        description: `Path: ${currentPath.join(' → ')}`,
        category: categorizeP(currentPath),
      });
    } else {
      // Continue to next states
      for (const nextState of state.nextStates) {
        // Avoid infinite loops
        if (!visited.has(nextState) || depth < 3) {
          visited.add(nextState);
          dfs(currentPath, nextState, depth + 1);
          visited.delete(nextState);
        }
      }
    }

    currentPath.pop();
  }

  // Start from the initial state
  if (graph.initialState) {
    dfs([], graph.initialState, 0);
  }

  return paths;
}

function categorizeP(path: string[]): StatePath['category'] {
  // Categorize based on path characteristics
  const hasError = path.some(s => s.toLowerCase().includes('error'));
  const hasEnd = path.some(s => s.toLowerCase().includes('end'));

  if (hasError) return 'error_handling';
  if (hasEnd && path.length <= 4) return 'happy_path';
  return 'edge_case';
}

/**
 * Find critical paths (most important user journeys)
 */
export function findCriticalPaths(graph: StateGraph): StatePath[] {
  const allPaths = generateAllPaths(graph);

  // Prioritize shorter paths that reach terminal states
  return allPaths
    .filter(p => p.category === 'happy_path')
    .sort((a, b) => a.states.length - b.states.length)
    .slice(0, 10);
}

/**
 * Extract all unique tools used across the state graph
 */
export function extractAllTools(graph: StateGraph): string[] {
  const tools = new Set<string>();

  for (const state of graph.states.values()) {
    for (const tool of state.tools) {
      tools.add(tool);
    }
  }

  return Array.from(tools);
}

/**
 * Extract all variables used across the state graph
 */
export function extractAllVariables(graph: StateGraph): string[] {
  const variables = new Set<string>();

  for (const state of graph.states.values()) {
    for (const variable of state.variables) {
      variables.add(variable);
    }
  }

  return Array.from(variables);
}

/**
 * Find states that can be reached from a given state
 */
export function findReachableStates(
  graph: StateGraph,
  fromState: string
): string[] {
  const reachable = new Set<string>();
  const queue = [fromState];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;

    reachable.add(current);

    const state = graph.states.get(current);
    if (state) {
      for (const next of state.nextStates) {
        if (!reachable.has(next)) {
          queue.push(next);
        }
      }
    }
  }

  return Array.from(reachable);
}

/**
 * Find states that can reach a given state
 */
export function findPredecessorStates(
  graph: StateGraph,
  targetState: string
): string[] {
  const predecessors: string[] = [];

  for (const [name, state] of graph.states) {
    if (state.nextStates.includes(targetState)) {
      predecessors.push(name);
    }
  }

  return predecessors;
}

/**
 * Analyze state graph for potential issues
 */
export function analyzeStateGraph(graph: StateGraph): {
  orphanStates: string[];
  unreachableStates: string[];
  deadEndStates: string[];
  cycles: string[][];
} {
  const reachableFromStart = graph.initialState
    ? new Set(findReachableStates(graph, graph.initialState))
    : new Set<string>();

  const orphanStates: string[] = [];
  const unreachableStates: string[] = [];
  const deadEndStates: string[] = [];

  for (const [name, state] of graph.states) {
    // Check if state is reachable from initial state
    if (!reachableFromStart.has(name) && name !== graph.initialState) {
      unreachableStates.push(name);
    }

    // Check if state has no incoming edges (except initial state)
    const predecessors = findPredecessorStates(graph, name);
    if (predecessors.length === 0 && name !== graph.initialState) {
      orphanStates.push(name);
    }

    // Check if state has no outgoing edges (potential dead end)
    if (state.nextStates.length === 0 && !name.toLowerCase().includes('end')) {
      deadEndStates.push(name);
    }
  }

  // Find cycles using DFS
  const cycles = findCycles(graph);

  return {
    orphanStates,
    unreachableStates,
    deadEndStates,
    cycles,
  };
}

function findCycles(graph: StateGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): void {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const state = graph.states.get(node);
    if (state) {
      for (const next of state.nextStates) {
        if (!visited.has(next)) {
          dfs(next);
        } else if (recursionStack.has(next)) {
          // Found a cycle
          const cycleStart = path.indexOf(next);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart));
          }
        }
      }
    }

    path.pop();
    recursionStack.delete(node);
  }

  for (const state of graph.states.keys()) {
    if (!visited.has(state)) {
      dfs(state);
    }
  }

  return cycles;
}

/**
 * Generate a simple text representation of the state graph
 */
export function graphToText(graph: StateGraph): string {
  const lines: string[] = [];

  lines.push(`State Graph (Initial: ${graph.initialState})`);
  lines.push('='.repeat(50));

  for (const [name, state] of graph.states) {
    const isInitial = name === graph.initialState;
    const prefix = isInitial ? '► ' : '  ';

    lines.push(`\n${prefix}${name}`);
    lines.push(`   Tools: ${state.tools.join(', ') || 'none'}`);
    lines.push(`   Next: ${state.nextStates.join(', ') || 'terminal'}`);
  }

  return lines.join('\n');
}
