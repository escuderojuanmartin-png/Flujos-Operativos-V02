import React, { useState } from 'react';
import { ProcessModel, ProcessActivity, ActivityType } from '../types/process';
import { Plus, Trash2, Edit3, ShieldAlert, ArrowDown, HelpCircle, Laptop } from 'lucide-react';

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

  const handleUpdateActivity = (activityId: string, updates: Partial<ProcessActivity>) => {
    const updatedActivities = process.activities.map((a) => {
      if (a.id === activityId) {
        return { ...a, ...updates };
      }
      return a;
    });

    onUpdateProcess({
      ...process,
      activities: updatedActivities,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddActivity = (afterId?: string) => {
    const newId = `act_${Date.now()}`;
    const newStepNumber = process.activities.length + 1;
    const newActivity: ProcessActivity = {
      id: newId,
      stepNumber: newStepNumber,
      name: 'Nueva actividad operativa',
      description: 'Detalle de la tarea que se realiza...',
      role: 'Pendiente de definir',
      type: 'action',
    };

    let updatedActivities = [...process.activities];
    if (afterId) {
      const idx = updatedActivities.findIndex((a) => a.id === afterId);
      if (idx !== -1) {
        updatedActivities.splice(idx + 1, 0, newActivity);
      } else {
        updatedActivities.push(newActivity);
      }
    } else {
      updatedActivities.push(newActivity);
    }

    // Recalculate step numbers
    updatedActivities = updatedActivities.map((a, i) => ({
      ...a,
      stepNumber: i + 1,
    }));

    // Update linear connection if needed
    const updatedConnections = [...process.connections];
    if (afterId) {
      updatedConnections.push({ from: afterId, to: newId });
    }

    onUpdateProcess({
      ...process,
      activities: updatedActivities,
      connections: updatedConnections,
      updatedAt: new Date().toISOString(),
    });

    onSelectActivity(newId);
    setEditingId(newId);
  };

  const handleDeleteActivity = (id: string) => {
    if (process.activities.length <= 1) return;
    const updatedActivities = process.activities
      .filter((a) => a.id !== id)
      .map((a, i) => ({ ...a, stepNumber: i + 1 }));

    const updatedConnections = process.connections.filter((c) => c.from !== id && c.to !== id);

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

  return (
    <div className="h-full overflow-y-auto bg-white p-5 rounded-lg border border-slate-200">
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

      {/* Activities Section */}
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
          Añadir Paso
        </button>
      </div>

      {/* Step Cards List */}
      <div className="space-y-3">
        {process.activities.map((act) => {
          const isSelected = selectedActivityId === act.id;
          const isEditing = editingId === act.id;
          const isPending = act.role === 'Pendiente de definir' || !act.role;

          return (
            <div
              key={act.id}
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
                </div>

                <div className="flex items-center gap-1">
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
                        isPending ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-700'
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
              <div className="mt-2.5 text-xs text-slate-700 leading-relaxed">
                {isEditing ? (
                  <textarea
                    rows={2}
                    value={act.description}
                    onChange={(e) => handleUpdateActivity(act.id, { description: e.target.value })}
                    className="w-full border border-slate-300 rounded p-2 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                ) : (
                  <p>{act.description}</p>
                )}
              </div>

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
          );
        })}
      </div>
    </div>
  );
};
