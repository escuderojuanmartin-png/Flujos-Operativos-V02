import React, { useState } from 'react';
import { ProcessModel, ImprovementFinding } from '../types/process';
import {
  Lock,
  Lightbulb,
  AlertOctagon,
  Plus,
  ShieldCheck,
  TrendingUp,
  Tag,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface Props {
  processes: ProcessModel[];
  onUpdateProcess: (updated: ProcessModel) => void;
}

export const ImprovementView: React.FC<Props> = ({ processes, onUpdateProcess }) => {
  const [selectedProcessId, setSelectedProcessId] = useState<string>(processes[0]?.id || '');
  const [isCreating, setIsCreating] = useState(false);

  // New manual finding state
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'pain_point' | 'opportunity'>('pain_point');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState('');
  const [impact, setImpact] = useState('');
  const [proposal, setProposal] = useState('');
  const [priority, setPriority] = useState<'alta' | 'media' | 'baja'>('media');
  const [relatedActivityId, setRelatedActivityId] = useState('');

  const activeProcess = processes.find((p) => p.id === selectedProcessId) || processes[0];

  if (!activeProcess) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500">
        <p className="font-semibold text-slate-700">No hay procesos disponibles</p>
      </div>
    );
  }

  const findings = activeProcess.privateImprovements || [];
  const painPoints = findings.filter((f) => f.type === 'pain_point');
  const opportunities = findings.filter((f) => f.type === 'opportunity');

  const handleAddManualFinding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const newFinding: ImprovementFinding = {
      id: `imp_${Date.now()}`,
      type,
      title: title.trim(),
      description: description.trim(),
      evidence: evidence.trim() || 'Registrado por el consultor durante el relevamiento.',
      impact: impact.trim() || 'Riesgo operativo o cuello de botella.',
      proposal: proposal.trim() || 'Pendiente de definir.',
      priority,
      status: 'detectado',
      relatedActivityId: relatedActivityId || undefined,
      isManual: true,
    };

    onUpdateProcess({
      ...activeProcess,
      privateImprovements: [newFinding, ...findings],
      updatedAt: new Date().toISOString(),
    });

    setTitle('');
    setDescription('');
    setEvidence('');
    setImpact('');
    setProposal('');
    setIsCreating(false);
  };

  const handleUpdateStatus = (
    findingId: string,
    status: 'detectado' | 'en_analisis' | 'descartado' | 'aprobado'
  ) => {
    const updatedFindings = findings.map((f) => {
      if (f.id === findingId) {
        return { ...f, status };
      }
      return f;
    });

    onUpdateProcess({
      ...activeProcess,
      privateImprovements: updatedFindings,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Strict Privacy Banner */}
      <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-300 flex items-start gap-3">
        <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed text-left">
          <strong className="font-bold block text-sm mb-0.5 text-amber-950">
            Área de Análisis Privado de Consultoría — Estrictamente Confidencial
          </strong>
          Este módulo está aislado de los entregables oficiales. Ningún punto de dolor, hipótesis de
          riesgo u oportunidad aquí documentada se incluirá en los archivos oficiales de Word (.docx) o PDF
          generados para el cliente.
        </div>
      </div>

      {/* Process Selector & Action */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Proceso analizado:
          </label>
          <select
            value={activeProcess.id}
            onChange={(e) => setSelectedProcessId(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-800 bg-white"
          >
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `[${p.code}] ` : ''}{p.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Registrar Hallazgo Manual
        </button>
      </div>

      {/* Manual Finding Form */}
      {isCreating && (
        <form
          onSubmit={handleAddManualFinding}
          className="bg-white p-5 rounded-lg border border-blue-200 shadow-xs space-y-3 text-left"
        >
          <h4 className="text-xs font-bold uppercase text-blue-800 tracking-wider">
            Nuevo Punto de Dolor u Oportunidad
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Tipo de Hallazgo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs"
              >
                <option value="pain_point">Punto de Dolor / Cuello de Botella</option>
                <option value="opportunity">Oportunidad de Automatización / Mejora</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Prioridad</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs"
              >
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Actividad Relacionada</label>
              <select
                value={relatedActivityId}
                onChange={(e) => setRelatedActivityId(e.target.value)}
                className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-xs"
              >
                <option value="">(General del Proceso)</option>
                {activeProcess.activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    Paso {a.stepNumber}: {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-500 block mb-1">Título del Hallazgo *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Registro manual duplicado entre albarán y SAP"
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Descripción Detallada *</label>
              <textarea
                required
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Propuesta Preliminar</label>
              <textarea
                rows={2}
                value={proposal}
                onChange={(e) => setProposal(e.target.value)}
                placeholder="Ej. Integración EDI o escaneo de código de barras..."
                className="w-full border border-slate-300 rounded p-2 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Guardar Hallazgo
            </button>
          </div>
        </form>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-rose-600 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <AlertOctagon className="w-3.5 h-3.5" /> Puntos de Dolor Identificados
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{painPoints.length}</div>
          </div>
          <span className="text-[11px] text-slate-400">Riesgos y cuellos de botella</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-xs text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Oportunidades de Optimización
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">{opportunities.length}</div>
          </div>
          <span className="text-[11px] text-slate-400">Automatizaciones y mejoras</span>
        </div>
      </div>

      {/* Findings Cards List */}
      <div className="space-y-4">
        {findings.length === 0 ? (
          <div className="bg-white p-10 rounded-lg border border-slate-200 text-center text-slate-500 text-sm">
            No se han registrado hallazgos privados para este proceso todavía.
          </div>
        ) : (
          findings.map((f) => {
            const isPainPoint = f.type === 'pain_point';
            const relatedAct = activeProcess.activities.find((a) => a.id === f.relatedActivityId);

            return (
              <div
                key={f.id}
                className="bg-white rounded-lg border border-slate-200 p-5 text-left space-y-3 shadow-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 ${
                        isPainPoint
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isPainPoint ? <AlertOctagon className="w-3 h-3" /> : <Lightbulb className="w-3 h-3" />}
                      {isPainPoint ? 'Punto de Dolor' : 'Oportunidad'}
                    </span>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        f.priority === 'alta'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : f.priority === 'media'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      Prioridad {f.priority}
                    </span>

                    {f.isManual ? (
                      <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-semibold">
                        Anotación Manual
                      </span>
                    ) : (
                      <span className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-semibold">
                        Detectado por Gemini
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-xs text-slate-400 mr-1">Estado:</span>
                    <select
                      value={f.status}
                      onChange={(e) => handleUpdateStatus(f.id, e.target.value as any)}
                      className="border border-slate-300 rounded px-2 py-0.5 text-xs bg-slate-50 font-medium"
                    >
                      <option value="detectado">Detectado</option>
                      <option value="en_analisis">En Análisis</option>
                      <option value="aprobado">Aprobado para propuesta</option>
                      <option value="descartado">Descartado</option>
                    </select>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900">{f.title}</h4>
                  <p className="text-xs text-slate-700 mt-1 leading-relaxed">{f.description}</p>
                </div>

                {relatedAct && (
                  <div className="text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded inline-block">
                    Vinculado a: <strong>Paso {relatedAct.stepNumber}: {relatedAct.name}</strong> ({relatedAct.role})
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3 rounded border border-slate-200/60">
                  <div>
                    <strong className="text-slate-800 block mb-0.5">Evidencia en el relato:</strong>
                    <span className="italic text-slate-600">"{f.evidence}"</span>
                  </div>
                  <div>
                    <strong className="text-slate-800 block mb-0.5">Propuesta Preliminar:</strong>
                    <span className="text-blue-900 font-medium">{f.proposal || 'Por definir.'}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
