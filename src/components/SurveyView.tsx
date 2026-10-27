import React, { useState } from 'react';
import { Client, ProcessModel, DocType, ProcessActivity, ValidationQuestion, ProcessConnection } from '../types/process';
import { auth } from '../lib/firebase';
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
  ChevronDown,
  ChevronUp,
  Train,
  CheckCircle2,
  Workflow,
  ShieldAlert,
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
  const [expandedUnitIdx, setExpandedUnitIdx] = useState<number | null>(null);

  // Analysis result intermediate stage before generating documents
  const [analysisResult, setAnalysisResult] = useState<{
    interviewSummary: string;
    identifiedUnits: any[];
    meta?: {
      isFallback?: boolean;
      quotaExceeded?: boolean;
      reason?: string;
    };
  } | null>(null);

  // Train / Railway Operational Example
  const loadTrainExample = () => {
    setSurveyTitle('Inspección Técnica Previa y Puesta en Marcha de Tren');
    setAudioFileName(null);
    setTranscript(`Entrevistador:
"Explícame en detalle cómo se realiza la inspección técnica previa y la puesta en marcha del tren antes de iniciar la circulación."

Maquinista:
"Al llegar a la base de operaciones de cocheras, lo primero que hago es consultar la orden de marcha y la hoja de ruta en el puesto de mando.
Si la orden de servicio está aprobada, accedo a la cabina del tren y activo las baterías principales y el disyuntor general para energizar los sistemas auxiliares.
A continuación, bajo a pie de vía y realizo la inspección visual exterior obligatoria: reviso el estado de rodadura en los bogies, compruebo el grosor de zapatas y discos de freno, y verifico que no haya fugas en las tuberías de aire comprimido ni fisuras en el enganche Scharfenberg. También verifico visualmente el estado de las frotadoras del pantógrafo.
Si detecto alguna anomalía crítica en frenos, suspensión o pantógrafo, detengo el protocolo, emito parte de avería y aviso de inmediato al jefe de taller para retirar la unidad de vía.
Si la inspección visual exterior es totalmente conforme, regreso a cabina y ejecuto la prueba de tracción y el test neumático de freno de emergencia. Compruebo que la presión en los manómetros de la tubería general alcance los 5 bares de régimen.
Luego realizo el autotest del sistema de seguridad y señalización en cabina ASFA Digital.
Si el test de seguridad resulta satisfactorio, comunico por radiotelefonía tren-tierra al regulador de circulación que el tren se encuentra dispuesto y registro la salida en la tablet de a bordo."`);
    setErrorMsg(null);
    setAnalysisResult(null);
  };

  // Synthetic Test Example from Section 16 of the User Prompt
  // Real Logistics Operational Example: Gestión de Direcciones y Concertación de Entregas
  const loadSyntheticExample = () => {
    setSurveyTitle('Relevamiento de Operativa de Distribución y Tráfico');
    setAudioFileName(null);
    setTranscript(`Entrevistador:
"¿Cómo se realiza la gestión y revisión de direcciones de cliente?"

Responsable de Tráfico:
"En la aplicación de gestión de clientes, consultamos la ficha del cliente y verificamos si la dirección de entrega está normalizada con calle, número y código postal válidos. Si detectamos alguna inconsistencia o falta de accesibilidad para camiones pesados, actualizamos la ficha maestra y dejamos nota en el sistema para que el enrutamiento automático no falle."

Entrevistador:
"¿Y cómo funciona la concertación de entregas?"

Responsable de Tráfico:
"En esta pestaña concertaciones por email, ya te aparece el listado de expediciones pendientes de concertar.
Tenemos 3 tipos de concertación: telefónica, por email o notificación automática.
Tú le tienes que decir cuándo ya estás sin disponibilidad de entregarle, enviando la propuesta de fecha y franja horaria.
Ante esa propuesta, el cliente puede hacer 2 cosas: aceptar o posponer.
Si el cliente acepta la concertación, el sistema ya no te pedirá nada más y la cita queda confirmada. Si pospone, registramos la posposición para reprogramar la fecha."`);
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
        const token = await auth.currentUser?.getIdToken();
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch('/api/gemini/transcribe-audio', {
          method: 'POST',
          headers,
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
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        headers['x-dev-bypass'] = 'true';
      }

      const res = await fetch('/api/gemini/analyze-interview', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transcriptText: transcript,
          clientInfo: activeClient,
        }),
      });

      const responseText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        throw new Error(`Error en el servidor (${res.status}): No se recibió una respuesta válida.`);
      }

      if (!res.ok) {
        throw new Error(data?.error || `Error ${res.status} al analizar la entrevista`);
      }

      setAnalysisResult(data);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error en el motor de análisis de procesos');
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

    // Convert identifiedUnits into full ProcessModel objects under strict AS-IS rules
    const processes: ProcessModel[] = analysisResult.identifiedUnits.map((unit, idx) => {
      const docType = getDocTypeKey(unit.docType);
      const codePrefix =
        docType === 'instructivo' ? 'IT' : docType === 'proceso' ? 'PR' : 'PO';
      const defaultCode = `${codePrefix}-${activeClient?.code || 'LOG'}-${String(idx + 1).padStart(2, '0')}`;
      const procId = `proc_${Date.now()}_${idx}`;

      const rawActs = Array.isArray(unit.activities) ? unit.activities : [];
      const activities: ProcessActivity[] = rawActs.map((a: any, actIdx: number) => {
        const stepNum = typeof a.stepNumber === 'number' ? a.stepNumber : actIdx + 1;
        const normalizedId = `step_${stepNum}`;
        return {
          id: normalizedId,
          stepNumber: stepNum,
          name: a.name || `Paso ${stepNum}`,
          description: a.description || a.name || 'Actividad operativa.',
          role: a.role || 'Pendiente de definir',
          system: a.system || undefined,
          type: (['start', 'action', 'decision', 'end'].includes(a.type)
            ? a.type
            : actIdx === 0
            ? 'start'
            : actIdx === rawActs.length - 1
            ? 'end'
            : 'action') as any,
          conditionLabel: a.conditionLabel || undefined,
          exceptions: a.exceptions || undefined,
          sourceQuote: a.sourceQuote || undefined,
          sourceTimestamp: a.sourceTimestamp || undefined,
          status: a.sourceQuote ? 'confirmed' : 'inferred',
          verifiedByHuman: false,
        };
      });

      // Validation questions mapped with proper criticality (Section 4.1)
      const validationQuestions: ValidationQuestion[] = (
        Array.isArray(unit.validationQuestions) ? unit.validationQuestions : []
      ).map((q: any, qIdx: number) => ({
        id: q.id ? String(q.id) : `q_${idx}_${qIdx + 1}`,
        question: q.question || 'Información operativa no especificada',
        reason: q.reason || 'Dato pendiente de confirmación',
        criticality: (['critica', 'importante', 'complementaria'].includes(q.criticality)
          ? q.criticality
          : 'critica') as any,
        relatedActivityId: q.relatedActivityId,
        originalQuote: q.originalQuote,
        status: 'pending' as const,
      }));

      // If activities are empty, register validation question
      if (activities.length === 0) {
        validationQuestions.unshift({
          id: `q_${idx}_no_acts`,
          question: `No se identificaron pasos operativos explícitos para la unidad "${unit.name || 'Proceso'}". ¿Cuáles son sus actividades?`,
          reason: 'Principio AS-IS estricto: La transcripción no detalla actividades específicas para esta unidad.',
          criticality: 'critica',
          status: 'pending',
        });
      }

      // Build alias lookup so any identifier used by Gemini ('step_1', '1', 'step 1', a.id, etc.) maps to normalizedId
      const idLookup = new Map<string, string>();
      rawActs.forEach((orig: any, i: number) => {
        const targetId = activities[i]?.id;
        if (!targetId) return;
        if (orig.id) idLookup.set(String(orig.id).toLowerCase().trim(), targetId);
        idLookup.set(String(i + 1), targetId);
        idLookup.set(`step_${i + 1}`, targetId);
        idLookup.set(`step ${i + 1}`, targetId);
        idLookup.set(`act_${i + 1}`, targetId);
        idLookup.set(`unit_${idx + 1}_step_${i + 1}`, targetId);
        if (orig.name) idLookup.set(String(orig.name).toLowerCase().trim(), targetId);
      });

      const actIdSet = new Set(activities.map((a) => a.id));
      const rawConns = Array.isArray(unit.connections) ? unit.connections : [];
      const connections: ProcessConnection[] = [];

      rawConns.forEach((c: any) => {
        if (!c || !c.from || !c.to) return;
        const resolvedFrom = idLookup.get(String(c.from).toLowerCase().trim()) || (actIdSet.has(c.from) ? c.from : null);
        const resolvedTo = idLookup.get(String(c.to).toLowerCase().trim()) || (actIdSet.has(c.to) ? c.to : null);

        if (resolvedFrom && resolvedTo && resolvedFrom !== resolvedTo) {
          if (!connections.some((existing) => existing.from === resolvedFrom && existing.to === resolvedTo)) {
            const targetAct = activities.find((a) => a.id === resolvedTo);
            // Incoming edges to a decision must NEVER have a condition label
            const isEnteringDecision = targetAct && targetAct.type === 'decision';
            const cleanLabel = isEnteringDecision ? undefined : (c.label || undefined);

            connections.push({
              from: resolvedFrom,
              to: resolvedTo,
              label: cleanLabel,
              status: 'confirmed',
            });
          }
        }
      });

      // If connections are empty or incomplete but activities exist, build logical flow
      if (connections.length === 0 && activities.length > 1) {
        for (let i = 0; i < activities.length - 1; i++) {
          const fromAct = activities[i];
          const toAct = activities[i + 1];
          // Only outgoing from decision gets condition label
          const label = fromAct.type === 'decision' ? (fromAct.conditionLabel || 'Conforme') : undefined;

          connections.push({
            from: fromAct.id,
            to: toAct.id,
            label,
            status: 'inferred',
          });
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
        procedureNarrative: unit.procedureNarrative,
        validationQuestions,
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
        transcriptText: transcript,
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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadTrainExample}
            className="text-xs px-3 py-1.5 rounded-md bg-blue-50 text-blue-900 border border-blue-300 hover:bg-blue-100 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Train className="w-3.5 h-3.5 text-blue-700" />
            <span>Ejemplo Tren Ferroviario</span>
          </button>
          <button
            onClick={loadSyntheticExample}
            className="text-xs px-3 py-1.5 rounded-md bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Ejemplo Logística</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          {transcript.trim() && (
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isAnalyzing ? 'Reintentando...' : 'Reintentar'}
            </button>
          )}
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
          <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
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
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="text-xs px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Volver a analizar la transcripción con Gemini"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>Regenerar análisis</span>
            </button>
          </div>

          <div className="space-y-4">
            {analysisResult.identifiedUnits.map((unit, idx) => {
              const isExpanded = expandedUnitIdx === idx;
              const activities = Array.isArray(unit.activities) ? unit.activities : [];
              const questions = Array.isArray(unit.validationQuestions) ? unit.validationQuestions : [];

              return (
                <div
                  key={unit.tempId || idx}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={unit.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAnalysisResult((prev) => {
                            if (!prev) return null;
                            const copy = [...prev.identifiedUnits];
                            copy[idx] = { ...copy[idx], name: val };
                            return { ...prev, identifiedUnits: copy };
                          });
                        }}
                        className="text-sm font-bold text-slate-900 bg-white border border-slate-300 rounded px-2.5 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-hidden flex-1"
                        placeholder="Nombre del proceso o procedimiento"
                      />
                      <span className="text-xs font-mono text-slate-500 font-semibold shrink-0">
                        [{unit.code || `PR-0${idx + 1}`}]
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
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

                  {/* Summary & Accordion Toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 pt-1 border-t border-slate-200">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>
                        <strong>Actividades:</strong> {activities.length} pasos
                      </span>
                      <span>
                        <strong>Preguntas de validación:</strong> {questions.length}
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

                    <button
                      type="button"
                      onClick={() => setExpandedUnitIdx(isExpanded ? null : idx)}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-blue-50/70 hover:bg-blue-100/70 px-2.5 py-1 rounded transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" />
                          <span>Ocultar detalles</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" />
                          <span>Ver {activities.length} pasos y {questions.length} preguntas</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Expandable Step-by-Step Preview */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-4 animate-in fade-in duration-150">
                      {/* Activities List */}
                      <div>
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                          <Workflow className="w-3.5 h-3.5 text-blue-600" />
                          <span>Secuencia de Pasos Operativos Extraídos:</span>
                        </h5>
                        <div className="space-y-2">
                          {activities.map((act: any, actI: number) => (
                            <div
                              key={act.id || actI}
                              className="p-2.5 rounded bg-white border border-slate-200 text-xs flex flex-col gap-1 shadow-2xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {act.stepNumber || actI + 1}
                                  </span>
                                  <span className="font-bold text-slate-900">{act.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                                      act.type === 'start'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : act.type === 'end'
                                        ? 'bg-slate-200 text-slate-800'
                                        : act.type === 'decision'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}
                                  >
                                    {act.type}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                                    {act.role || 'Rol pendiente'}
                                  </span>
                                </div>
                              </div>
                              <p className="text-slate-600 pl-6">{act.description}</p>
                              {act.sourceQuote && (
                                <p className="text-[11px] text-slate-500 italic pl-6 border-l-2 border-blue-300 ml-6 mt-1">
                                  "{act.sourceQuote}"
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Validation Questions List */}
                      {questions.length > 0 && (
                        <div>
                          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                            <span>Preguntas de Validación de Brechas:</span>
                          </h5>
                          <div className="space-y-1.5">
                            {questions.map((q: any, qI: number) => (
                              <div
                                key={q.id || qI}
                                className="p-2 rounded bg-amber-50/60 border border-amber-200 text-xs flex items-start gap-2"
                              >
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold shrink-0 mt-0.5 ${
                                    q.criticality === 'critica'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {q.criticality}
                                </span>
                                <div>
                                  <p className="font-semibold text-slate-800">{q.question}</p>
                                  <p className="text-[11px] text-slate-500">{q.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
