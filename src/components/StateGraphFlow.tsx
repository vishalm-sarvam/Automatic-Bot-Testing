import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
  BackgroundVariant,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { BotState } from '@/types';
import { Zap, GitBranch, Variable, Maximize2, Minimize2, ArrowRight } from 'lucide-react';
import { renderPromptMarkdown } from '@/lib/promptMarkdown';

// Edge color palette
const EDGE_COLORS = [
  '#6366f1', // primary/indigo
  '#22c55e', // success/green
  '#f59e0b', // warning/amber
  '#ef4444', // destructive/red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
];

// Legend item for edge
interface EdgeLegendItem {
  source: string;
  target: string;
  color: string;
  isAnimated: boolean;
}

interface StateGraphFlowProps {
  states: Record<string, BotState>;
  initialStateName: string;
  onStateClick?: (stateName: string) => void;
}

// Custom node component for states - Neubrutalist, always expanded
function StateNode({ data }: {
  data: {
    label: string;
    isInitial: boolean;
    state: BotState;
  }
}) {
  const state = data.state;

  // Truncate text helper
  const truncate = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div
      className={`min-w-[240px] max-w-[320px] ${
        data.isInitial
          ? 'bg-secondary border-foreground'
          : 'bg-card border-foreground'
      }`}
      style={{
        boxShadow: data.isInitial ? '4px 4px 0 0 #4f46e5' : '3px 3px 0 0 #0f172a',
        border: '3px solid #0f172a',
      }}
    >
      {/* Handles for connections */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#6366f1', width: 10, height: 10 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: '#22c55e', width: 10, height: 10 }}
      />

      {/* Header */}
      <div className="px-3 py-2 border-b-2 border-foreground flex items-center gap-2">
        {data.isInitial && (
          <span className="w-3 h-3 bg-primary border-2 border-foreground" />
        )}
        <span className="font-bold text-sm uppercase tracking-wide">{data.label}</span>
      </div>

      {/* Summary row */}
      <div className="px-3 py-1.5 flex items-center gap-3 text-xs border-b border-foreground/20">
        <span className="flex items-center gap-1" title="Tools">
          <Zap className="h-3 w-3 text-yellow-500" />
          {state.tool_names.length}
        </span>
        <span className="flex items-center gap-1" title="Next States">
          <GitBranch className="h-3 w-3 text-blue-500" />
          {state.next_states.length}
        </span>
        <span className="flex items-center gap-1" title="Variables">
          <Variable className="h-3 w-3 text-purple-500" />
          {state.agent_variables_in_context.length}
        </span>
      </div>

      {/* Always visible details */}
      <div className="px-3 py-2 space-y-2 text-xs">
        {/* Goal */}
        {state.goal && (
          <div>
            <p className="font-semibold text-muted-foreground uppercase text-[10px]">Goal</p>
            <p className="text-foreground">{truncate(state.goal, 80)}</p>
          </div>
        )}

        {/* Prompt - Scrollable with Markdown */}
        {state.instructions && (
          <div>
            <p className="font-semibold text-muted-foreground uppercase text-[10px]">Prompt</p>
            <div className="bg-muted p-2 max-h-[150px] overflow-y-auto border border-foreground/20 text-[10px] leading-relaxed">
              {renderPromptMarkdown(state.instructions)}
            </div>
          </div>
        )}

        {/* Tools */}
        {state.tool_names.length > 0 && (
          <div>
            <p className="font-semibold text-muted-foreground uppercase text-[10px]">Tools</p>
            <div className="flex flex-wrap gap-1">
              {state.tool_names.map((tool) => (
                <span
                  key={tool}
                  className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-[10px] font-mono"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Variables */}
        {state.agent_variables_in_context.length > 0 && (
          <div>
            <p className="font-semibold text-muted-foreground uppercase text-[10px]">Variables</p>
            <div className="flex flex-wrap gap-1">
              {state.agent_variables_in_context.map((variable) => (
                <span
                  key={variable}
                  className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-mono"
                >
                  {variable}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const nodeTypes = {
  stateNode: StateNode,
};

export function StateGraphFlow({ states, initialStateName, onStateClick }: StateGraphFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  }, []);

  // Generate nodes, edges, and legend from states
  const { initialNodes, initialEdges, edgeLegend } = useMemo(() => {
    const stateNames = Object.keys(states);
    const nodeCount = stateNames.length;

    // Use dagre-like layout: initial state on left, flow to right
    // Nodes are now always expanded, so we need more vertical and horizontal space
    const NODE_WIDTH = 380;
    const NODE_HEIGHT = 400;
    const HORIZONTAL_GAP = 150;
    const VERTICAL_GAP = 120;

    const getPosition = (index: number, total: number, isInitial: boolean) => {
      if (isInitial) {
        return { x: 0, y: 200 };
      }

      // Arrange other nodes in a grid to the right
      const nonInitialIndex = index - (stateNames.indexOf(initialStateName) < index ? 0 : 1);
      const nonInitialCount = total - 1;
      const cols = Math.max(2, Math.min(3, Math.ceil(Math.sqrt(nonInitialCount))));
      const row = Math.floor(nonInitialIndex / cols);
      const col = nonInitialIndex % cols;

      return {
        x: NODE_WIDTH + HORIZONTAL_GAP + col * (NODE_WIDTH + HORIZONTAL_GAP),
        y: row * (NODE_HEIGHT + VERTICAL_GAP),
      };
    };

    // Create nodes
    const nodes: Node[] = stateNames.map((name, index) => {
      const state = states[name];
      const isInitial = name === initialStateName;

      return {
        id: name,
        type: 'stateNode',
        position: getPosition(index, nodeCount, isInitial),
        data: {
          label: name,
          isInitial,
          state,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });

    // Create edges with proper connections
    const edges: Edge[] = [];
    const legend: EdgeLegendItem[] = [];

    let colorIndex = 0;
    stateNames.forEach((name) => {
      const state = states[name];
      state.next_states.forEach((nextState) => {
        // Only add edge if target state exists
        if (stateNames.includes(nextState)) {
          const color = EDGE_COLORS[colorIndex % EDGE_COLORS.length];
          const isAnimated = name === initialStateName;
          colorIndex++;

          edges.push({
            id: `edge-${name}-to-${nextState}`,
            source: name,
            target: nextState,
            type: 'smoothstep',
            animated: isAnimated,
            style: {
              stroke: color,
              strokeWidth: 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: color,
              width: 20,
              height: 20,
            },
            label: '',
          });

          legend.push({
            source: name,
            target: nextState,
            color,
            isAnimated,
          });
        }
      });
    });

    return { initialNodes: nodes, initialEdges: edges, edgeLegend: legend };
  }, [states, initialStateName]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onStateClick?.(node.id);
    },
    [onStateClick]
  );

  const [showLegend, setShowLegend] = useState(true);

  return (
    <div
      ref={containerRef}
      className={`w-full border-2 border-foreground bg-background relative ${
        isFullscreen ? 'h-screen' : 'h-[600px]'
      }`}
    >
      {/* Fullscreen Toggle Button */}
      <button
        onClick={toggleFullscreen}
        className="absolute top-3 right-3 z-10 p-2 bg-card border-2 border-foreground hover:bg-muted transition-colors"
        style={{ boxShadow: '2px 2px 0 0 #0f172a' }}
        title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </button>

      {/* Edge Legend */}
      {edgeLegend.length > 0 && (
        <div
          className="absolute top-3 left-3 z-10 bg-card border-2 border-foreground max-w-[280px]"
          style={{ boxShadow: '2px 2px 0 0 #0f172a' }}
        >
          <button
            onClick={() => setShowLegend(!showLegend)}
            className="w-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide border-b border-foreground/20 flex items-center justify-between hover:bg-muted transition-colors"
          >
            <span>Transitions</span>
            <span className="text-muted-foreground">{showLegend ? '▲' : '▼'}</span>
          </button>
          {showLegend && (
            <div className="px-3 py-2 max-h-[250px] overflow-y-auto space-y-1.5">
              {/* Legend key */}
              <div className="flex items-center gap-3 text-[9px] text-muted-foreground border-b border-foreground/10 pb-1.5 mb-1">
                <div className="flex items-center gap-1">
                  <div className="w-4 h-0.5 bg-foreground" />
                  <span>Solid = Normal</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-0.5 bg-foreground" style={{ backgroundImage: 'repeating-linear-gradient(90deg, currentColor, currentColor 2px, transparent 2px, transparent 4px)' }} />
                  <span>Dashed = From Initial</span>
                </div>
              </div>
              {edgeLegend.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-[10px]">
                  <div
                    className="w-5 h-0.5 flex-shrink-0"
                    style={{
                      backgroundColor: item.isAnimated ? 'transparent' : item.color,
                      backgroundImage: item.isAnimated
                        ? `repeating-linear-gradient(90deg, ${item.color}, ${item.color} 3px, transparent 3px, transparent 6px)`
                        : 'none',
                    }}
                  />
                  <ArrowRight className="h-2.5 w-2.5 flex-shrink-0" style={{ color: item.color }} />
                  <span className="font-mono truncate" title={`${item.source} → ${item.target}`}>
                    {item.source} → {item.target}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Controls className="border-2 border-foreground" />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d1d5db" />
      </ReactFlow>
    </div>
  );
}
