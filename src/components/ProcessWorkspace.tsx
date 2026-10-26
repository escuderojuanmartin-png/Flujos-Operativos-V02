import React, { useState } from 'react';
import { ProcessModel, Client } from '../types/process';
import { ProcessFlowDiagram } from './ProcessFlowDiagram';
import { ProcedureDocumentView } from './ProcedureDocumentView';
import {
  GitBranch,
  FileText,
  Save,
  CheckCircle,
  Clock,
  Columns,
  Maximize2,
  Minimize2,
  Bookmark,
} from 'lucide-react';

interface Props {
  processes: ProcessModel[];
  activeProcessId: string;
  onSelectProcessId: (id: string) => void;
  onUpdateProcess: (updated: ProcessModel) => void;
  client?: Client;
}

export const ProcessWorkspace: React.FC<Props> = ({
  processes,
  activeProcessId,
  onSelectProcessId,
  onUpdateProcess,
  client,
}) => {
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'diagram_only' | 'doc_only'>('split');
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [versionNote, setVersionNote] = useState('');

  const activeProcess = processes.find((p) => p.id === activeProcessId) || processes[0];

  if (!activeProcess) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500">
        <p className="font-semibold text-slate-700">No hay procesos para mostrar</p>
      </div>
    );
  }

  const handleSaveNewVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionNote.trim()) return;

    const currentVer = parseFloat(activeProcess.version || '1.0');
    const newVer = (currentVer + 0.1).toFixed(1);

    const newHistoryEntry = {
      version: newVer,
      date: new Date().toLocaleDateString('es-ES'),
      author: 'Usuario Consultor',
      description: versionNote.trim(),
    };

    onUpdateProcess({
      ...activeProcess,
      version: newVer,
      history: [newHistoryEntry, ...(activeProcess.history || [])],
      updatedAt: new Date().toISOString(),
    });

    setVersionNote('');
    setIsSavingVersion(false);
  };

  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      {/* Top Bar: Process Switcher, Version & Mode */}
      <div className="bg-white px-4 py-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Proceso Activo:
          </label>
          <select
            value={activeProcess.id}
            onChange={(e) => {
              onSelectProcessId(e.target.value);
              setSelectedActivityId(null);
            }}
            className="border border-slate-300 rounded-md px-3 py-1 text-sm font-semibold text-slate-800 bg-white"
          >
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `[${p.code}] ` : ''}{p.name} ({p.docType})
              </option>
            ))}
          </select>

          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
              activeProcess.status === 'validado'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-800'
            }`}
          >
            {activeProcess.status.replace('_', ' ')}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="bg-slate-100 p-0.5 rounded-md flex items-center text-xs text-slate-600">
            <button
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'split' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vista Dividida</span>
            </button>
            <button
              onClick={() => setViewMode('diagram_only')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'diagram_only' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Solo Diagrama</span>
            </button>
            <button
              onClick={() => setViewMode('doc_only')}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors ${
                viewMode === 'doc_only' ? 'bg-white text-blue-700 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Solo Documento</span>
            </button>
          </div>

          {/* Version Button */}
          <button
            onClick={() => setIsSavingVersion(!isSavingVersion)}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            <span>v{activeProcess.version || '1.0'}</span>
          </button>
        </div>
      </div>

      {/* Version Recording Dialog */}
      {isSavingVersion && (
        <form
          onSubmit={handleSaveNewVersion}
          className="bg-white p-4 rounded-lg border border-blue-200 shadow-xs flex items-center gap-3 shrink-0 text-left"
        >
          <div className="text-xs font-bold text-slate-700 shrink-0">Guardar Versión:</div>
          <input
            type="text"
            required
            placeholder="Descripción de los cambios (ej. Ajuste de responsable y corrección de secuencia)..."
            value={versionNote}
            onChange={(e) => setVersionNote(e.target.value)}
            className="flex-1 text-xs border border-slate-300 rounded px-3 py-1.5"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 rounded bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 shrink-0"
          >
            Guardar v{(parseFloat(activeProcess.version || '1.0') + 0.1).toFixed(1)}
          </button>
          <button
            type="button"
            onClick={() => setIsSavingVersion(false)}
            className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Main Workspace Area (Split / Full) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Interactive Diagram */}
        {(viewMode === 'split' || viewMode === 'diagram_only') && (
          <div
            className={`h-full ${
              viewMode === 'split' ? 'lg:col-span-6 xl:col-span-6' : 'lg:col-span-12'
            }`}
          >
            <ProcessFlowDiagram
              process={activeProcess}
              selectedActivityId={selectedActivityId}
              onSelectActivity={(id) => setSelectedActivityId(id)}
            />
          </div>
        )}

        {/* Right: Synced Procedure Document View */}
        {(viewMode === 'split' || viewMode === 'doc_only') && (
          <div
            className={`h-full ${
              viewMode === 'split' ? 'lg:col-span-6 xl:col-span-6' : 'lg:col-span-12'
            }`}
          >
            <ProcedureDocumentView
              process={activeProcess}
              selectedActivityId={selectedActivityId}
              onSelectActivity={(id) => setSelectedActivityId(id)}
              onUpdateProcess={onUpdateProcess}
            />
          </div>
        )}
      </div>
    </div>
  );
};
