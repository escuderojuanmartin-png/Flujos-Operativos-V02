import React, { useState } from 'react';
import { ProcessModel, ValidationQuestion, ProcessStatus } from '../types/process';
import { CheckCircle2, Clock, AlertCircle, Quote, MessageSquare, Send, Check } from 'lucide-react';

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
  const [isUpdating, setIsUpdating] = useState(false);

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

  const handleAnswerChange = (qId: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: val }));
  };

  const handleSaveAnswer = async (q: ValidationQuestion) => {
    const userAnswer = answers[q.id]?.trim();
    if (!userAnswer) return;

    const updatedQuestions = activeProcess.validationQuestions.map((item) => {
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

    const updatedProcess = {
      ...activeProcess,
      validationQuestions: updatedQuestions,
      status: (pendingCount <= 1 ? 'en_revision' : 'pendiente_informacion') as ProcessStatus,
      updatedAt: new Date().toISOString(),
    };

    onUpdateProcess(updatedProcess);

    // Call Gemini to update the structured model incorporating the user's answer
    setIsUpdating(true);
    try {
      await onRefreshWithGemini(updatedProcess, [{ ...q, userAnswer }]);
    } catch (err) {
      console.error('Error applying answer to model:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMarkNotApplicable = (qId: string) => {
    const updatedQuestions = activeProcess.validationQuestions.map((item) => {
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

  const handleMarkPending = (qId: string) => {
    const updatedQuestions = activeProcess.validationQuestions.map((item) => {
      if (item.id === qId) {
        return {
          ...item,
          status: 'pending' as const,
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
    onUpdateProcess({
      ...activeProcess,
      status: 'validado',
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Process Selection Header */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Proceso a validar:
          </label>
          <select
            value={activeProcess.id}
            onChange={(e) => setSelectedProcessId(e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-800 bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          >
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `[${p.code}] ` : ''}{p.name} ({p.docType})
              </option>
            ))}
          </select>
        </div>

        {/* Validation Status & Manual Approval */}
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
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar Validación Oficial
            </button>
          ) : (
            <span className="flex items-center gap-1 text-xs text-emerald-700 font-semibold bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200">
              <Check className="w-4 h-4" /> Proceso Validado por el Usuario
            </span>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Preguntas Totales</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{questions.length}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs text-amber-600 font-medium">Pendientes de Aclarar</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{pendingCount}</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs text-emerald-600 font-medium">Respondidas / Integradas</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{answeredCount}</div>
        </div>
      </div>

      {/* Questions list */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
          Preguntas de Validación (Detección de Información Incompleta o Ambigua)
        </h3>

        {questions.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No se identificaron lagunas críticas en la conversación. El proceso cuenta con datos completos para diagramación.
          </div>
        ) : (
          questions.map((q) => {
            const isAnswered = q.status === 'answered';
            const isNotApplicable = q.status === 'not_applicable';

            return (
              <div
                key={q.id}
                className={`p-4 rounded-lg border text-left transition-all ${
                  isAnswered
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : isNotApplicable
                    ? 'border-slate-200 bg-slate-50 opacity-60'
                    : 'border-amber-200 bg-amber-50/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs ${
                        isAnswered
                          ? 'bg-emerald-500 text-white'
                          : isNotApplicable
                          ? 'bg-slate-300 text-slate-700'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      {isAnswered ? '✓' : '?'}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{q.question}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{q.reason}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {q.status === 'pending' ? (
                      <button
                        onClick={() => handleMarkNotApplicable(q.id)}
                        className="text-[11px] px-2 py-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                      >
                        No corresponde
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkPending(q.id)}
                        className="text-[11px] px-2 py-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                      >
                        Reabrir pregunta
                      </button>
                    )}
                  </div>
                </div>

                {/* Original Quote from transcription if available */}
                {q.originalQuote && (
                  <div className="mt-2.5 p-2 rounded bg-white/80 border border-slate-200 text-xs text-slate-600 flex items-start gap-1.5 italic">
                    <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>"{q.originalQuote}"</span>
                  </div>
                )}

                {/* Answer Area */}
                {isAnswered ? (
                  <div className="mt-3 p-3 rounded bg-emerald-50 border border-emerald-200 text-xs">
                    <div className="font-semibold text-emerald-800 mb-1">Respuesta confirmada:</div>
                    <div className="text-slate-800">{q.userAnswer}</div>
                  </div>
                ) : !isNotApplicable ? (
                  <div className="mt-3 pt-3 border-t border-amber-200/60 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Escribe la aclaración (ej. 'El responsable es el Jefe de Almacén' o 'Se comprueba contra el albarán en papel')..."
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveAnswer(q);
                      }}
                      className="flex-1 text-xs border border-slate-300 rounded px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                    <button
                      onClick={() => handleSaveAnswer(q)}
                      disabled={!answers[q.id]?.trim() || isUpdating}
                      className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      {isUpdating ? 'Actualizando...' : 'Responder y Actualizar'}
                    </button>
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
