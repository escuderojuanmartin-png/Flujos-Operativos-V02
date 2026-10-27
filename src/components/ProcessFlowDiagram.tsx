import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  Position,
  Handle,
  ConnectionLineType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { ProcessModel, ProcessActivity } from '../types/process';
import { Play, CheckCircle2, HelpCircle, Layers, AlertTriangle } from 'lucide-react';

interface Props {
  process: ProcessModel;
  selectedActivityId: string | null;
  onSelectActivity: (id: string) => void;
}

// Custom Node for Start Step
const StartNode = ({ data, selected }: any) => (
  <div
    className={`px-4 py-3 rounded-full bg-emerald-50 border-2 transition-all shadow-xs flex items-center gap-2 cursor-pointer w-[250px] ${
      selected ? 'border-emerald-600 ring-2 ring-emerald-300 shadow-md' : 'border-emerald-400 hover:border-emerald-500'
    }`}
  >
    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
    </div>
    <div className="text-left overflow-hidden">
      <div className="text-[10px] font-bold text-emerald-700 tracking-wider uppercase">Inicio del Proceso</div>
      <div className="text-xs font-bold text-emerald-950 truncate">{data.label}</div>
    </div>
    <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-emerald-600 border-2 border-white rounded-full" />
  </div>
);

// Custom Node for Standard Action Step
const ActionNode = ({ data, selected }: any) => {
  const isPendingRole = data.role === 'Pendiente de definir' || !data.role;

  return (
    <div
      className={`w-[280px] rounded-lg bg-white border transition-all shadow-xs cursor-pointer overflow-hidden ${
        selected
          ? 'border-blue-600 ring-2 ring-blue-200 shadow-md'
          : 'border-slate-300 hover:border-slate-400'
      }`}
    >
      <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-slate-500 border-2 border-white rounded-full" />
      <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-blue-500 border-2 border-white rounded-full" />
      <Handle type="target" position={Position.Right} id="right" className="w-3 h-3 bg-blue-500 border-2 border-white rounded-full" />

      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center">
            {data.stepNumber}
          </span>
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Actividad</span>
        </div>
        {data.system && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-mono truncate max-w-[110px]">
            {data.system}
          </span>
        )}
      </div>

      <div className="p-3 text-left">
        <div className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">{data.label}</div>
        <div className="mt-2 flex items-center justify-between gap-1">
          <span
            className={`text-[11px] px-2 py-0.5 rounded font-medium truncate max-w-[220px] ${
              isPendingRole
                ? 'bg-rose-100 text-rose-700 font-semibold'
                : 'bg-blue-50 text-blue-700 border border-blue-200/50'
            }`}
          >
            {isPendingRole ? '⚠ Rol Pendiente' : data.role}
          </span>
        </div>
        {data.exceptions && (
          <div className="mt-1.5 text-[10px] text-amber-700 flex items-center gap-1 bg-amber-50 p-1 rounded">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="truncate">{data.exceptions}</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-blue-600 border-2 border-white rounded-full" />
    </div>
  );
};

// Custom Node for Decision Step with Multiple Branching Ports
const DecisionNode = ({ data, selected }: any) => (
  <div
    className={`w-[280px] rounded-xl bg-amber-50/95 border-2 transition-all shadow-xs cursor-pointer p-3.5 text-left relative ${
      selected
        ? 'border-amber-600 ring-2 ring-amber-200 shadow-md'
        : 'border-amber-400 hover:border-amber-500'
    }`}
  >
    <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-amber-600 border-2 border-white rounded-full" />

    <div className="flex items-center gap-1.5 text-amber-800 text-[10px] font-bold uppercase tracking-wider mb-1">
      <HelpCircle className="w-3.5 h-3.5" />
      <span>Decisión / Control</span>
    </div>
    <div className="text-xs font-bold text-slate-900 leading-snug">{data.label}</div>

    <div className="mt-2 flex items-center justify-between gap-1">
      <span className="text-[11px] font-semibold text-amber-950 bg-amber-200/70 px-2 py-0.5 rounded truncate max-w-[170px]">
        {data.role}
      </span>
      {data.system && (
        <span className="text-[10px] text-amber-800 font-mono bg-white/70 px-1.5 py-0.5 rounded border border-amber-200 truncate max-w-[90px]">
          {data.system}
        </span>
      )}
    </div>

    {/* Outgoing port: Bottom (Principal / Conforme / Aceptada) */}
    <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-emerald-600 border-2 border-white rounded-full" />
    {/* Outgoing port: Right (Alternativa / Posponer / Rechazada) */}
    <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-rose-500 border-2 border-white rounded-full" />
    {/* Outgoing port: Left (Loopback / Reproceso) */}
    <Handle type="source" position={Position.Left} id="left" className="w-3 h-3 bg-amber-600 border-2 border-white rounded-full" />
  </div>
);

// Custom Node for End Step
const EndNode = ({ data, selected }: any) => (
  <div
    className={`px-4 py-3 rounded-full bg-slate-100 border-2 transition-all shadow-xs flex items-center gap-2 cursor-pointer w-[250px] ${
      selected ? 'border-slate-800 ring-2 ring-slate-300 shadow-md' : 'border-slate-400 hover:border-slate-500'
    }`}
  >
    <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-slate-600 border-2 border-white rounded-full" />
    <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-slate-600 border-2 border-white rounded-full" />
    <div className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0">
      <CheckCircle2 className="w-3.5 h-3.5" />
    </div>
    <div className="text-left overflow-hidden">
      <div className="text-[10px] font-bold text-slate-600 tracking-wider uppercase">Fin del Proceso</div>
      <div className="text-xs font-bold text-slate-900 truncate">{data.label}</div>
    </div>
  </div>
);

const nodeTypes = {
  startNode: StartNode,
  actionNode: ActionNode,
  decisionNode: DecisionNode,
  endNode: EndNode,
};

// Node Dimensions for Dagre Auto-layout
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  startNode: { width: 250, height: 70 },
  actionNode: { width: 280, height: 115 },
  decisionNode: { width: 280, height: 125 },
  endNode: { width: 250, height: 70 },
};

