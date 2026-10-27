import React, { useState, useMemo } from 'react';
import { ProcessModel, Client, ProcessRevision } from '../types/process';
import { ProcessFlowDiagram } from './ProcessFlowDiagram';
import { ProcedureDocumentView } from './ProcedureDocumentView';
import { validateProcessGraph } from '../lib/graphValidation';
import { createRevisionSnapshot } from '../lib/persistence';
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
  History,
  RotateCcw,
  AlertTriangle,
  X,
  CheckCircle2,
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
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [versionNote, setVersionNote] = useState('');

  const activeProcess = processes.find((p) => p.id === activeProcessId) || processes[0];

  // Real-time process graph validation (Section 5.4)
  const graphValidation = useMemo(() => {
    if (!activeProcess) return { isValid: true, canValidate: true, issues: [] };
    return validateProcessGraph(activeProcess);
  }, [activeProcess]);

  if (!activeProcess) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500">
        <p className="font-semibold text-slate-700">No hay procesos para mostrar</p>
      </div>
    );
  }

  // Section 7: Recoverable snapshot versioning
  const handleSaveNewVersion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionNote.trim()) return;

    const newRev = createRevisionSnapshot(activeProcess, 'Usuario Consultor', versionNote.trim(), false);

    onUpdateProcess({
      ...activeProcess,
      version: newRev.version,
      history: [newRev, ...(activeProcess.history || [])],
      updatedAt: new Date().toISOString(),
    });

    setVersionNote('');
    setIsSavingVersion(false);
  };

  const handleRestoreSnapshot = (rev: ProcessRevision) => {
    if (!rev.snapshotData) return;
    const confirmRestore = window.confirm(
      `¿Deseas restaurar la versión ${rev.version} grabada el ${rev.date}? Los cambios no guardados se reemplazarán.`
    );
    if (!confirmRestore) return;

    onUpdateProcess({
      ...rev.snapshotData,
      id: activeProcess.id,
      clientId: activeProcess.clientId,
      ownerId: activeProcess.ownerId,
      surveyId: activeProcess.surveyId,
      history: [
        {
          version: activeProcess.version,
          date: new Date().toLocaleDateString('es-ES'),
          author: 'Usuario Consultor',
          description: `Restaurada versión anterior ${rev.version} (${rev.description})`,
        },
        ...(activeProcess.history || []),
      ],
      updatedAt: new Date().toISOString(),
    });

    setShowHistoryModal(false);
  };

  const errorIssues = graphValidation.issues.filter((i) => i.severity === 'error');
  const warningIssues = graphValidation.issues.filter((i) => i.severity === 'warning');

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

          {/* Graph Validation Badge */}
          {errorIssues.length > 0 ? (
            <span
              title={errorIssues.map((e) => e.message).join(' | ')}
              className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              <span>{errorIssues.length} inconsistencias en grafo</span>
            </span>
          ) : warningIssues.length > 0 ? (
            <span
              title={warningIssues.map((w) => w.message).join(' | ')}
              className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1"
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>{warningIssues.length} advertencias</span>
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Grafo consistente</span>
            </span>
          )}
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
            title="Guardar nueva versión"
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5 text-blue-600" />
            <span>v{activeProcess.version || '1.0'}</span>
          </button>

          {/* History Button (Section 7) */}
          <button
            onClick={() => setShowHistoryModal(true)}
            title="Ver historial de versiones e instantáneas"
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <History className="w-3.5 h-3.5 text-slate-600" />
            <span>Historial ({activeProcess.history?.length || 0})</span>
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
            placeholder="Descripción del cambio (ej. Ajuste de responsable en paso 3 y reconexión de excepción)..."
            value={versionNote}
            onChange={(e) => setVersionNote(e.target.value)}
            className="flex-1 text-xs border border-slate-300 rounded px-3 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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

      {/* Version History & Recovery Modal (Section 7) */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold">Control Documental e Instantáneas de Versión</h3>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3 text-left">
              <div className="text-xs text-slate-500 mb-2">
                Instantáneas registradas para <strong>{activeProcess.name}</strong>. Puedes consultar o restaurar cualquiera de las revisiones históricas anteriores:
              </div>

              {(!activeProcess.history || activeProcess.history.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                  No hay revisiones anteriores registradas.
                </div>
              ) : (
                activeProcess.history.map((rev, idx) => (
                  <div
                    key={`${rev.version}_${idx}`}
                    className="p-3.5 rounded-lg border border-slate-200 bg-white hover:border-blue-200 transition-colors flex items-start justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded font-mono">
                          v{rev.version}
                        </span>
                        <span className="text-slate-400 font-medium">{rev.date}</span>
                        <span className="text-slate-500 font-medium">por {rev.author}</span>
                      </div>
                      <p className="text-slate-700 mt-1 font-medium">{rev.description}</p>
                    </div>

                    {rev.snapshotData && (
                      <button
                        onClick={() => handleRestoreSnapshot(rev)}
                        title="Restaurar el estado de esta instantánea"
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-blue-50 text-blue-700 font-semibold flex items-center gap-1 shrink-0 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restaurar</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 text-white rounded hover:bg-slate-900"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
