import React, { useState } from 'react';
import { Client, ProcessModel, DocType, ProcessActivity } from '../types/process';
import {
  Sparkles,
  FileText,
  Upload,
  Mic,
  ArrowRight,
  CheckCircle,
  HelpCircle,
  Layers,
  FileCode,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface Props {
  activeClient: Client | null;
  onAnalysisComplete: (processes: ProcessModel[], summary: string, targetIndex?: number) => void;
}

export const SurveyView: React.FC<Props> = ({ activeClient, onAnalysisComplete }) => {
  const [transcript, setTranscript] = useState('');
  const [surveyTitle, setSurveyTitle] = useState('Relevamiento de Operaciones Logísticas');
  const [audioFileName, setAudioFileName] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Analysis result intermediate stage before generating documents
  const [analysisResult, setAnalysisResult] = useState<{
    interviewSummary: string;
    identifiedUnits: any[];
  } | null>(null);

  // Synthetic Test Example from Section 16 of the User Prompt
  const loadSyntheticExample = () => {
    setSurveyTitle('Relevamiento de Operaciones Logísticas');
    setAudioFileName(null);
    setTranscript(`Entrevistador:
"Explicame cómo realizan la recepción de mercancías."

Operario:
"Cuando llega el camión, el administrativo revisa el albarán y comprueba que la matrícula corresponda con la reserva. Si está todo bien, le asignan el muelle de descarga. Después el carretillero descarga los palés y revisa si existe algún daño visible. Si encuentra daños, avisa al responsable del almacén y se registra una incidencia. Cuando termina, registra la recepción en SAP."

Entrevistador:
"¿Y cómo funciona la devolución de mercancías?"

Operario:
"Es diferente. Primero atención al cliente nos envía una solicitud de devolución. Almacén comprueba si la mercancía puede recibirse. Si se autoriza, se programa la llegada. Cuando llega el transporte, se descarga y se registra la devolución."

Entrevistador:
"¿Cómo se registra una recepción en SAP?"

Operario:
"Entramos a la transacción MIGO, seleccionamos el documento de referencia, introducimos las cantidades recibidas, verificamos los datos y contabilizamos."`);
    setErrorMsg(null);
    setAnalysisResult(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    const fileName = file.name;
    const ext = fileName.split('.').pop()?.toLowerCase();

    // Text file reading (.txt, .md, .srt, .vtt)
    if (['txt', 'md', 'srt', 'vtt'].includes(ext || '')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setTranscript((event.target?.result as string) || '');
        setAudioFileName(fileName);
      };
      reader.readAsText(file);
      return;
    }

    // Audio file handling (.mp3, .wav, .m4a, .webm)
    if (['mp3', 'wav', 'm4a', 'webm', 'ogg'].includes(ext || '')) {
      setIsTranscribing(true);
      setAudioFileName(fileName);
      const formData = new FormData();
      formData.append('audio', file);

      try {
        const res = await fetch('/api/gemini/transcribe-audio', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Fallo en la transcripción de audio');
        }

        const data = await res.json();
        setTranscript(data.transcript || '');
      } catch (err: any) {
        console.error(err);
        setErrorMsg(`Error al transcribir el audio: ${err.message}`);
      } finally {
        setIsTranscribing(false);
      }
      return;
    }

    setErrorMsg('Formato de archivo no admitido. Usa TXT, MD, SRT, VTT, MP3, WAV, M4A o WEBM.');
  };

  const handleAnalyze = async () => {
    if (!transcript.trim()) {
      setErrorMsg('Por favor ingresa o carga una transcripción antes de analizar.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/gemini/analyze-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptText: transcript,
          clientInfo: activeClient,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error al analizar la entrevista');
      }

      const data = await res.json();
      setAnalysisResult(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(`Error en el motor de análisis: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getDocTypeKey = (dt?: string): DocType => {
    const str = String(dt || '').toLowerCase();
    if (str.includes('instruct')) return 'instructivo';
    if (str.includes('proced')) return 'procedimiento';
    return 'proceso';
  };

  const handleClassificationChange = (index: number, newType: DocType) => {
    if (!analysisResult) return;
    setAnalysisResult((prev) => {
      if (!prev) return null;
      const updated = [...prev.identifiedUnits];
      updated[index] = {
        ...updated[index],
        docType: newType,
      };
      return {
        ...prev,
        identifiedUnits: updated,
      };
    });
  };

  const handleConfirmUnits = (targetIndex: number = 0) => {
    if (!analysisResult || !analysisResult.identifiedUnits || analysisResult.identifiedUnits.length === 0) return;

    // Convert identifiedUnits into full ProcessModel objects
    const processes: ProcessModel[] = analysisResult.identifiedUnits.map((unit, idx) => {
      const docType = getDocTypeKey(unit.docType);
      const codePrefix =
        docType === 'instructivo' ? 'IT' : docType === 'proceso' ? 'PR' : 'PO';
      const defaultCode = `${codePrefix}-${activeClient?.code || 'LOG'}-${String(idx + 1).padStart(2, '0')}`;
      const procId = `proc_${Date.now()}_${idx}`;

      const rawActs = Array.isArray(unit.activities) ? unit.activities : [];
      let activities: ProcessActivity[] = rawActs.map((a: any, actIdx: number) => ({
        id: a.id ? String(a.id) : `act_${idx}_${actIdx + 1}`,
        stepNumber: typeof a.stepNumber === 'number' ? a.stepNumber : actIdx + 1,
        name: a.name || `Paso ${actIdx + 1}`,
        description: a.description || a.name || 'Actividad operativa.',
        role: a.role || 'Pendiente de definir',
        system: a.system || undefined,
        type: (['start', 'action', 'decision', 'end'].includes(a.type) ? a.type : 'action') as any,
        conditionLabel: a.conditionLabel || undefined,
        exceptions: a.exceptions || undefined,
      }));

      if (activities.length === 0) {
        activities = [
          {
            id: `act_${idx}_1`,
            stepNumber: 1,
            name: 'Inicio de la actividad',
            description: 'Disparador inicial del proceso.',
            role: 'Operador',
            type: 'start',
          },
          {
            id: `act_${idx}_2`,
            stepNumber: 2,
            name: unit.name || 'Ejecución de tareas',
            description: unit.objective || 'Ejecución operativa.',
            role: 'Operador',
            type: 'action',
          },
          {
            id: `act_${idx}_3`,
            stepNumber: 3,
            name: 'Fin del proceso',
            description: 'Resultado final conforme.',
            role: 'Operador',
            type: 'end',
          },
        ];
      }

      const actIdSet = new Set(activities.map((a) => a.id));
      const rawConns = Array.isArray(unit.connections) ? unit.connections : [];
      let connections = rawConns.filter(
        (c: any) => c && c.from && c.to && actIdSet.has(c.from) && actIdSet.has(c.to)
      );

      if (connections.length === 0 && activities.length > 1) {
        connections = [];
        for (let i = 0; i < activities.length - 1; i++) {
          connections.push({ from: activities[i].id, to: activities[i + 1].id });
        }
      }

      return {
        id: procId,
        surveyId: `survey_${Date.now()}`,
        clientId: activeClient?.id || 'client_default',
        ownerId: activeClient?.ownerId || 'default_user',
        code: unit.code || defaultCode,
        name: unit.name || `Proceso ${idx + 1}`,
        docType,
        classificationReason: unit.classificationReason,
        status: 'pendiente_informacion' as const,
        version: '1.0',
        objective: unit.objective || 'Definir la secuencia de trabajo AS-IS.',
        scope: unit.scope || 'Aplica a las actividades identificadas en el relevamiento.',
        trigger: unit.trigger || 'Inicio de la operación.',
        result: unit.result || 'Finalización conforme.',
        inputs: Array.isArray(unit.inputs) ? unit.inputs : [],
        outputs: Array.isArray(unit.outputs) ? unit.outputs : [],
        roles: Array.isArray(unit.roles) ? unit.roles : [],
        systems: Array.isArray(unit.systems) ? unit.systems : [],
        activities,
        connections,
        validationQuestions: (Array.isArray(unit.validationQuestions) ? unit.validationQuestions : []).map(
          (q: any, qIdx: number) => ({
            id: q.id ? String(q.id) : `q_${idx}_${qIdx + 1}`,
            question: q.question || 'Información no especificada',
            reason: q.reason || 'Dato pendiente',
            relatedActivityId: q.relatedActivityId,
            originalQuote: q.originalQuote,
            status: 'pending' as const,
          })
        ),
        privateImprovements: (Array.isArray(unit.privateImprovements) ? unit.privateImprovements : []).map(
          (f: any, fIdx: number) => ({
            id: f.id ? String(f.id) : `imp_${idx}_${fIdx + 1}`,
            type: (f.type === 'opportunity' ? 'opportunity' : 'pain_point') as any,
            relatedActivityId: f.relatedActivityId,
            title: f.title || 'Hallazgo operativo',
            description: f.description || '',
            evidence: f.evidence || '',
            impact: f.impact || 'Riesgo operativo',
            proposal: f.proposal || 'Optimización del proceso',
            priority: (['alta', 'media', 'baja'].includes(f.priority) ? f.priority : 'media') as any,
            status: 'detectado' as const,
          })
        ),
        relatedUnits: Array.isArray(unit.relatedUnits) ? unit.relatedUnits : [],
        history: [
          {
            version: '1.0',
            date: new Date().toLocaleDateString('es-ES'),
            author: 'Analista de Procesos (Process AI)',
            description: 'Identificación y estructuración inicial a partir de relevamiento.',
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    });

    onAnalysisComplete(processes, analysisResult.interviewSummary, targetIndex);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Client Context Notice */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-left">
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Empresa Cliente Activa
          </span>
          <span className="text-sm font-bold text-slate-900">
            {activeClient?.name || 'Logística Global S.L.'}
          </span>
          <span className="text-xs text-slate-500 ml-2">
            ({activeClient?.sector || 'Logística'} — {activeClient?.isoStandard || 'ISO 9001:2026'})
          </span>
        </div>

        <button
          onClick={loadSyntheticExample}
          className="text-xs px-3.5 py-1.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 font-semibold transition-colors flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          Cargar Ejemplo Logística (Sección 16)
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload & Transcription Section */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 text-left space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Transcripción o Audio de la Reunión</h3>
            <p className="text-xs text-slate-500">
              Sube un archivo de audio (MP3, WAV, M4A) o texto (TXT, SRT), o pega la conversación directamente
            </p>
          </div>

          <label className="cursor-pointer px-3.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Subir Archivo</span>
            <input
              type="file"
              accept=".txt,.md,.srt,.vtt,.mp3,.wav,.m4a,.webm,.ogg"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {audioFileName && (
          <div className="text-xs bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-slate-700 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>Archivo cargado: <strong>{audioFileName}</strong></span>
          </div>
        )}

        {isTranscribing && (
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
            <span>Transcribiendo audio fielmente con Gemini (gemini-3.5-transcribe)... Por favor espera.</span>
          </div>
        )}

        <textarea
          rows={11}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Pega aquí la transcripción de la entrevista o reunión donde se explica cómo se realiza el trabajo..."
          className="w-full border border-slate-300 rounded-lg p-3 text-xs text-slate-800 font-mono leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-blue-500 bg-white"
        />

        <div className="flex justify-between items-center pt-2">
          <span className="text-[11px] text-slate-400">
            {transcript ? `${transcript.length} caracteres` : 'Sin contenido'}
          </span>

          <button
            onClick={handleAnalyze}
            disabled={!transcript.trim() || isAnalyzing || isTranscribing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition-colors"
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analizando con Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Analizar con IA (Gemini)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Result & Documental Units Confirmation */}
      {analysisResult && (
        <div className="bg-white p-6 rounded-lg border border-blue-200 text-left space-y-5 shadow-xs">
          <div className="border-b border-slate-200 pb-3">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-1">
              Resultado de la Interpretación IA
            </span>
            <h3 className="text-base font-bold text-slate-900">
              Unidades Documentales Identificadas en el Relevamiento
            </h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {analysisResult.interviewSummary}
            </p>
          </div>

          <div className="space-y-4">
            {analysisResult.identifiedUnits.map((unit, idx) => (
              <div
                key={unit.tempId || idx}
                className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-all space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{unit.name}</h4>
                    <span className="text-xs font-mono text-slate-500 font-semibold">
                      [{unit.code || `PR-0${idx + 1}`}]
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-medium">Clasificación:</span>
                    <select
                      value={getDocTypeKey(unit.docType)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleClassificationChange(idx, e.target.value as DocType);
                      }}
                      className="border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 bg-white cursor-pointer hover:border-slate-400 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="proceso">Proceso</option>
                      <option value="procedimiento">Procedimiento</option>
                      <option value="instructivo">Instructivo</option>
                    </select>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConfirmUnits(idx);
                      }}
                      className="ml-2 text-xs px-3 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                      title="Generar y abrir este proceso en el editor"
                    >
                      <span>Abrir en Editor</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong className="text-slate-700">Objetivo AS-IS:</strong> {unit.objective}
                </p>

                {unit.classificationReason && (
                  <div className="text-[11px] text-slate-500 italic bg-white p-2 rounded border border-slate-200">
                    <strong>Criterio de separación / clasificación:</strong> {unit.classificationReason}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                  <span>
                    <strong>Actividades:</strong> {unit.activities?.length || 0} pasos
                  </span>
                  <span>
                    <strong>Preguntas de validación:</strong> {unit.validationQuestions?.length || 0}
                  </span>
                  <span>
                    <strong>Hallazgos privados:</strong> {unit.privateImprovements?.length || 0}
                  </span>
                  {unit.relatedUnits?.length > 0 && (
                    <span className="text-blue-700 font-medium">
                      <strong>Relacionado con:</strong> {unit.relatedUnits.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              Se crearán <strong>{analysisResult.identifiedUnits.length} procesos</strong> listos para revisar y validar.
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleConfirmUnits(0);
              }}
              className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Aceptar Unidades y Generar Documentación</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