export const ProcessFlowDiagram: React.FC<Props> = ({ process, selectedActivityId, onSelectActivity }) => {
  // Compute full Dagre hierarchical layout with lateral branches and proper routing
  const { nodes, edges } = useMemo(() => {
    const actMap = new Map<string, ProcessActivity>();
    process.activities.forEach((a) => actMap.set(a.id, a));

    // 1. Prepare raw edges
    const validConns = (process.connections || []).filter(
      (c) => c && c.from && c.to && actMap.has(c.from) && actMap.has(c.to)
    );

    // 2. Setup Dagre Graph
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({
      rankdir: 'TB',
      nodesep: 90, // Lateral separation between branches
      ranksep: 75, // Vertical spacing between ranks
      align: 'DL',
      ranker: 'network-simplex',
    });

    // 3. Add nodes to Dagre
    process.activities.forEach((act) => {
      let type = 'actionNode';
      if (act.type === 'start') type = 'startNode';
      else if (act.type === 'end') type = 'endNode';
      else if (act.type === 'decision') type = 'decisionNode';

      const dims = NODE_DIMENSIONS[type] || { width: 280, height: 115 };
      dagreGraph.setNode(act.id, { width: dims.width, height: dims.height });
    });

    // 4. Add edges to Dagre (ignore self loops or backwards edges in dagre to prevent cycles)
    validConns.forEach((c) => {
      const fromAct = actMap.get(c.from);
      const toAct = actMap.get(c.to);
      const isLoopback = fromAct && toAct && fromAct.stepNumber >= toAct.stepNumber;
      if (!isLoopback) {
        dagreGraph.setEdge(c.from, c.to);
      }
    });

    dagre.layout(dagreGraph);

    // 5. Generate ReactFlow nodes with calculated positions
    const layoutedNodes: Node[] = process.activities.map((act) => {
      let type = 'actionNode';
      if (act.type === 'start') type = 'startNode';
      else if (act.type === 'end') type = 'endNode';
      else if (act.type === 'decision') type = 'decisionNode';

      const dims = NODE_DIMENSIONS[type] || { width: 280, height: 115 };
      const nodePos = dagreGraph.node(act.id);
      const x = nodePos ? nodePos.x - dims.width / 2 : 100;
      const y = nodePos ? nodePos.y - dims.height / 2 : 100;

      return {
        id: act.id,
        type,
        position: { x, y },
        selected: selectedActivityId === act.id,
        data: {
          label: act.name,
          stepNumber: act.stepNumber,
          role: act.role,
          system: act.system,
          description: act.description,
          exceptions: act.exceptions,
        },
      };
    });

    // 6. Generate ReactFlow edges with intelligent port assignment and pill badges
    const layoutedEdges: Edge[] = validConns.map((c, idx) => {
      const fromAct = actMap.get(c.from);
      const toAct = actMap.get(c.to);

      const labelText = (c.label || '').trim();
      const lowerLabel = labelText.toLowerCase();

      const isNegative =
        lowerLabel.includes('posponer') ||
        lowerLabel.includes('pospuesta') ||
        lowerLabel.includes('no') ||
        lowerLabel.includes('rechaz') ||
        lowerLabel.includes('anomal');

      const isPositive =
        lowerLabel.includes('aceptad') ||
        lowerLabel.includes('conforme') ||
        lowerLabel.includes('sí') ||
        lowerLabel.includes('si') ||
        lowerLabel.includes('aprob');

      const isFromDecision = fromAct?.type === 'decision';
      const isLoopback = fromAct && toAct && fromAct.stepNumber >= toAct.stepNumber;

      // Smart Port Selection:
      // Decision nodes route negative/alternative branches out the RIGHT handle!
      let sourceHandle = 'bottom';
      let targetHandle = 'top';

      if (isFromDecision) {
        if (isNegative) {
          sourceHandle = 'right';
        } else if (isPositive) {
          sourceHandle = 'bottom';
        }
      }

      if (isLoopback) {
        sourceHandle = 'left';
        targetHandle = 'left';
      }

      const strokeColor = isNegative
        ? '#e11d48'
        : isPositive
        ? '#059669'
        : isLoopback
        ? '#d97706'
        : '#475569';

      return {
        id: `e_${c.from}_${c.to}_${idx}`,
        source: c.from,
        target: c.to,
        sourceHandle,
        targetHandle,
        label: labelText || undefined,
        type: isLoopback ? ConnectionLineType.SmoothStep : ConnectionLineType.SmoothStep,
        animated: isLoopback,
        style: {
          stroke: strokeColor,
          strokeWidth: isNegative || isPositive ? 2.5 : 2,
          strokeDasharray: isLoopback ? '5 5' : undefined,
        },
        labelStyle: {
          fill: isNegative ? '#9f1239' : isPositive ? '#065f46' : '#1e293b',
          fontWeight: 700,
          fontSize: 11,
        },
        labelBgStyle: {
          fill: '#ffffff',
          fillOpacity: 0.98,
          stroke: isNegative ? '#f43f5e' : isPositive ? '#10b981' : '#cbd5e1',
          strokeWidth: 1.5,
          rx: 6,
          ry: 6,
        },
        labelBgPadding: [8, 4] as [number, number],
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: strokeColor,
          width: 18,
          height: 18,
        },
      };
    });

    return { nodes: layoutedNodes, edges: layoutedEdges };
  }, [process.activities, process.connections, selectedActivityId]);

  const onNodeClick = useCallback(
    (_: any, node: Node) => {
      onSelectActivity(node.id);
    },
    [onSelectActivity]
  );

  return (
    <div className="w-full h-full bg-slate-50 relative rounded-lg border border-slate-200 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background color="#cbd5e1" gap={22} size={1} />
        <Controls className="bg-white border border-slate-200 shadow-xs rounded-md" />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'startNode') return '#10b981';
            if (n.type === 'endNode') return '#64748b';
            if (n.type === 'decisionNode') return '#f59e0b';
            return '#3b82f6';
          }}
          className="bg-white border border-slate-200 rounded-md"
        />
      </ReactFlow>

      {/* Floating Diagram Legend */}
      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-200 px-3 py-2 rounded-md shadow-xs text-[11px] text-slate-600 flex items-center gap-3 pointer-events-none">
        <span className="font-semibold text-slate-800">Simbología AS-IS:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Inicio
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block" /> Actividad
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" /> Decisión / Control
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" /> Fin
        </span>
        <span className="flex items-center gap-1 pl-2 border-l border-slate-200 text-emerald-700 font-bold">
          ✔ Aceptada
        </span>
        <span className="flex items-center gap-1 text-rose-600 font-bold">
          ✖ Pospuesta
        </span>
      </div>
    </div>
  );
};
