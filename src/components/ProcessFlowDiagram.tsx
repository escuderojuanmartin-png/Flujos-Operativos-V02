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
    className={`px-4 py-3 rounded-full bg-emerald-50 border-2 transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
      selected ? 'border-emerald-600 ring-2 ring-emerald-300' : 'border-emerald-400'
    }`}
  >
    <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
    </div>
    <div className="text-left">
      <div className="text-[10px] font-bold text-emerald-700 tracking-wider uppercase">Inicio</div>
      <div className="text-xs font-semibold text-emerald-950 line-clamp-1">{data.label}</div>
    </div>
    <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-emerald-600" />
  </div>
);

// Custom Node for Standard Action Step
const ActionNode = ({ data, selected }: any) => {
  const isPendingRole = data.role === 'Pendiente de definir' || !data.role;

  return (
    <div
      className={`w-64 rounded-lg bg-white border transition-all shadow-xs cursor-pointer overflow-hidden ${
        selected
          ? 'border-blue-600 ring-2 ring-blue-200 shadow-md'
          : 'border-slate-300 hover:border-slate-400'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-slate-500" />
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center">
            {data.stepNumber}
          </span>
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Actividad</span>
        </div>
        {data.system && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-mono">
            {data.system}
          </span>
        )}
      </div>

      <div className="p-3 text-left">
        <div className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">{data.label}</div>
        <div className="mt-2 flex items-center justify-between gap-1">
          <span
            className={`text-[11px] px-2 py-0.5 rounded font-medium truncate max-w-[170px] ${
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
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-blue-600" />
    </div>
  );
};

// Custom Node for Decision Step
const DecisionNode = ({ data, selected }: any) => (
  <div
    className={`w-60 rounded-xl bg-amber-50/90 border-2 transition-all shadow-xs cursor-pointer p-3 text-left ${
      selected
        ? 'border-amber-600 ring-2 ring-amber-200 shadow-md'
        : 'border-amber-400 hover:border-amber-500'
    }`}
  >
    <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-amber-600" />
    <div className="flex items-center gap-1.5 text-amber-800 text-[10px] font-bold uppercase tracking-wider mb-1">
      <HelpCircle className="w-3.5 h-3.5" />
      <span>Decisión / Control</span>
    </div>
    <div className="text-xs font-bold text-slate-900 leading-snug">{data.label}</div>
    <div className="mt-2 text-[11px] font-medium text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded inline-block">
      {data.role}
    </div>
    <Handle type="source" position={Position.Bottom} id="main" className="w-2.5 h-2.5 bg-amber-600" />
  </div>
);

// Custom Node for End Step
const EndNode = ({ data, selected }: any) => (
  <div
    className={`px-4 py-3 rounded-full bg-slate-100 border-2 transition-all shadow-xs flex items-center gap-2 cursor-pointer ${
      selected ? 'border-slate-800 ring-2 ring-slate-300' : 'border-slate-400'
    }`}
  >
    <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-slate-600" />
    <div className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center shrink-0">
      <CheckCircle2 className="w-3.5 h-3.5" />
    </div>
    <div className="text-left">
      <div className="text-[10px] font-bold text-slate-600 tracking-wider uppercase">Fin</div>
      <div className="text-xs font-semibold text-slate-900 line-clamp-1">{data.label}</div>
    </div>
  </div>
);

const nodeTypes = {
  startNode: StartNode,
  actionNode: ActionNode,
  decisionNode: DecisionNode,
  endNode: EndNode,
};

export const ProcessFlowDiagram: React.FC<Props> = ({ process, selectedActivityId, onSelectActivity }) => {
  // Generate nodes with automatic vertical layout
  const nodes: Node[] = useMemo(() => {
    let currentY = 40;
    const centerX = 260;

    return process.activities.map((act) => {
      let type = 'actionNode';
      let nodeHeight = 110;

      if (act.type === 'start') {
        type = 'startNode';
        nodeHeight = 70;
      } else if (act.type === 'end') {
        type = 'endNode';
        nodeHeight = 70;
      } else if (act.type === 'decision') {
        type = 'decisionNode';
        nodeHeight = 120;
      }

      const y = currentY;
      currentY += nodeHeight + 45;

      return {
        id: act.id,
        type,
        position: { x: centerX - 120, y },
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
  }, [process.activities, selectedActivityId]);

  // Generate edges from connections
  const edges: Edge[] = useMemo(() => {
    const actIdSet = new Set((process.activities || []).map((a) => a.id));
    const validConns = (process.connections || []).filter(
      (c) => c && c.from && c.to && actIdSet.has(c.from) && actIdSet.has(c.to)
    );

    if (validConns.length > 0) {
      return validConns.map((c, idx) => ({
        id: `e_${c.from}_${c.to}_${idx}`,
        source: c.from,
        target: c.to,
        label: c.label || undefined,
        type: ConnectionLineType.SmoothStep,
        animated: false,
        style: { stroke: '#475569', strokeWidth: 2 },
        labelStyle: { fill: '#1e293b', fontWeight: 600, fontSize: 11 },
        labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.95 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#475569',
        },
      }));
    }

    // Default linear chain if connections empty or invalid
    const seqEdges: Edge[] = [];
    for (let i = 0; i < (process.activities || []).length - 1; i++) {
      seqEdges.push({
        id: `e_seq_${i}`,
        source: process.activities[i].id,
        target: process.activities[i + 1].id,
        type: ConnectionLineType.SmoothStep,
        style: { stroke: '#64748b', strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#64748b',
        },
      });
    }
    return seqEdges;
  }, [process.connections, process.activities]);

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
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background color="#cbd5e1" gap={20} size={1} />
        <Controls className="bg-white border border-slate-200 shadow-xs rounded-md" />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'startNode') return '#10b981';
            if (n.type === 'endNode') return '#ef4444';
            if (n.type === 'decisionNode') return '#f59e0b';
            return '#3b82f6';
          }}
          className="bg-white border border-slate-200 rounded-md"
        />
      </ReactFlow>

      {/* Floating Diagram Legend */}
      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs border border-slate-200 px-3 py-2 rounded-md shadow-xs text-[11px] text-slate-600 flex items-center gap-3 pointer-events-none">
        <span className="font-semibold text-slate-800">Simbología:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Inicio
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-xs bg-blue-500 inline-block" /> Actividad
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rotate-45 bg-amber-500 inline-block" /> Decisión
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-700 inline-block" /> Fin
        </span>
      </div>
    </div>
  );
};
