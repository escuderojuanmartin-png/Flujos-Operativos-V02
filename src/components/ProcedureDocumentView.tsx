import React, { useState } from 'react';
import { ProcessModel, ProcessActivity, ActivityType, ItemEvidenceStatus } from '../types/process';
import {
  Plus,
  Trash2,
  Edit3,
  ShieldAlert,
  ArrowDown,
  HelpCircle,
  Laptop,
  Quote,
  CheckCircle2,
  ExternalLink,
  X,
  FileSearch,
  Sparkles,
} from 'lucide-react';

interface Props {
  process: ProcessModel;
  selectedActivityId: string | null;
  onSelectActivity: (id: string) => void;
  onUpdateProcess: (updated: ProcessModel) => void;
}

export const ProcedureDocumentView: React.FC<Props> = ({
  process,
  selectedActivityId,
  onSelectActivity,
  onUpdateProcess,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [evidenceModalAct, setEvidenceModalAct] = useState<ProcessActivity | null>(null);
  const [docTab, setDocTab] = useState<'steps' | 'narrative'>('steps');
  const [copiedNarrative, setCopiedNarrative] = useState(false);
  const [isEditingNarrative, setIsEditingNarrative] = useState(false);
  const [narrativeContent, setNarrativeContent] = useState(process.procedureNarrative || '');

  // Keep narrative in sync when switching processes
  React.useEffect(() => {
    setNarrativeContent(process.procedureNarrative || '');
    setIsEditingNarrative(false);
  }, [process.id, process.procedureNarrative]);

  const defaultNarrative = React.useMemo(() => {
    if (process.procedureNarrative) return process.procedureNarrative;
    const rolesList = Array.from(new Set(process.activities.map((a) => a.role)));
    return `PROCEDIMIENTO OPERATIVO NORMALIZADO (ISO 9001:2026)
CÓDIGO: ${process.code || 'PR-01'} | VERSIÓN: ${process.version || '1.0'} | ESTADO: ${process.status.toUpperCase()}
TÍTULO: ${process.name.toUpperCase()}

1. OBJETO Y JUSTIFICACIÓN
${process.objective || 'Definir, estandarizar y asegurar la trazabilidad operativa conforme a los requisitos de la norma ISO 9001:2026.'}

2. ALCANCE Y LÍMITES OPERATIVOS
${process.scope || 'Aplica a las actividades y decisiones documentadas en el relevamiento de la empresa.'}
• Evento Inicial (Disparador): ${process.trigger || 'Inicio'}
• Evento Final (Resultado Conforme): ${process.result || 'Fin'}

3. MATRIZ DE RESPONSABILIDADES Y ROLES
${rolesList.map((r) => `• ${r}: Responsable de ejecutar conforme las tareas asignadas y generar la evidencia documental correspondiente.`).join('\n')}

4. DESARROLLO NARRATIVO Y OPERATIVO PASO A PASO
${process.activities
  .map(
    (a) =>
      `4.${a.stepNumber}. ${a.name.toUpperCase()} [${a.type.toUpperCase()}]
- Rol Ejecutor: ${a.role}${a.system ? ` | Herramienta/Canal: ${a.system}` : ''}
- Desarrollo Operativo: ${a.description}
- Evidencia AS-IS: "${a.sourceQuote || 'Verificado en transcripción literal'}"`
  )
  .join('\n\n')}

5. GESTIÓN DE EXCEPCIONES Y BIFURCACIONES
En los puntos de decisión o control, si se detectan incidencias o solicitudes de posposición/rechazo, se aplica de inmediato la rama alternativa documentada en el flujo, registrando el motivo de la no conformidad y reprogramando la acción según corresponda.

6. REGISTROS DE CALIDAD Y AUDITORÍA
Las acciones realizadas generan registros electrónicos auditables en el sistema, asegurando la trazabilidad exigida por el Sistema de Gestión de Calidad ISO 9001.`;
  }, [process]);

  const handleCopyNarrative = () => {
    navigator.clipboard.writeText(narrativeContent || defaultNarrative);
    setCopiedNarrative(true);
    setTimeout(() => setCopiedNarrative(false), 2000);
  };

  const handleSaveNarrative = () => {
    onUpdateProcess({
      ...process,
      procedureNarrative: narrativeContent,
      updatedAt: new Date().toISOString(),
    });
    setIsEditingNarrative(false);
  };

  const handleUpdateActivity = (activityId: string, updates: Partial<ProcessActivity>) => {
    const updatedActivities = process.activities.map((a) => {
      if (a.id === activityId) {
        return {
          ...a,
          ...updates,
          status: 'user_modified' as ItemEvidenceStatus,
          verifiedByHuman: true,
        };
      }
      return a;
    });

    onUpdateProcess({
      ...process,
      activities: updatedActivities,
      updatedAt: new Date().toISOString(),
    });
  };

  // Safe Insertion (Section 5.3):
  // When inserting between A and B (A -> B), transforms into A -> New -> B without leaving dangling or duplicate connections.
  const handleAddActivity = (afterId?: string) => {
    const newId = `act_${Date.now()}`;
    const newActivity: ProcessActivity = {
      id: newId,
      stepNumber: 0,
      name: 'Nueva actividad operativa',
      description: 'Descripción del procedimiento...',
      role: 'Pendiente de definir',
      type: 'action',
      status: 'user_modified',
      verifiedByHuman: true,
    };

    let updatedActivities = [...process.activities];
    let updatedConnections = [...process.connections];

    if (afterId) {
      const idx = updatedActivities.findIndex((a) => a.id === afterId);
      if (idx !== -1) {
        updatedActivities.splice(idx + 1, 0, newActivity);

        // Find existing outgoing connection from afterId
        const outgoingConns = updatedConnections.filter((c) => c.from === afterId);
        if (outgoingConns.length === 1) {
          const oldTarget = outgoingConns[0].to;
          // Replace A -> B with A -> New and New -> B
          updatedConnections = updatedConnections.filter((c) => !(c.from === afterId && c.to === oldTarget));
          updatedConnections.push({ from: afterId, to: newId });
          updatedConnections.push({ from: newId, to: oldTarget });
        } else {
          // If 0 or multiple outgoing (e.g., decision), add direct connection to new step
          updatedConnections.push({ from: afterId, to: newId });
        }
      } else {
        updatedActivities.push(newActivity);
      }
    } else {
      updatedActivities.push(newActivity);
      if (process.activities.length > 0) {
        const lastAct = process.activities[process.activities.length - 1];
        updatedConnections.push({ from: lastAct.id, to: newId });
      }
    }

    // Recalculate step numbers
    updatedActivities = updatedActivities.map((a, i) => ({
      ...a,
      stepNumber: i + 1,
    }));

    onUpdateProcess({
      ...process,
      activities: updatedActivities,
      connections: updatedConnections,
      updatedAt: new Date().toISOString(),
    });

    onSelectActivity(newId);
    setEditingId(newId);
  };

  // Safe Deletion (Section 5.3):
  // Safely removes activity and reconnects A -> B if it was a single chain A -> X -> B
  const handleDeleteActivity = (id: string) => {
    if (process.activities.length <= 1) return;

    const incoming = process.connections.filter((c) => c.to === id);
    const outgoing = process.connections.filter((c) => c.from === id);

    let updatedConnections = process.connections.filter((c) => c.from !== id && c.to !== id);

    // If simple 1-to-1 chain (A -> X -> B), bridge A -> B
    if (incoming.length === 1 && outgoing.length === 1) {
      const bridgeFrom = incoming[0].from;
      const bridgeTo = outgoing[0].to;
      if (bridgeFrom !== bridgeTo) {
        updatedConnections.push({
          from: bridgeFrom,
          to: bridgeTo,
          label: outgoing[0].label || incoming[0].label,
        });
      }
    }

    const updatedActivities = process.activities
      .filter((a) => a.id !== id)
      .map((a, i) => ({ ...a, stepNumber: i + 1 }));

    onUpdateProcess({
      ...process,
      activities: updatedActivities,
      connections: updatedConnections,
      updatedAt: new Date().toISOString(),
    });

    if (selectedActivityId === id) {
      onSelectActivity(updatedActivities[0]?.id || '');
    }
  };

  const handleVerifyEvidence = (act: ProcessActivity) => {
    handleUpdateActivity(act.id, {
      status: 'confirmed',
      verifiedByHuman: true,
    });
    if (evidenceModalAct?.id === act.id) {
      setEvidenceModalAct({
        ...evidenceModalAct,
        status: 'confirmed',
        verifiedByHuman: true,
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-white p-5 rounded-lg border border-slate-200 relative text-left">
      {/* ISO Header Card */}
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/70 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-blue-700 uppercase">
              {process.docType}
            </span>
            <h2 className="text-lg font-bold text-slate-900">{process.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 font-mono text-slate-700 font-semibold">
              {process.code || 'PR-01'}
            </span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-white border border-slate-200 font-mono text-slate-700">
              v{process.version || '1.0'}
            </span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                process.status === 'validado'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {process.status.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-xs text-slate-600">
          <div>
            <strong className="text-slate-800">Objetivo:</strong>{' '}
            {process.objective || 'Definir el flujo de trabajo AS-IS.'}
          </div>
          <div>
            <strong className="text-slate-800">Alcance:</strong>{' '}
            {process.scope || 'Operaciones documentadas en la reunión.'}
          </div>
          <div>
            <strong className="text-slate-800">Disparador:</strong>{' '}
            {process.trigger || 'Recepción o inicio de solicitud.'}
          </div>
          <div>
            <strong className="text-slate-800">Resultado:</strong>{' '}
            {process.result || 'Entrega o registro completado.'}
          </div>
        </div>
      </div>

      {/* View Mode Tabs: Steps vs Narrative */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDocTab('steps')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              docTab === 'steps'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Secuencia Operativa ({process.activities.length} pasos)</span>
          </button>
          <button
            onClick={() => setDocTab('narrative')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
              docTab === 'narrative'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>Manual de Procedimiento Oficial (Narrativa ISO 9001)</span>
          </button>
        </div>

        {docTab === 'narrative' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyNarrative}
              className="text-xs flex items-center gap-1 px-3 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
            >
              <span>{copiedNarrative ? '✓ Copiado al portapapeles' : 'Copiar Texto Completo'}</span>
            </button>
            <button
              onClick={() => {
                if (isEditingNarrative) {
                  handleSaveNarrative();
                } else {
                  setIsEditingNarrative(true);
                }
              }}
              className={`text-xs flex items-center gap-1 px-3 py-1 rounded font-semibold transition-colors ${
                isEditingNarrative
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <span>{isEditingNarrative ? 'Guardar Cambios' : 'Editar Manual'}</span>
            </button>
          </div>
        )}
      </div>

      {/* NARRATIVE VIEW TAB */}
      {docTab === 'narrative' ? (
        <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-6 text-slate-800 shadow-2xs font-sans text-left">
          {isEditingNarrative ? (
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Editor del Manual Oficial de Procedimiento:
              </div>
              <textarea
                rows={22}
                value={narrativeContent || defaultNarrative}
                onChange={(e) => setNarrativeContent(e.target.value)}
                className="w-full font-mono text-xs p-4 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 leading-relaxed text-slate-900"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setIsEditingNarrative(false)}
                  className="px-3 py-1 text-xs font-semibold rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNarrative}
                  className="px-4 py-1 text-xs font-bold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Guardar Manual Actualizado
                </button>
              </div>
            </div>
          ) : (
            <div className="prose prose-slate max-w-none text-xs leading-relaxed">
              <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 bg-transparent p-0 m-0 border-0 leading-relaxed font-normal">
                {narrativeContent || defaultNarrative}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Activities Section Header */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <span>Desarrollo del Procedimiento (Secuencia Operativa AS-IS)</span>
              <span className="text-xs font-normal text-slate-500">
                ({process.activities.length} pasos)
              </span>
            </h3>
            <button
              onClick={() => handleAddActivity()}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir Paso al Final
            </button>
          </div>

          {/* Step Cards List */}
          <div className="space-y-3">
        {process.activities.map((act) => {
          const isSelected = selectedActivityId === act.id;
          const isEditing = editingId === act.id;
          const isPendingRole = act.role === 'Pendiente de definir' || !act.role;

          // Evidence Status
          const evidenceStatus = act.status || (act.sourceQuote ? 'confirmed' : 'inferred');

          return (
            <div key={act.id} className="relative group">
              <div
                onClick={() => onSelectActivity(act.id)}
                className={`rounded-lg border p-4 transition-all text-left ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/30 ring-1 ring-blue-400'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        act.type === 'start'
                          ? 'bg-emerald-100 text-emerald-800'
                          : act.type === 'end'
                          ? 'bg-slate-200 text-slate-800'
                          : act.type === 'decision'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {act.stepNumber}
                    </span>

                    {isEditing ? (
                      <input
                        type="text"
                        value={act.name}
                        onChange={(e) => handleUpdateActivity(act.id, { name: e.target.value })}
                        className="text-sm font-bold text-slate-900 border border-slate-300 rounded px-2 py-0.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-900">{act.name}</span>
                    )}

                    <span className="text-[10px] px-2 py-0.5 rounded uppercase font-semibold bg-slate-100 text-slate-600">
                      {act.type}
                    </span>

                    {/* Traceability Badge (Section 3.2) */}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${
                        evidenceStatus === 'confirmed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : evidenceStatus === 'user_modified'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {evidenceStatus === 'confirmed' && '✓ Confirmado en fuente'}
                      {evidenceStatus === 'user_modified' && '✎ Modificado por usuario'}
                      {evidenceStatus === 'inferred' && '⚠ Requiere validación'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Traceability: View Source Quote Button (Section 3.2) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEvidenceModalAct(act);
                      }}
                      title="Ver origen en la transcripción"
                      className="px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-800 flex items-center gap-1 transition-colors"
                    >
                      <Quote className="w-3 h-3 text-blue-600" />
                      <span>Ver origen</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(isEditing ? null : act.id);
                      }}
                      title="Editar datos del paso"
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteActivity(act.id);
                      }}
                      title="Eliminar paso"
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Meta details: Role, System, Exceptions */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Responsable:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={act.role}
                        onChange={(e) => handleUpdateActivity(act.id, { role: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-0.5 text-xs text-blue-700 font-semibold"
                      />
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          isPendingRole ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {act.role || 'Pendiente de definir'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 ml-2">
                    <span className="text-slate-400 font-medium">Sistema/Herramienta:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={act.system || ''}
                        placeholder="SAP, Excel, etc."
                        onChange={(e) => handleUpdateActivity(act.id, { system: e.target.value })}
                        className="border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-700"
                      />
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
                        {act.system || 'N/A'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-slate-400 font-medium">Tipo:</span>
                    {isEditing ? (
                      <select
                        value={act.type}
                        onChange={(e) =>
                          handleUpdateActivity(act.id, { type: e.target.value as ActivityType })
                        }
                        className="border border-slate-300 rounded px-2 py-0.5 text-xs"
                      >
                        <option value="start">Inicio</option>
                        <option value="action">Actividad</option>
                        <option value="decision">Decisión</option>
                        <option value="end">Fin</option>
                      </select>
                    ) : (
                      <span className="text-slate-600 font-medium">{act.type}</span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="mt-2.5 text-xs text-slate-800 leading-relaxed bg-slate-50/60 p-3 rounded-md border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Desarrollo Operativo:
                  </div>
                  {isEditing ? (
                    <textarea
                      rows={3}
                      value={act.description}
                      onChange={(e) => handleUpdateActivity(act.id, { description: e.target.value })}
                      className="w-full border border-slate-300 rounded p-2 text-xs text-slate-900 bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="whitespace-pre-line font-normal text-slate-800">{act.description}</p>
                  )}
                </div>

                {/* Decision Branch Overview (if decision node) */}
                {act.type === 'decision' && (
                  <div className="mt-3 bg-amber-50/80 border border-amber-200/90 rounded-md p-2.5">
                    <div className="text-[11px] font-bold text-amber-900 mb-1.5 flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Caminos de Bifurcación Evaluados:</span>
                    </div>
                    {process.connections.filter((c) => c.from === act.id).length > 0 ? (
                      <div className="space-y-1.5">
                        {process.connections
                          .filter((c) => c.from === act.id)
                          .map((c, cIdx) => {
                            const destAct = process.activities.find((a) => a.id === c.to);
                            const isNeg = (c.label || '').toLowerCase().includes('posp') || (c.label || '').toLowerCase().includes('no');
                            return (
                              <div key={cIdx} className="flex items-center gap-2 text-xs">
                                <span
                                  className={`px-2 py-0.5 rounded font-bold text-[10px] border shadow-2xs ${
                                    isNeg
                                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  }`}
                                >
                                  {c.label || 'Vía normal'}
                                </span>
                                <span className="text-slate-400">➔</span>
                                <span className="font-semibold text-slate-900">
                                  {destAct ? `Paso ${destAct.stepNumber}: ${destAct.name}` : c.to}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="text-[11px] text-amber-800 italic">
                        Sin bifurcaciones explícitas conectadas. Se requiere registrar la alternativa AS-IS.
                      </div>
                    )}
                  </div>
                )}

                {/* Exceptions note if any */}
                {act.exceptions && (
                  <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Excepción:</span> {act.exceptions}
                    </div>
                  </div>
                )}
              </div>

              {/* Inline Insert Step Button between cards */}
              <div className="flex justify-center -my-1 relative z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleAddActivity(act.id)}
                  title="Insertar paso a continuación con reconexión segura"
                  className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 shadow-xs flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Insertar paso aquí</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
        </>
      )}

      {/* Traceability Modal (Section 3.2: "Ver origen en la transcripción") */}
      {evidenceModalAct && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold">Origen en la Transcripción</h3>
              </div>
              <button
                onClick={() => setEvidenceModalAct(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700">
              <div className="border-b border-slate-100 pb-3">
                <div className="text-[11px] text-slate-400 uppercase font-bold">Actividad Documentada:</div>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  Paso {evidenceModalAct.stepNumber}: {evidenceModalAct.name}
                </div>
                <div className="text-slate-600 mt-1">{evidenceModalAct.description}</div>
              </div>

              <div>
                <div className="text-[11px] text-blue-800 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <Quote className="w-3.5 h-3.5 text-blue-600" />
                  <span>Evidencia Textual de la Entrevista</span>
                </div>
                <div className="bg-blue-50/60 border border-blue-200 rounded-lg p-3.5 italic text-slate-800 leading-relaxed">
                  "{evidenceModalAct.sourceQuote || evidenceModalAct.description}"
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Ubicación en reunión:</span>
                  <span className="font-semibold text-slate-800">
                    {evidenceModalAct.sourceTimestamp || 'Entrevista AS-IS'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Estado de evidencia:</span>
                  <span
                    className={`font-semibold ${
                      evidenceModalAct.status === 'confirmed'
                        ? 'text-emerald-700'
                        : evidenceModalAct.status === 'user_modified'
                        ? 'text-blue-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {evidenceModalAct.status === 'confirmed'
                      ? 'Confirmado en fuente'
                      : evidenceModalAct.status === 'user_modified'
                      ? 'Modificado por analista'
                      : 'Inferido (Pendiente de validar)'}
                  </span>
                </div>
              </div>

              {process.transcriptText && (
                <div>
                  <div className="text-[11px] text-slate-500 font-bold uppercase mb-1">
                    Contexto de la conversación:
                  </div>
                  <div className="max-h-32 overflow-y-auto bg-slate-100 p-2.5 rounded text-[11px] text-slate-600 font-mono whitespace-pre-wrap">
                    {process.transcriptText}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleVerifyEvidence(evidenceModalAct)}
                  className="px-3.5 py-1.5 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar evidencia válida</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEvidenceModalAct(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
