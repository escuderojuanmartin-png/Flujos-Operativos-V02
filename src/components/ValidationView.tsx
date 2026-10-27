import React, { useState } from 'react';
import { ProcessModel, ValidationQuestion, ProcessStatus } from '../types/process';
import { validateProcessGraph } from '../lib/graphValidation';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Quote,
  MessageSquare,
  Send,
  Check,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';

interface Props {
  processes: ProcessModel[];
  onUpdateProcess: (updated: ProcessModel) => void;
  onRefreshWithGemini: (process: ProcessModel, answeredQuestions: ValidationQuestion[]) => Promise<void>;
}

export const ValidationView: React.FC<Props> = ({
  processes,
  onUpdateProcess,
  onRefreshWithGemini,
}) => {
  const [selectedProcessId, setSelectedProcessId] = useState<string>(processes[0]?.id || '');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [justifications, setJustifications] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [showBlockerWarning, setShowBlockerWarning] = useState(false);

  const activeProcess = processes.find((p) => p.id === selectedProcessId) || processes[0];

  if (!activeProcess) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500">
        <AlertCircle className="w-10 h-10 mx-auto text-slate-400 mb-3" />
        <p className="font-semibold text-slate-700">No hay procesos activos para validar</p>
        <p className="text-xs text-slate-400 mt-1">Carga una transcripción y analiza la reunión primero.</p>
      </div>
    );
  }

  const questions = activeProcess.validationQuestions || [];
  const pendingCount = questions.filter((q) => q.status === 'pending').length;
  const answeredCount = questions.filter((q) => q.status === 'answered').length;

  // Run Graph & Rules validation
  const validation = validateProcessGraph(activeProcess);

  const handleAnswerChange = (qId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const handleSaveAnswer = async (q: ValidationQuestion) => {
    const userAnswer = answers[q.id]?.trim();
    if (!userAnswer) return;

    const updatedQuestions = (activeProcess.validationQuestions || []).map((item) => {
      if (item.id === q.id) {
        return {
          ...item,
          status: 'answered' as const,
          userAnswer,
          answeredAt: new Date().toISOString(),
        };
      }
      return item;
    });

    const updatedProcess: ProcessModel = {
      ...activeProcess,
      validationQuestions: updatedQuestions,
      status: (pendingCount <= 1 ? 'en_revision' : 'pendiente_informacion') as ProcessStatus,
      updatedAt: new Date().toISOString(),
    };

    onUpdateProcess(updatedProcess);

    // Call Gemini to apply controlled patch incorporating the user's answer
    setIsUpdating(true);
    try {
      await onRefreshWithGemini(updatedProcess, [{ ...q, userAnswer }]);
    } catch (err) {
      console.error('Error applying answer to model:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAcceptAsPendingWithJustification = (qId: string) => {
    const just = justifications[qId]?.trim() || 'Aceptado explícitamente como pendiente por el analista.';
    const updatedQuestions = (activeProcess.validationQuestions || []).map((item) => {
      if (item.id === qId) {
        return {
          ...item,
          status: 'accepted_pending' as const,
          justification: just,
          answeredAt: new Date().toISOString(),
        };
      }
      return item;
    });

    onUpdateProcess({
      ...activeProcess,
      validationQuestions: updatedQuestions,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleMarkNotApplicable = (qId: string) => {
    const updatedQuestions = (activeProcess.validationQuestions || []).map((item) => {
      if (item.id === qId) {
        return {
          ...item,
          status: 'not_applicable' as const,
          answeredAt: new Date().toISOString(),
        };
      }
      return item;
    });

    onUpdateProcess({
      ...activeProcess,
      validationQuestions: updatedQuestions,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleConfirmValidation = () => {
    // Section 4.1: Strictly block validation if critical questions remain or graph is broken
    if (!validation.canValidate) {
      setShowBlockerWarning(true);
      return;
    }

    setShowBlockerWarning(false);
    onUpdateProcess({
      ...activeProcess,
      status: 'validado',
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Process Selection Header */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Proceso a validar:
          </label>
          <select
            value={activeProcess.id}
            onChange={(e) => {
              setSelectedProcessId(e.target.value);
              setShowBlockerWarning(false);
            }}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-800 bg-white"
          >
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `[${p.code}] ` : ''}{p.name} ({p.docType})
              </option>
            ))}
          </select>
        </div>

        {/* Validation Status & Approval Action */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-500 block">Estado actual:</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                activeProcess.status === 'validado'
                  ? 'bg-emerald-100 text-emerald-800'
                  : activeProcess.status === 'en_revision'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {activeProcess.status.replace('_', ' ')}
            </span>
          </div>

          {activeProcess.status !== 'validado' ? (
            <button
              onClick={handleConfirmValidation}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md font-semibold text-xs shadow-xs transition-colors cursor-pointer ${
                validation.canValidate
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Marcar como Validado por el Usuario</span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200">
              <Check className="w-4 h-4" /> Validado internamente por el analista
            </span>
          )}
        </div>
      </div>

      {/* Validation Blocker Warning Banner (Section 4.1) */}
      {(!validation.canValidate || showBlockerWarning) && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-300 flex items-start gap-3 text-left">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900 leading-relaxed">
            <strong className="font-bold text-sm block mb-1 text-rose-950">
              Validación Bloqueada — Inconsistencias Operativas o Preguntas Críticas Abiertas
            </strong>
            <p className="mb-2">
              Conforme a las buenas prácticas de ingeniería de procesos, no es posible marcar este proceso como
              validado hasta resolver los siguientes puntos críticos:
            </p>
            <ul className="list-disc pl-4 space-y-1 font-medium">
              {validation.issues
                .filter((i) => i.severity === 'error')
                .map((issue, idx) => (
                  <li key={idx}>{issue.message}</li>
                ))}
            </ul>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 text-left">
          <div className="text-xs text-slate-500 font-medium">Preguntas Totales</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{questions.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 text-left">
          <div className="text-xs text-amber-600 font-medium">Pendientes de Aclarar</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 text-left">
          <div className="text-xs text-emerald-600 font-medium">Respondidas / Integradas</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{answeredCount}</div>
        </div>
      </div>

      {/* Questions List */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4 text-left">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Preguntas de Validación (Detección de Información Incompleta o Ambigua)
          </h3>
          <span className="text-xs text-slate-500">
            {pendingCount === 0 ? 'Sin preguntas pendientes' : `${pendingCount} pendiente(s)`}
          </span>
        </div>

        {questions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No se identificaron lagunas críticas en la conversación. El proceso cuenta con datos completos para diagramación.
          </div>
        ) : (
          questions.map((q) => {
            const isAnswered = q.status === 'answered';
            const isNotApplicable = q.status === 'not_applicable';
            const isAcceptedPending = q.status === 'accepted_pending';
            const isCritical = q.criticality === 'critica';

            return (
              <div
                key={q.id}
                className={`p-4 rounded-lg border text-left transition-all ${
                  isAnswered
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isNotApplicable || isAcceptedPending
                    ? 'border-slate-200 bg-slate-50 opacity-70'
                    : isCritical
                    ? 'border-rose-300 bg-rose-50/30 ring-1 ring-rose-200'
                    : 'border-amber-200 bg-amber-50/20'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                        isAnswered
                          ? 'bg-emerald-500 text-white'
                          : isCritical
                          ? 'bg-rose-500 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {isAnswered ? '✓' : '!'}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                            isCritical
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : q.criticality === 'importante'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {q.criticality === 'critica' ? 'Crítica (Bloquea Validación)' : q.criticality}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{q.question}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{q.reason}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {q.status === 'pending' ? (
                      <button
                        onClick={() => handleMarkNotApplicable(q.id)}
                        className="text-[11px] px-2 py-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                      >
                        No corresponde
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-medium">
                        {isAnswered ? 'Respondida' : isAcceptedPending ? 'Aceptada pendiente' : 'Descartada'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Original Quote from transcription if available */}
                {q.originalQuote && (
                  <div className="mt-2.5 p-2 rounded bg-white/90 border border-slate-200 text-xs text-slate-600 flex items-start gap-1.5 italic">
                    <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>"{q.originalQuote}"</span>
                  </div>
                )}

                {/* Answer Area */}
                {isAnswered ? (
                  <div className="mt-3 p-3 rounded bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="font-semibold text-emerald-800 mb-0.5">Respuesta integrada:</div>
                    <div className="text-slate-800">{q.userAnswer}</div>
                  </div>
                ) : isAcceptedPending ? (
                  <div className="mt-3 p-2.5 rounded bg-slate-100 text-xs text-slate-700">
                    <strong className="text-slate-800">Justificación de postergación:</strong> {q.justification}
                  </div>
                ) : !isNotApplicable ? (
                  <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Escribe la aclaración (ej. 'El responsable es el Administrativo' o 'Si no coincide, se contacta a tráfico')..."
                        value={answers[q.id] || ''}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveAnswer(q);
                        }}
                        className="flex-1 text-xs border border-slate-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <button
                        onClick={() => handleSaveAnswer(q)}
                        disabled={!answers[q.id]?.trim() || isUpdating}
                        className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                      >
                        <Send className="w-3 h-3" />
                        {isUpdating ? 'Actualizando...' : 'Responder y Aplicar Parche'}
                      </button>
                    </div>

                    {isCritical && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-slate-400">
                          ¿No dispones de este dato ahora? Puedes justificar su postergación documental:
                        </span>
                        <button
                          onClick={() => handleAcceptAsPendingWithJustification(q.id)}
                          className="text-[11px] text-slate-600 hover:text-slate-900 underline font-medium cursor-pointer"
                        >
                          Aceptar como pendiente justificado
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
