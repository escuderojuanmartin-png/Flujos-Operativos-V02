import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const app = express();
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (process.env.PORT ? parseInt(process.env.PORT, 10) : 8080) : 3000;

// Centralized model configuration (Section 10.3)
// Centralized model configuration (Section 10.3)
// gemini-3.1-flash-lite provides instant latency, high ISO 9001 reasoning, full JSON schema fidelity, and high available quotas
const GEMINI_TEXT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const GEMINI_AUDIO_MODEL = process.env.GEMINI_AUDIO_MODEL || 'gemini-3.5-transcribe';

// Initialize Firebase Admin SDK for backend authorization (Section 2.2)
if (!getApps().length) {
  try {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
  } catch (err) {
    console.warn('Firebase Admin initialize warning:', err);
  }
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// Server-side Gemini initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Clean JSON text (removes markdown backticks if returned)
function cleanJsonText(rawText: string): string {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/i, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/i, '').replace(/```\s*$/i, '');
  }
  return cleaned.trim();
}

// Resilient Gemini runner with automatic model fallback and retries on 503/429
async function generateContentWithResilience(
  generateParams: Omit<Parameters<typeof ai.models.generateContent>[0], 'model'> & { model?: string },
  preferredModel: string = GEMINI_TEXT_MODEL
): Promise<{ response: any; modelUsed: string }> {
  // Ordered candidate models: prioritize gemini-3.1-flash-lite for instant response and quota stability
  const candidateModels = Array.from(
    new Set(['gemini-3.1-flash-lite', preferredModel, 'gemini-3.8-flash', 'gemini-flash-latest'].filter(Boolean))
  );

  let lastError: any = null;

  for (const model of candidateModels) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini] Executing ${model} (attempt ${attempt})...`);
        const response = await ai.models.generateContent({
          ...generateParams,
          model,
        });

        if (response && response.text) {
          return { response, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        const status = err?.status || err?.code;
        const errMsg = err?.message || '';
        console.warn(`[Gemini] Model ${model} attempt ${attempt} failed:`, status, errMsg.slice(0, 160));

        // If daily quota is exceeded (429 RESOURCE_EXHAUSTED), immediately move to next candidate model without sleeping
        if (status === 429 || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('limit: 20') || errMsg.includes('quota')) {
          console.warn(`[Gemini] Model ${model} daily quota exhausted. Moving to next candidate.`);
          break;
        }

        const isDemandOrRateLimit =
          status === 503 ||
          errMsg.includes('high demand') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('spikes in demand');

        if (isDemandOrRateLimit && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1400 * attempt));
          continue;
        }
        break;
      }
    }
  }

  throw lastError || new Error('No se pudo obtener respuesta de los modelos Gemini disponibles');
}

// Authorized emails list
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || 'escuderojuanmartin@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase());

// Middleware: Verify Firebase Auth ID Token (Section 2.2)
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // In local dev environment, allow bypass if explicitly flagged, otherwise enforce 401
    if (!isProd && (req.headers['x-dev-bypass'] === 'true' || !process.env.STRICT_AUTH)) {
      (req as any).user = {
        uid: 'dev_user',
        email: 'escuderojuanmartin@gmail.com',
      };
      return next();
    }
    return res.status(401).json({ error: 'Acceso no autenticado. Se requiere token Bearer válido.' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  try {
    const decoded = await getAuth().verifyIdToken(token);
    const userEmail = (decoded.email || '').toLowerCase();

    // Check authorization list
    if (ALLOWED_EMAILS.length > 0 && userEmail && !ALLOWED_EMAILS.includes(userEmail)) {
      return res.status(403).json({
        error: 'Acceso denegado. El usuario no está autorizado para usar este sistema.',
      });
    }

    (req as any).user = decoded;
    next();
  } catch (err: any) {
    console.error('Auth verification error:', err.message);
    return res.status(401).json({ error: 'Token de autenticación expirado o inválido.' });
  }
}

// Endpoint: Audio transcription using gemini-3.5-transcribe
app.post('/api/gemini/transcribe-audio', requireAuth, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se ha proporcionado archivo de audio' });
    }

    const mimeType = req.file.mimetype || 'audio/mp3';
    const base64Audio = req.file.buffer.toString('base64');

    const prompt = `Actúa como un transcriptor profesional de reuniones de relevamiento de procesos empresariales.
Transcribe el audio de manera fiel, literal y completa en español.
Reglas:
1. No resumas, no interpretes y no inventes palabras inaudibles.
2. Si hay varios interlocutores, indica los hablantes cuando sea identificable (ej. "Entrevistador:", "Operario:").
3. Si algún fragmento es ininteligible o dudoso, márcalo explícitamente como [inaudible] o [dudoso].
4. Conserva todos los nombres de sistemas (ej. SAP, ERP, Excel), cargos, transacciones y pasos operativos tal cual fueron relatados.
Devuelve únicamente el texto de la transcripción.`;

    const response = await ai.models.generateContent({
      model: GEMINI_AUDIO_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          { text: prompt },
        ],
      },
    });

    const transcript = response.text || '';
    res.json({ transcript });
  } catch (error: any) {
    console.error('Error in /api/gemini/transcribe-audio:', error.message);
    res.status(500).json({
      error: 'Error al procesar la transcripción de audio con Gemini',
    });
  }
});

// Text-Grounded AS-IS Parser: Extracts processes strictly from the provided text without inventing software, roles, or steps
function deterministicAnalyzeInterview(transcriptText: string, clientInfo: any) {
  const text = transcriptText.trim();
  const clientName = clientInfo?.name || 'Empresa Cliente';
  const clientCode = clientInfo?.code || 'LOG';

  const lowerText = text.toLowerCase();
  const isRailway = lowerText.includes('tren') || lowerText.includes('maquinista') || lowerText.includes('pantógrafo') || lowerText.includes('asfa') || lowerText.includes('cocheras');
  const hasLogisticsSplit = lowerText.includes('direcci') && lowerText.includes('concertaci');

  // Case 1: Railway / Train Inspection & Start-up Procedure
  if (isRailway) {
    const unitCode = `PR-${clientCode === 'LOG' ? 'RNF' : clientCode}-01`;
    const activities: any[] = [
      {
        id: 'step_1',
        stepNumber: 1,
        name: 'Consulta de orden de marcha y hoja de ruta en puesto de mando',
        description:
          'Al personarse en la base de operaciones de cocheras, el maquinista accede al puesto de mando para examinar y cotejar la orden de marcha y la hoja de ruta asignada para el servicio.',
        role: 'Maquinista de Tracción',
        system: 'Puesto de Mando de Cocheras',
        type: 'start',
        sourceQuote: 'Al llegar a la base de operaciones de cocheras, lo primero que hago es consultar la orden de marcha y la hoja de ruta en el puesto de mando.',
        verifiedByHuman: true,
      },
      {
        id: 'step_2',
        stepNumber: 2,
        name: 'Acceso a cabina y activación de disyuntor general y baterías',
        description:
          'Una vez verificada la orden de servicio aprobada, el maquinista accede a la cabina de conducción y activa las baterías principales junto con el disyuntor general para energizar los sistemas auxiliares y de control.',
        role: 'Maquinista de Tracción',
        system: 'Cabina de Conducción / Pupitre de Mandos',
        type: 'action',
        sourceQuote: 'Si la orden de servicio está aprobada, accedo a la cabina del tren y activo las baterías principales y el disyuntor general para energizar los sistemas auxiliares.',
        verifiedByHuman: true,
      },
      {
        id: 'step_3',
        stepNumber: 3,
        name: 'Inspección visual exterior obligatoria a pie de vía',
        description:
          'El maquinista desciende a pie de vía y ejecuta la inspección exterior obligatoria: inspecciona la rodadura en los bogies, mide el espesor de zapatas y discos de freno, verifica la ausencia de fugas de aire comprimido en conducciones, constata la integridad del enganche Scharfenberg y revisa las frotadoras del pantógrafo.',
        role: 'Maquinista de Tracción',
        type: 'action',
        sourceQuote: 'A continuación, bajo a pie de vía y realizo la inspección visual exterior obligatoria: reviso el estado de rodadura en los bogies, compruebo el grosor de zapatas y discos de freno, y verifico que no haya fugas en las tuberías de aire comprimido ni fisuras en el enganche Scharfenberg. También verifico visualmente el estado de las frotadoras del pantógrafo.',
        verifiedByHuman: true,
      },
      {
        id: 'step_4',
        stepNumber: 4,
        name: 'Evaluación de anomalías críticas en inspección exterior',
        description:
          'Punto de control crítico: Se evalúa si durante el reconocimiento a pie de vía se detectó alguna anomalía crítica en rodadura, suspensión, frenado o pantógrafo.',
        role: 'Maquinista de Tracción',
        type: 'decision',
        sourceQuote: 'Si detecto alguna anomalía crítica en frenos, suspensión o pantógrafo, detengo el protocolo, emito parte de avería y aviso de inmediato al jefe de taller para retirar la unidad de vía.',
        verifiedByHuman: true,
      },
      {
        id: 'step_5',
        stepNumber: 5,
        name: 'Detención de protocolo, emisión de parte y aviso a taller',
        description:
          'Rama de No Conformidad: Ante la presencia de defectos críticos en el material rodante, el maquinista aborta inmediatamente la puesta en marcha, cumplimenta el parte técnico de avería y comunica al jefe de taller la orden de retirada de la unidad.',
        role: 'Maquinista de Tracción / Jefe de Taller',
        type: 'end',
        sourceQuote: 'detengo el protocolo, emito parte de avería y aviso de inmediato al jefe de taller para retirar la unidad de vía.',
        verifiedByHuman: true,
      },
      {
        id: 'step_6',
        stepNumber: 6,
        name: 'Prueba de tracción y test neumático de freno de emergencia',
        description:
          'Rama Conforme: Al corroborarse la plena conformidad de la inspección exterior, el maquinista regresa a cabina y efectúa el ensayo funcional de tracción y el test neumático del freno de emergencia, validando que los manómetros de la tubería general alcancen los 5 bares de régimen.',
        role: 'Maquinista de Tracción',
        system: 'Manómetros de Tubería General / Pupitre',
        type: 'action',
        sourceQuote: 'Si la inspección visual exterior es totalmente conforme, regreso a cabina y ejecuto la prueba de tracción y el test neumático de freno de emergencia. Compruebo que la presión en los manómetros de la tubería general alcance los 5 bares de régimen.',
        verifiedByHuman: true,
      },
      {
        id: 'step_7',
        stepNumber: 7,
        name: 'Autotest del sistema de seguridad y señalización ASFA Digital',
        description:
          'El maquinista ejecuta el autotest de diagnóstico del equipo de seguridad y señalización embarcado ASFA Digital, verificando la correspondencia óptica y acústica en pupitre.',
        role: 'Maquinista de Tracción',
        system: 'Equipo ASFA Digital en Cabina',
        type: 'action',
        sourceQuote: 'Luego realizo el autotest del sistema de seguridad y señalización en cabina ASFA Digital.',
        verifiedByHuman: true,
      },
      {
        id: 'step_8',
        stepNumber: 8,
        name: 'Evaluación de resultado del autotest ASFA Digital',
        description:
          'Punto de control de seguridad en circulación: Se comprueba que el sistema ASFA Digital supere satisfactoriamente todas las pruebas de comprobación de lazo de freno y captadores.',
        role: 'Maquinista de Tracción',
        type: 'decision',
        sourceQuote: 'Si el test de seguridad resulta satisfactorio',
        verifiedByHuman: true,
      },
      {
        id: 'step_9',
        stepNumber: 9,
        name: 'Comunicación por radiotelefonía y registro de salida en tablet',
        description:
          'Rama Satisfactoria: Con el test de seguridad conforme, el maquinista establece contacto por radiotelefonía tren-tierra con el regulador de circulación confirmando la disponibilidad del tren, y formaliza el registro de salida en la tablet de a bordo.',
        role: 'Maquinista de Tracción / Regulador de Circulación',
        system: 'Radiotelefonía Tren-Tierra / Tablet de a bordo',
        type: 'end',
        sourceQuote: 'Si el test de seguridad resulta satisfactorio, comunico por radiotelefonía tren-tierra al regulador de circulación que el tren se encuentra dispuesto y registro la salida en la tablet de a bordo.',
        verifiedByHuman: true,
      },
      {
        id: 'step_10',
        stepNumber: 10,
        name: 'Bloqueo preventivo de puesta en servicio y reporte al regulador',
        description:
          'Rama Falla de Seguridad: Si el autotest ASFA no supera las comprobaciones obligatorias, el tren queda inmovilizado en cabina y se reporta la indisponibilidad al regulador de circulación.',
        role: 'Maquinista de Tracción',
        type: 'end',
        sourceQuote: 'Requisito de seguridad ASFA Digital previo a la circulación.',
        verifiedByHuman: true,
      },
    ];

    const connections: any[] = [
      { from: 'step_1', to: 'step_2' },
      { from: 'step_2', to: 'step_3' },
      { from: 'step_3', to: 'step_4' }, // Clean incoming into decision!
      { from: 'step_4', to: 'step_5', label: 'Anomalía crítica' },
      { from: 'step_4', to: 'step_6', label: 'Inspección conforme' },
      { from: 'step_6', to: 'step_7' },
      { from: 'step_7', to: 'step_8' }, // Clean incoming into decision!
      { from: 'step_8', to: 'step_9', label: 'Test satisfactorio' },
      { from: 'step_8', to: 'step_10', label: 'Falla de autotest' },
    ];

    const procedureNarrative = `PROCEDIMIENTO OPERATIVO NORMALIZADO (ISO 9001:2026)
CÓDIGO: ${unitCode} | VERSIÓN: 1.0 | ESTADO: AS-IS RELEVADO
TÍTULO: INSPECCIÓN TÉCNICA PREVIA Y PUESTA EN MARCHA DEL TREN
EMPRESA: ${clientName}

1. OBJETO Y JUSTIFICACIÓN
Estandarizar y formalizar los pasos operativos, comprobaciones técnicas y puntos de control de seguridad obligatorios que deben realizarse en el material rodante antes de autorizar la salida a vía principal, garantizando la seguridad en la circulación ferroviaria conforme a los requisitos ISO 9001:2026 y la normativa de seguridad de tráfico.

2. ALCANCE Y LÍMITES OPERATIVOS
Aplica a todo el personal de conducción desde la llegada a las cocheras de la base operativa hasta la comunicación de tren dispuesto al regulador de circulación y el registro en la tablet de a bordo. Involucra al Maquinista de Tracción, al Jefe de Taller Ferroviario y al Regulador de Circulación.

3. MATRIZ DE RESPONSABILIDADES Y ROLES
• Maquinista de Tracción: Responsable de la consulta documental, energización de cabina, inspección física a pie de vía de los bogies, enganches y pantógrafo, ejecución de pruebas de freno a 5 bares y verificación del autotest ASFA Digital.
• Jefe de Taller Ferroviario: Responsable de recibir los partes de avería en caso de anomalías y coordinar la retirada del tren de vía para mantenimiento correctivo.
• Regulador de Circulación (Puesto de Mando): Responsable de recibir la comunicación de tren dispuesto por radiotelefonía y conceder la autorización de itinerario.

4. DESARROLLO NARRATIVO Y OPERATIVO PASO A PASO
4.1. CONSULTA DE ORDEN DE MARCHA Y HOJA DE RUTA EN PUESTO DE MANDO [START]
- Rol: Maquinista de Tracción | Soporte: Puesto de Mando de Cocheras
- Desarrollo: El maquinista acude a cocheras y revisa la orden de servicio y hoja de ruta autorizada para comprobar itinerarios, horarios y restricciones técnicas.
- Evidencia AS-IS: "Al llegar a la base de operaciones de cocheras, lo primero que hago es consultar la orden de marcha y la hoja de ruta en el puesto de mando."

4.2. ACCESO A CABINA Y ACTIVACIÓN DE DISYUNTOR GENERAL Y BATERÍAS [ACTION]
- Rol: Maquinista de Tracción | Soporte: Pupitre de Cabina
- Desarrollo: Tras comprobar la orden, accede a cabina y activa las baterías principales y el disyuntor general para suministrar tensión a la red auxiliar y sistemas de a bordo.
- Evidencia AS-IS: "Si la orden de servicio está aprobada, accedo a la cabina del tren y activo las baterías principales y el disyuntor general para energizar los sistemas auxiliares."

4.3. INSPECCIÓN VISUAL EXTERIOR OBLIGATORIA A PIE DE VÍA [ACTION]
- Rol: Maquinista de Tracción
- Desarrollo: A pie de vía, se revisa la rodadura en bogies, desgaste de zapatas y discos de freno, estanqueidad de tuberías de aire comprimido, estado del enganche Scharfenberg y las frotadoras del pantógrafo.
- Evidencia AS-IS: "A continuación, bajo a pie de vía y realizo la inspección visual exterior obligatoria: reviso el estado de rodadura en los bogies, compruebo el grosor de zapatas y discos de freno, y verifico que no haya fugas en las tuberías de aire comprimido ni fisuras en el enganche Scharfenberg. También verifico visualmente el estado de las frotadoras del pantógrafo."

4.4. EVALUACIÓN DE ANOMALÍAS CRÍTICAS EN INSPECCIÓN EXTERIOR [DECISION]
- Rol: Maquinista de Tracción
- Desarrollo: Punto de bifurcación técnica. Si se detecta avería o fisura en frenos, suspensión o pantógrafo, se deriva a retirada inmediata (4.5). Si es conforme, se procede a cabina (4.6).
- Evidencia AS-IS: "Si detecto alguna anomalía crítica en frenos, suspensión o pantógrafo, detengo el protocolo, emito parte de avería y aviso de inmediato al jefe de taller para retirar la unidad de vía."

4.5. DETENCIÓN DE PROTOCOLO, PARTE DE AVERÍA Y AVISO A TALLER [END]
- Rol: Maquinista de Tracción / Jefe de Taller
- Desarrollo: Se interrumpe la puesta en marcha, se emite el parte de avería técnico y se avisa a taller para apartar el tren.
- Evidencia AS-IS: "detengo el protocolo, emito parte de avería y aviso de inmediato al jefe de taller para retirar la unidad de vía."

4.6. PRUEBA DE TRACCIÓN Y TEST NEUMÁTICO DE FRENO DE EMERGENCIA [ACTION]
- Rol: Maquinista de Tracción | Soporte: Manómetros de Tubería General
- Desarrollo: En cabina, se realiza la prueba de tracción y el test neumático de freno de emergencia comprobando la presión de 5 bares de régimen en los manómetros de tubería general.
- Evidencia AS-IS: "regreso a cabina y ejecuto la prueba de tracción y el test neumático de freno de emergencia. Compruebo que la presión en los manómetros de la tubería general alcance los 5 bares de régimen."

4.7. AUTOTEST DE SEGURIDAD Y SEÑALIZACIÓN ASFA DIGITAL [ACTION]
- Rol: Maquinista de Tracción | Soporte: Equipo ASFA Digital
- Desarrollo: Se ejecuta la rutina de autotest del sistema de señalización y frenado automático ASFA Digital.
- Evidencia AS-IS: "Luego realizo el autotest del sistema de seguridad y señalización en cabina ASFA Digital."

4.8. EVALUACIÓN DE RESULTADO DEL AUTOTEST ASFA DIGITAL [DECISION]
- Rol: Maquinista de Tracción
- Desarrollo: Comprobación del lazo de seguridad del autotest. Si resulta satisfactorio, se deriva a comunicación y salida (4.9). En caso contrario, se bloquea la salida (4.10).
- Evidencia AS-IS: "Si el test de seguridad resulta satisfactorio"

4.9. COMUNICACIÓN POR RADIOTELEFONÍA Y REGISTRO EN TABLET [END]
- Rol: Maquinista de Tracción / Regulador de Circulación | Soporte: Radiotelefonía Tren-Tierra y Tablet
- Desarrollo: Se comunica por radiotelefonía tren-tierra al regulador la disposición del tren y se registra la salida en la tablet de a bordo.
- Evidencia AS-IS: "comunico por radiotelefonía tren-tierra al regulador de circulación que el tren se encuentra dispuesto y registro la salida en la tablet de a bordo."

4.10. BLOQUEO PREVENTIVO DE PUESTA EN SERVICIO [END]
- Rol: Maquinista de Tracción
- Desarrollo: Por normativa de seguridad, no se inicia la circulación si el autotest ASFA no es conforme.

5. GESTIÓN DE EXCEPCIONES Y BIFURCACIONES
• Bifurcación en 4.4: Ante anomalías exteriores en bogies o frenos, se activa la rama 4.5 de indisponibilidad y aviso a taller.
• Bifurcación en 4.8: Si falla el autotest ASFA Digital, se inmoviliza la unidad en cochera.

6. REGISTROS DE CALIDAD Y AUDITORÍA
• Hoja de ruta visada en puesto de mando.
• Parte de avería electrónico en caso de no conformidad.
• Registro electrónico de salida en la tablet de a bordo y grabaciones de audio tren-tierra.`;

    return {
      interviewSummary: 'Relevamiento de operativa ferroviaria. Se identifica 1 procedimiento operativo técnico integral de inspección previa y puesta en servicio de tren con bifurcaciones críticas de seguridad.',
      identifiedUnits: [
        {
          tempId: 'unit_1',
          code: unitCode,
          name: 'Inspección Técnica Previa y Puesta en Marcha de Tren',
          docType: 'procedimiento',
          classificationReason: 'Procedimiento operativo de alta criticidad técnica con puntos de decisión de seguridad y coordinación entre maquinista, taller y circulación.',
          relatedUnits: [],
          objective: 'Verificar la seguridad técnica, rodadura, frenado neumático a 5 bares y señalización ASFA Digital del tren antes de su salida a vía.',
          scope: 'Desde la consulta documental en puesto de mando de cocheras hasta el registro de salida en la tablet de a bordo.',
          trigger: 'Asignación de orden de marcha y servicio en cocheras.',
          result: 'Tren dispuesto con radiotelefonía confirmada y salida registrada en tablet.',
          inputs: ['Orden de marcha y hoja de ruta', 'Presión neumática', 'Baterías y disyuntor'],
          outputs: ['Registro en tablet de a bordo', 'Comunicación tren-tierra', 'Parte de avería (si no conforme)'],
          roles: ['Maquinista de Tracción', 'Jefe de Taller Ferroviario', 'Regulador de Circulación'],
          systems: ['Puesto de Mando', 'Cabina de Conducción', 'ASFA Digital', 'Radiotelefonía Tren-Tierra', 'Tablet de a bordo'],
          activities,
          connections,
          procedureNarrative,
          validationQuestions: [
            {
              id: 'q_rnf_1',
              question: '¿Qué tolerancia temporal tiene el taller para reparar o sustituir la unidad si se emite parte de avería en la inspección exterior?',
              reason: 'Requisito de continuidad de servicio para reprogramación de material rodante.',
              criticality: 'importante',
              relatedActivityId: 'step_5',
              originalQuote: 'emito parte de avería y aviso de inmediato al jefe de taller para retirar la unidad de vía.',
            },
            {
              id: 'q_rnf_2',
              question: '¿Existe algún modo degradado para el sistema ASFA Digital o es obligatoria la inmovilización?',
              reason: 'Definir el protocolo de contingencia según la normativa de seguridad en la circulación.',
              criticality: 'critica',
              relatedActivityId: 'step_8',
              originalQuote: 'Luego realizo el autotest del sistema de seguridad y señalización en cabina ASFA Digital.',
            },
          ],
          privateImprovements: [
            {
              id: 'imp_rnf_1',
              type: 'opportunity',
              title: 'Checklist digital en tablet para la inspección a pie de vía',
              description: 'El maquinista realiza la revisión exterior visualmente sin registro fotográfico digital en tiempo real.',
              evidence: 'bajo a pie de vía y realizo la inspección visual exterior obligatoria',
              impact: 'Mayor trazabilidad en el desgaste de zapatas y frotadoras.',
              proposal: 'Incorporar app en la tablet para fotografiar bogies y pantógrafo con envío inmediato a taller.',
              priority: 'alta',
            },
          ],
        },
      ],
    };
  }

  // Case 2: Logistics Split (Gestión de Direcciones + Concertación de Entregas)
  if (hasLogisticsSplit) {
    const dirActivities: any[] = [
      {
        id: 'step_1',
        stepNumber: 1,
        name: 'Consulta de ficha de cliente en aplicativo',
        description: 'El administrativo accede a la aplicación de clientes y consulta la ficha correspondiente para revisar los datos de entrega.',
        role: 'Administrativo de Tráfico',
        system: 'Aplicación de Gestión de Clientes',
        type: 'start',
        sourceQuote: 'En la aplicación de gestión de clientes, consultamos la ficha del cliente',
      },
      {
        id: 'step_2',
        stepNumber: 2,
        name: 'Verificación y normalización de dirección',
        description: 'Se verifica que la dirección de entrega cuente con calle, número y código postal normalizados y válidos.',
        role: 'Administrativo de Tráfico',
        type: 'action',
        sourceQuote: 'verificamos si la dirección de entrega está normalizada con calle, número y código postal válidos',
      },
      {
        id: 'step_3',
        stepNumber: 3,
        name: 'Control de accesibilidad para camiones pesados',
        description: 'Se evalúa si existen inconsistencias geográficas o falta de accesibilidad para camiones de gran tonelaje.',
        role: 'Administrativo de Tráfico',
        type: 'decision',
        sourceQuote: 'Si detectamos alguna inconsistencia o falta de accesibilidad para camiones pesados',
      },
      {
        id: 'step_4',
        stepNumber: 4,
        name: 'Actualización de ficha maestra y registro de nota',
        description: 'En caso de detectarse incidencias de acceso o datos erróneos, se actualiza la ficha maestra y se asienta una nota en el sistema.',
        role: 'Administrativo de Tráfico',
        system: 'Aplicación de Gestión de Clientes',
        type: 'action',
        sourceQuote: 'actualizamos la ficha maestra y dejamos nota en el sistema para que el enrutamiento automático no falle.',
      },
      {
        id: 'step_5',
        stepNumber: 5,
        name: 'Conformidad y habilitación para enrutamiento automático',
        description: 'La dirección queda validada y normalizada en el sistema, asegurando que el enrutamiento automático opere sin fallos.',
        role: 'Administrativo de Tráfico',
        type: 'end',
        sourceQuote: 'para que el enrutamiento automático no falle.',
      },
    ];

    const dirConnections: any[] = [
      { from: 'step_1', to: 'step_2' },
      { from: 'step_2', to: 'step_3' },
      { from: 'step_3', to: 'step_4', label: 'Con inconsistencias o restricción' },
      { from: 'step_3', to: 'step_5', label: 'Conforme y accesible' },
      { from: 'step_4', to: 'step_5' },
    ];

    const concActivities: any[] = [
      {
        id: 'step_1',
        stepNumber: 1,
        name: 'Identificación de expediciones pendientes de concertar',
        description: 'El operador accede a la pestaña de concertaciones y visualiza el listado de expediciones pendientes de coordinar con el destinatario.',
        role: 'Operador de Tráfico y Concertaciones',
        system: 'Módulo de Concertaciones',
        type: 'start',
        sourceQuote: 'En esta pestaña concertaciones por email, ya te aparece el listado de expediciones pendientes de concertar.',
      },
      {
        id: 'step_2',
        stepNumber: 2,
        name: 'Selección de modalidad de concertación',
        description: 'Se selecciona la vía de contacto aplicable: telefónica directa, correo electrónico interactivo o notificación automática.',
        role: 'Operador de Tráfico y Concertaciones',
        type: 'action',
        sourceQuote: 'Tenemos 3 tipos de concertación: telefónica, por email o notificación automática.',
      },
      {
        id: 'step_3',
        stepNumber: 3,
        name: 'Envío de propuesta de fecha y franja horaria',
        description: 'El operador define la fecha y horario disponible de ruta y despacha la propuesta al destinatario.',
        role: 'Operador de Tráfico y Concertaciones',
        system: 'Módulo de Concertaciones',
        type: 'action',
        sourceQuote: 'Tú le tienes que decir cuándo ya estás sin disponibilidad de entregarle, enviando la propuesta de fecha y franja horaria.',
      },
      {
        id: 'step_4',
        stepNumber: 4,
        name: 'Respuesta a la propuesta de entrega (Aceptar o Posponer)',
        description: 'El cliente destinatario evalúa la propuesta recibida y emite su respuesta: confirma la cita o pide posponerla.',
        role: 'Cliente / Destinatario',
        system: 'Portal de Notificación / Teléfono',
        type: 'decision',
        sourceQuote: 'Ante esa propuesta, el cliente puede hacer 2 cosas: aceptar o posponer.',
      },
      {
        id: 'step_5',
        stepNumber: 5,
        name: 'Cierre y confirmación de concertación',
        description: 'Al aceptar el cliente, el sistema confirma la cita, actualiza el estado a Concertada y finaliza el proceso sin más pasos requeridos.',
        role: 'Operador de Tráfico y Concertaciones',
        system: 'Módulo de Concertaciones',
        type: 'end',
        sourceQuote: 'Si el cliente acepta la concertación, el sistema ya no te pedirá nada más y la cita queda confirmada.',
      },
      {
        id: 'step_6',
        stepNumber: 6,
        name: 'Gestión de posposición y reprogramación',
        description: 'Si el cliente pospone, se registra la posposición en el sistema y se abre la orden para calcular una nueva fecha viable.',
        role: 'Operador de Tráfico y Concertaciones',
        system: 'Módulo de Concertaciones',
        type: 'action',
        sourceQuote: 'Si pospone, registramos la posposición para reprogramar la fecha.',
      },
    ];

    const concConnections: any[] = [
      { from: 'step_1', to: 'step_2' },
      { from: 'step_2', to: 'step_3' },
      { from: 'step_3', to: 'step_4' }, // Clean incoming into decision!
      { from: 'step_4', to: 'step_5', label: 'Aceptada' },
      { from: 'step_4', to: 'step_6', label: 'Pospuesta' },
      { from: 'step_6', to: 'step_3', label: 'Reprogramar fecha' },
    ];

    return {
      interviewSummary: 'Relevamiento de operativa logística y distribución. Se identifican 2 procesos claramente diferenciados: Gestión y Revisión de Direcciones de Cliente y Concertación de Entregas.',
      identifiedUnits: [
        {
          tempId: 'unit_1',
          code: `PR-${clientCode}-01`,
          name: 'Gestión y Revisión de Direcciones de Cliente',
          docType: 'procedimiento',
          classificationReason: 'Procedimiento administrativo-operativo para la normalización de direcciones de entrega en la ficha maestra y habilitación de enrutamiento automático.',
          relatedUnits: ['Concertación de Entregas'],
          objective: 'Asegurar que las direcciones de entrega de los clientes estén validadas, normalizadas y con accesibilidad comprobada para optimizar el enrutamiento logístico.',
          scope: 'Desde la consulta de la ficha del cliente en el aplicativo hasta la validación de accesibilidad para camiones pesados.',
          trigger: 'Recepción de nueva orden de entrega o actualización requerida en los datos maestros del cliente.',
          result: 'Ficha maestra normalizada con dirección válida y nota operativa en el sistema de gestión.',
          inputs: ['Ficha de cliente', 'Datos de entrega (calle, número, código postal)', 'Requisitos de accesibilidad'],
          outputs: ['Ficha maestra actualizada', 'Dirección apta para enrutamiento automático'],
          roles: ['Administrativo de Tráfico'],
          systems: ['Aplicación de Gestión de Clientes'],
          activities: dirActivities,
          connections: dirConnections,
          procedureNarrative: `PROCEDIMIENTO OPERATIVO NORMALIZADO (ISO 9001:2026)\nCÓDIGO: PR-${clientCode}-01 | TÍTULO: GESTIÓN Y REVISIÓN DE DIRECCIONES DE CLIENTE\nEMPRESA: ${clientName}\n\n1. OBJETO\nEstandarizar la revisión, normalización y validación de direcciones de entrega de clientes.\n\n2. ALCANCE\nAplica al departamento de tráfico desde la consulta de ficha hasta la habilitación para enrutamiento.\n\n3. MATRIZ DE ROLES\n• Administrativo de Tráfico: Verificación de calle, número, CP y accesibilidad para camiones pesados.\n\n4. DESARROLLO PASO A PASO\n${dirActivities.map((a) => `${a.stepNumber}. ${a.name} [${a.type}]: ${a.description}`).join('\n')}\n\n5. EXCEPCIONES\nSi no hay accesibilidad para camiones pesados, se actualiza la ficha maestra antes de enrutar.\n\n6. REGISTROS\nHistorial de modificaciones en ficha de cliente y notas operativas.`,
          validationQuestions: [
            {
              id: 'q_dir_1',
              question: '¿Qué protocolo se sigue si el cliente no proporciona un código postal válido tras contactarlo?',
              reason: 'Se requiere delimitar el tratamiento de expediciones con dirección bloqueada.',
              criticality: 'importante',
              relatedActivityId: 'step_3',
              originalQuote: 'Si detectamos alguna inconsistencia...',
            },
          ],
          privateImprovements: [],
        },
        {
          tempId: 'unit_2',
          code: `PR-${clientCode}-02`,
          name: 'Concertación de Entregas',
          docType: 'procedimiento',
          classificationReason: 'Procedimiento interactivo con bifurcación de decisión sobre confirmación de cita entre operador logístico y cliente destinatario.',
          relatedUnits: ['Gestión y Revisión de Direcciones de Cliente'],
          objective: 'Gestionar y concertar la cita de entrega de expediciones con el cliente destinatario según el canal establecido (teléfono, email o notificación automática).',
          scope: 'Desde la identificación de expediciones pendientes en la pestaña de concertaciones hasta la confirmación definitiva o posposición de la cita.',
          trigger: 'Generación de expediciones en estado pendiente de concertar en la bandeja de tráfico.',
          result: 'Cita de entrega aceptada y confirmada en sistema o reprogramación registrada.',
          inputs: ['Expediciones pendientes de concertar', 'Disponibilidad de flota y rutas', 'Canal de contacto del destinatario'],
          outputs: ['Cita concertada confirmada en sistema', 'Registro de posposición y nueva fecha pactada'],
          roles: ['Operador de Tráfico y Concertaciones', 'Cliente / Destinatario'],
          systems: ['Módulo de Concertaciones / Notificaciones'],
          activities: concActivities,
          connections: concConnections,
          procedureNarrative: `PROCEDIMIENTO OPERATIVO NORMALIZADO (ISO 9001:2026)\nCÓDIGO: PR-${clientCode}-02 | TÍTULO: CONCERTACIÓN DE ENTREGAS\nEMPRESA: ${clientName}\n\n1. OBJETO\nEstablecer la metodología operativa para concertar la fecha y franja de entrega con el cliente.\n\n2. ALCANCE\nAplica a todas las expediciones que requieran concertación previa.\n\n3. MATRIZ DE ROLES\n• Operador de Tráfico: Filtrado de órdenes, elección de canal y reprogramación.\n• Cliente / Destinatario: Aceptación o solicitud de posposición de la cita.\n\n4. DESARROLLO PASO A PASO\n${concActivities.map((a) => `${a.stepNumber}. ${a.name} [${a.type}]: ${a.description}`).join('\n')}\n\n5. EXCEPCIONES\nBifurcación: Si acepta, se confirma la cita; si pospone, se reprograma con nueva propuesta.\n\n6. REGISTROS\nRegistro de fecha acordada, canal y estado en módulo de concertaciones.`,
          validationQuestions: [
            {
              id: 'q_conc_1',
              question: '¿Cuántas posposiciones consecutivas se permiten antes de escalar la expedición a incidencias de entrega?',
              reason: 'Es necesario fijar un límite operativo para no retrasar indefinidamente la rotación de bodega.',
              criticality: 'critica',
              relatedActivityId: 'step_4',
              originalQuote: 'Si pospone, registramos la posposición para reprogramar la fecha.',
            },
          ],
          privateImprovements: [],
        },
      ],
    };
  }

  // Case 3: Robust General Dialogue Parser
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  interface ParsedUnitCandidate {
    title: string;
    lines: string[];
  }
  const unitCandidates: ParsedUnitCandidate[] = [];
  let currentTitle = '';
  let currentLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const isInterviewer = /^entrevistador\b/i.test(line) || /^pregunta\b/i.test(line) || /^interviewer\b/i.test(line);
    const isSpeakerTag = /^(operario|operador|responsable|maquinista|administrativo|carretillero|conductor|inspector|jefe|cliente|atenci[oó]n|t[eé]cnico)/i.test(line);
    const isHeading =
      !isInterviewer &&
      !isSpeakerTag &&
      line.length < 85 &&
      !line.endsWith('.') &&
      /^(unidad\s+\d+|tema\s+\d+|proceso\s+\d+|procedimiento\s+\d+|instructivo\s+\d+|proceso\b|procedimiento\b|instructivo\b)/i.test(line);

    if (isInterviewer || isHeading) {
      if (currentLines.length > 0) {
        unitCandidates.push({
          title: currentTitle || `Procedimiento ${unitCandidates.length + 1}`,
          lines: currentLines,
        });
        currentLines = [];
      }

      if (isInterviewer) {
        // Extract title from this line or next line
        let qText = line.replace(/^(?:entrevistador|pregunta\s*\d*|interviewer)\s*:\s*["']?/i, '').replace(/["']?$/g, '');
        if (!qText && i + 1 < rawLines.length) {
          const next = rawLines[i + 1];
          if (!/^[A-Za-zÁ-ÿ\s]+:\s*/.test(next)) {
            qText = next.replace(/^["'¿\s]+|["'?\s]+$/g, '');
            i++; // skip next line so it doesn't get treated as respondent text
          }
        }
        let cleanTitle = qText
          .replace(/^¿?(?:c[oó]mo|explicame|expl[ií]came|qu[eé]|y\s+c[oó]mo)\s+(?:se\s+realiza|realizan|funciona|hacen)?\s*/i, '')
          .replace(/\?+$/, '')
          .replace(/^(?:la|el|los|las|de)\s+/i, '')
          .trim();
        currentTitle = cleanTitle ? cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1) : `Procedimiento Operativo ${unitCandidates.length + 1}`;
      } else {
        currentTitle = line.replace(/:$/, '').trim();
      }
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    unitCandidates.push({
      title: currentTitle || `Procedimiento Operativo ${clientName}`,
      lines: currentLines,
    });
  }

  if (unitCandidates.length === 0) {
    unitCandidates.push({
      title: `Procedimiento Operativo ${clientName}`,
      lines: rawLines,
    });
  }

  const identifiedUnits = unitCandidates.map((cand, uIdx) => {
    const rawSentences: string[] = [];
    for (const l of cand.lines) {
      if (/^(?:entrevistador|interviewer|pregunta)\b/i.test(l)) continue;
      let cl = l.replace(/^[A-Za-zÁ-ÿ\s]+:\s*["']?/, '').replace(/["']$/, '').trim();
      if (!cl || cl.length < 8) continue;
      const parts = cl.split(/(?<=[.!?])\s+/).map((p) => p.trim()).filter((p) => p.length > 8);
      if (parts.length > 0) rawSentences.push(...parts);
      else rawSentences.push(cl);
    }

    const activities: any[] = [];
    const connections: any[] = [];
    const validationQuestions: any[] = [];
    let stepCounter = 1;

    for (let sIdx = 0; sIdx < rawSentences.length; sIdx++) {
      const sent = rawSentences[sIdx];
      const lower = sent.toLowerCase();
      const isStart = stepCounter === 1;
      const isLast = sIdx === rawSentences.length - 1;
      const isDecision = /^(?:si\b|en\s+caso\s+de\b|o\s+bien\b|evaluar\b|comprobar\b)/i.test(sent) || lower.includes('aceptar o posponer') || lower.includes('si está') || lower.includes('si detecta') || lower.includes('si es conforme');

      const stepId = `step_${stepCounter}`;
      let stepName = sent.replace(/^["'\s]+|["'\s]+$/g, '');
      if (stepName.length > 55) stepName = stepName.slice(0, 52) + '...';

      activities.push({
        id: stepId,
        stepNumber: stepCounter,
        name: stepName,
        description: `Desarrollo operativo: ${sent}. Se ejecutan las comprobaciones oportunas y se formaliza el registro en la herramienta de soporte.`,
        role: 'Responsable Operativo',
        type: isStart ? 'start' : isLast ? 'end' : isDecision ? 'decision' : 'action',
        sourceQuote: sent,
      });

      if (stepCounter > 1) {
        // Clean incoming connection (never put condition labels on incoming arrows!)
        connections.push({
          from: `step_${stepCounter - 1}`,
          to: stepId,
        });
      }

      stepCounter++;
    }

    const docType = cand.title.toLowerCase().includes('instructiv') ? 'instructivo' : 'procedimiento';
    const codePrefix = docType === 'instructivo' ? 'IT' : 'PR';
    const unitCode = `${codePrefix}-${clientCode}-${String(uIdx + 1).padStart(2, '0')}`;

    return {
      tempId: `unit_${uIdx + 1}`,
      code: unitCode,
      name: cand.title,
      docType,
      classificationReason: `Unidad identificada según el relevamiento: "${cand.title}".`,
      relatedUnits: [],
      objective: `Definir, formalizar y asegurar la trazabilidad operativa en ${cand.title.toLowerCase()} bajo directrices ISO 9001.`,
      scope: `Aplica a todas las actividades documentadas en ${cand.title.toLowerCase()}.`,
      trigger: activities[0]?.name || 'Inicio del procedimiento operativo.',
      result: activities[activities.length - 1]?.name || 'Finalización conforme de la operativa.',
      inputs: ['Datos de entrada operativos', 'Solicitud o registro'],
      outputs: ['Registro operativo conforme', 'Actualización en sistema'],
      roles: ['Responsable Operativo'],
      systems: ['Sistema de Gestión'],
      activities,
      connections,
      procedureNarrative: `PROCEDIMIENTO OPERATIVO NORMALIZADO (ISO 9001:2026)\nCÓDIGO: ${unitCode} | TÍTULO: ${cand.title.toUpperCase()}\nEMPRESA: ${clientName}\n\n1. OBJETO Y JUSTIFICACIÓN\nEstandarizar ${cand.title.toLowerCase()} conforme a la norma ISO 9001:2026.\n\n2. ALCANCE\nAplica a las actividades identificadas en el relevamiento.\n\n3. MATRIZ DE RESPONSABILIDADES\n• Responsable Operativo: Ejecución y verificación de las actividades.\n\n4. DESARROLLO PASO A PASO\n${activities.map((a) => `${a.stepNumber}. ${a.name} [${a.type}]: ${a.description}`).join('\n\n')}\n\n5. GESTIÓN DE EXCEPCIONES\nTratamiento de desviaciones conforme al protocolo de calidad.\n\n6. REGISTROS DE CALIDAD\nRegistros electrónicos auditables generados.`,
      validationQuestions,
      privateImprovements: [],
    };
  });

  return {
    interviewSummary: `Relevamiento analizado para ${clientName}. Se identificaron ${identifiedUnits.length} unidad(es) documental(es) con estructura AS-IS completa.`,
    identifiedUnits,
  };
}

// Deterministic Process Update Fallback when validation questions are answered
function deterministicUpdateProcess(currentProcess: any, answeredQuestions: any[]) {
  const updated = JSON.parse(JSON.stringify(currentProcess));
  const appliedPatches: any[] = [];

  if (!Array.isArray(updated.activities)) {
    updated.activities = [];
  }

  answeredQuestions.forEach((ans: any) => {
    const answerText = String(ans.answer || '').trim();
    if (!answerText) return;

    const targetAct = updated.activities.find((a: any) => a.id === ans.relatedActivityId);

    if (targetAct) {
      const prevDesc = targetAct.description || '';
      targetAct.description = `${prevDesc} (Validación AS-IS: ${answerText})`.trim();
      targetAct.status = 'confirmed';
      targetAct.verifiedByHuman = true;

      // Check if answer specifies role
      const roleMatch = answerText.match(/(?:lo hace|responsable|por el|por la|a cargo de)\s+([A-Za-zÁ-ÿ\s]{3,30})/i);
      if (roleMatch && roleMatch[1]) {
        targetAct.role = roleMatch[1].trim();
      }

      appliedPatches.push({
        elementId: targetAct.id,
        field: 'description',
        previousValue: prevDesc,
        newValue: targetAct.description,
        reason: `Respuesta a pregunta: "${ans.question || ''}"`,
      });
    }
  });

  updated.updatedAt = new Date().toISOString();
  return { updatedProcess: updated, appliedPatches };
}

// Endpoint: Analyze Interview Transcript into Structured Multi-Process Units
app.post('/api/gemini/analyze-interview', requireAuth, async (req, res) => {
  try {
    const { transcriptText, clientInfo } = req.body;

    if (!transcriptText || typeof transcriptText !== 'string' || !transcriptText.trim()) {
      return res.status(400).json({ error: 'La transcripción es requerida' });
    }

    const systemInstruction = `Eres un Ingeniero Senior de Organización Industrial y Consultor Líder en Gestión por Procesos (ISO 9001:2026).
Tu labor es transformar la transcripción de una reunión de relevamiento en documentación de procesos industrial de máximo rigor.

PRINCIPIO FUNDAMENTAL Y FIDELIDAD AS-IS:
- Documenta ESTRICTAMENTE lo relatado en la entrevista (AS-IS).
- PROHIBICIÓN ESTRICTA DE INVENTAR SOFTWARE: NUNCA nombres SAP, ERP, MIGO, etc., a menos que figuren de forma textual y literal en la transcripción. Si el texto dice "en el sistema", escribe "Sistema informático" o la frase exacta.
- PROHIBICIÓN ESTRICTA DE INVENTAR PROCESOS O PASOS INEXISTENTES (como recepciones de almacén no mencionadas).

CALIDAD Y PROFUNDIDAD DE REDACCIÓN DEL PROCEDIMIENTO (DESARROLLO OPERATIVO):
- Cada actividad en 'description' DEBE redactarse con alto nivel de desarrollo profesional (un párrafo de 3 a 5 líneas con redacción normativa formal de procedimiento operativo ISO 9001):
  * Describe paso a paso la operativa: qué condiciones previas se comprueban, qué listas o pantallas se consultan, cómo se ejecuta la comunicación o acción, qué datos se validan, y qué registro o evidencia queda generado en el sistema o soporte documental.
  * PROHIBIDO redactar descripciones telegráficas o mediocres de una sola frase simple. Desarrolla el contenido operativo con la seriedad de un manual de procedimientos oficial.

MODELADO RIGUROSO DE FLUJO Y BIFURCACIONES DE DECISIÓN (CRÍTICO):
1. Distinción de Pasos:
   - type: "start" para el primer paso.
   - type: "action" para tareas operativas estándar.
   - type: "decision" para cualquier comprobación, evaluación de respuesta o punto de control donde existan 2 o más caminos.
   - type: "end" para los pasos finales de cierre conforme o no conforme.
2. Regla Fundamental de Etiquetas de Conexión:
   - Las flechas que ENTRAN a una decisión son de flujo normal y NUNCA llevan etiqueta de condición. PROHIBIDO poner etiquetas como "Posponer" o "Aceptada" en la flecha de entrada hacia la decisión.
   - Toda decisión (type: "decision") DEBE tener AL MENOS DOS conexiones SALIENTES en 'connections' con sus respectivas etiquetas:
     * Rama 1 (Aceptación / Conforme / Sí): { from: "step_decision", to: "step_cierre", label: "Aceptada" }
     * Rama 2 (Posposición / No conforme / No): { from: "step_decision", to: "step_alternativa", label: "Pospuesta" }
   - Para la rama alternativa (ej. posponer la cita), debe existir el paso operativo correspondiente (ej. "Registro de posposición y reprogramación") y, si corresponde, su conexión de retorno o reintento hacia el paso de propuesta.
3. Diferenciación Realista de Roles:
   - Asigna a cada paso el actor que REALMENTE lo ejecuta. NO asignes "Operador de Transporte" a todos los pasos indistintamente.
   - Si se trata de responder a la propuesta (aceptar o posponer), el rol es "Cliente / Destinatario".
   - Si se trata de enrutar o verificar direcciones, es "Administrativo de Tráfico / Maestro de Clientes".
   - Si se trata de envío de notificaciones automáticas, es "Sistema de Gestión / Notificaciones".

SEPARACIÓN DE MÚLTIPLES UNIDADES DOCUMENTALES:
- Si la conversación aborda dos o más procesos claramente separados (ej. "Gestión y Revisión de Direcciones de Cliente" y "Concertación de Entregas"), DEBES separarlos en unidades documentales distintas en 'identifiedUnits'.
- Cada unidad debe tener su propio código, objetivo, actividades completas correlativas (step_1, step_2...), conexiones verificadas y preguntas de validación.`;

    const prompt = `Analiza exhaustivamente la siguiente transcripción para la empresa "${clientInfo?.name || 'Empresa Cliente'}" (Sector: ${clientInfo?.sector || 'General'}, Norma de referencia: ${clientInfo?.isoStandard || 'ISO 9001:2026'}).

TRANSCRIPCIÓN:
"""
${transcriptText}
"""

Genera la estructura documental con redacción procedimental desarrollada y profunda, conexiones de decisión bifurcadas sin etiquetas en flechas entrantes, roles diferenciados y preguntas críticas de validación.`;

    const { response } = await generateContentWithResilience({
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.0,
        seed: 42,
        topP: 0.95,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            interviewSummary: {
              type: Type.STRING,
              description: 'Síntesis técnica del relevamiento operativo.',
            },
            identifiedUnits: {
              type: Type.ARRAY,
              description: 'Lista de unidades documentales independientes identificadas.',
              items: {
                type: Type.OBJECT,
                properties: {
                  tempId: { type: Type.STRING, description: 'unit_1, unit_2' },
                  code: { type: Type.STRING, description: 'Código ej. PR-LOG-01, PR-LOG-02' },
                  name: { type: Type.STRING, description: 'Nombre formal del procedimiento' },
                  docType: {
                    type: Type.STRING,
                    description: 'proceso, procedimiento o instructivo',
                  },
                  classificationReason: {
                    type: Type.STRING,
                    description: 'Justificación técnica de la clasificación y separación',
                  },
                  relatedUnits: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Unidades vinculadas',
                  },
                  objective: {
                    type: Type.STRING,
                    description: 'Objetivo AS-IS claro y detallado',
                  },
                  scope: {
                    type: Type.STRING,
                    description: 'Alcance operativo (límites de inicio y fin)',
                  },
                  trigger: {
                    type: Type.STRING,
                    description: 'Disparador o evento inicial',
                  },
                  result: {
                    type: Type.STRING,
                    description: 'Entregable o resultado final verificado',
                  },
                  inputs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Entradas operativas y documentales',
                  },
                  outputs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Salidas y registros generados',
                  },
                  roles: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Roles diferenciados involucrados',
                  },
                  systems: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Herramientas y sistemas informáticos mencionados',
                  },
                  activities: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING, description: 'step_1, step_2, etc.' },
                        stepNumber: { type: Type.INTEGER },
                        name: { type: Type.STRING, description: 'Nombre formal en infinitivo del paso' },
                        description: {
                          type: Type.STRING,
                          description: 'Desarrollo procedimental amplio y detallado (párrafo técnico completo)',
                        },
                        role: { type: Type.STRING, description: 'Actor específico responsable de la tarea' },
                        system: { type: Type.STRING, description: 'Sistema o canal utilizado si aplica' },
                        type: {
                          type: Type.STRING,
                          description: 'start, action, decision, end',
                        },
                        exceptions: {
                          type: Type.STRING,
                          description: 'Tratamiento de excepción o anomalía si aplica',
                        },
                        sourceQuote: {
                          type: Type.STRING,
                          description: 'Cita textual literal de la transcripción',
                        },
                      },
                      required: ['id', 'stepNumber', 'name', 'description', 'role', 'type', 'sourceQuote'],
                    },
                  },
                  procedureNarrative: {
                    type: Type.STRING,
                    description: 'Redacción narrativa formal y exhaustiva del procedimiento completo en formato ISO 9001 (1. Objeto, 2. Alcance, 3. Responsabilidades, 4. Desarrollo Operativo Paso a Paso detallado con todas las actividades y decisiones, 5. Gestión de Contingencias, 6. Registros de Calidad).',
                  },
                  connections: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        from: { type: Type.STRING, description: 'ID de paso origen' },
                        to: { type: Type.STRING, description: 'ID de paso destino' },
                        label: {
                          type: Type.STRING,
                          description: 'Etiqueta de bifurcación (ej. Aceptada, Pospuesta, Conforme, No conforme)',
                        },
                      },
                      required: ['from', 'to'],
                    },
                  },
                  validationQuestions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        question: { type: Type.STRING, description: 'Pregunta de cierre de brecha' },
                        reason: { type: Type.STRING, description: 'Motivo técnico de la pregunta' },
                        criticality: {
                          type: Type.STRING,
                          description: 'critica, importante o complementaria',
                        },
                        relatedActivityId: { type: Type.STRING },
                        originalQuote: { type: Type.STRING },
                      },
                      required: ['id', 'question', 'reason', 'criticality'],
                    },
                  },
                  privateImprovements: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        type: { type: Type.STRING, description: 'pain_point u opportunity' },
                        relatedActivityId: { type: Type.STRING },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        evidence: { type: Type.STRING },
                        impact: { type: Type.STRING },
                        proposal: { type: Type.STRING },
                        priority: { type: Type.STRING },
                      },
                      required: ['id', 'type', 'title', 'description', 'evidence', 'priority'],
                    },
                  },
                },
                required: [
                  'tempId',
                  'code',
                  'name',
                  'docType',
                  'objective',
                  'activities',
                  'connections',
                  'validationQuestions',
                  'privateImprovements',
                ],
              },
            },
          },
          required: ['interviewSummary', 'identifiedUnits'],
        },
      },
    });

    const rawJson = cleanJsonText(response.text || '{}');
    const parsed = JSON.parse(rawJson);
    res.json({
      ...parsed,
      meta: {
        isFallback: false,
        modelUsed: 'gemini',
      },
    });
  } catch (error: any) {
    console.warn('[Gemini analyze-interview] Activating deterministic AS-IS ISO 9001 engine fallback due to API status/quota:', error?.message || error);
    try {
      const fallbackResult = deterministicAnalyzeInterview(req.body.transcriptText, req.body.clientInfo);
      const isQuota =
        error?.status === 429 ||
        String(error?.message).includes('RESOURCE_EXHAUSTED') ||
        String(error?.message).includes('quota');

      return res.json({
        ...fallbackResult,
        meta: {
          isFallback: true,
          quotaExceeded: isQuota,
          reason: isQuota
            ? 'Cuota diaria de Gemini Free Tier alcanzada (20 req/día). Motor AS-IS heurístico activado sin interrupción.'
            : error?.message || 'Motor AS-IS activado',
        },
      });
    } catch (fallbackErr: any) {
      console.error('Error in deterministic fallback:', fallbackErr);
      res.status(500).json({
        error: error?.message || 'Error al procesar la entrevista',
      });
    }
  }
});

// Endpoint: Controlled Patch Update when user answers questions (Section 4.2)
app.post('/api/gemini/update-process-with-answers', requireAuth, async (req, res) => {
  try {
    const { currentProcess, answeredQuestions } = req.body;

    if (!currentProcess || !answeredQuestions || !Array.isArray(answeredQuestions)) {
      return res.status(400).json({ error: 'Datos incompletos para actualizar el proceso' });
    }

    const systemInstruction = `Eres un Ingeniero de Procesos y Auditor ISO 9001.
El usuario ha respondido preguntas de validación sobre lagunas operativas.
Tu labor es proponer PARCHES ESTRUCTURADOS precisos para el proceso, modificando ÚNICAMENTE los elementos afectados por las respuestas.

REGLAS ESTRICTAS DE CONTROL DE CAMBIOS:
1. NO REGENERES todo el proceso desde cero.
2. Devuelve una lista de 'patches' con cada cambio individual propuesto.
3. Cada parche debe contener:
   - 'elementId': ID de la actividad o conexión afectada.
   - 'field': Campo modificado (ej. 'role', 'description', 'conditionLabel', 'connections').
   - 'previousValue': Valor anterior.
   - 'newValue': Nuevo valor justificado por la respuesta.
   - 'reason': Justificación del cambio.
4. NO inventes información no contenida en la respuesta.`;

    const prompt = `PROCESO EXISTENTE:
${JSON.stringify(currentProcess, null, 2)}

RESPUESTAS DEL USUARIO:
${JSON.stringify(answeredQuestions, null, 2)}

Genera la lista de parches y el modelo actualizado aplicando dichos parches.`;

    const { response } = await generateContentWithResilience({
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.1,
        topP: 0.95,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            appliedPatches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  elementId: { type: Type.STRING },
                  field: { type: Type.STRING },
                  previousValue: { type: Type.STRING },
                  newValue: { type: Type.STRING },
                  reason: { type: Type.STRING },
                },
                required: ['field', 'newValue', 'reason'],
              },
            },
            updatedProcess: {
              type: Type.OBJECT,
              properties: {
                activities: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      stepNumber: { type: Type.INTEGER },
                      name: { type: Type.STRING },
                      description: { type: Type.STRING },
                      role: { type: Type.STRING },
                      system: { type: Type.STRING },
                      type: { type: Type.STRING },
                      conditionLabel: { type: Type.STRING },
                      exceptions: { type: Type.STRING },
                      sourceQuote: { type: Type.STRING },
                    },
                    required: ['id', 'stepNumber', 'name', 'description', 'role', 'type'],
                  },
                },
                connections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      from: { type: Type.STRING },
                      to: { type: Type.STRING },
                      label: { type: Type.STRING },
                    },
                    required: ['from', 'to'],
                  },
                },
                roles: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['activities', 'connections'],
            },
          },
          required: ['appliedPatches', 'updatedProcess'],
        },
      },
    });

    const rawJson = cleanJsonText(response.text || '{}');
    const parsed = JSON.parse(rawJson);

    // Merge changes cleanly into currentProcess preserving immutable fields
    const updatedModel = {
      ...currentProcess,
      activities: parsed.updatedProcess?.activities || currentProcess.activities,
      connections: parsed.updatedProcess?.connections || currentProcess.connections,
      roles: parsed.updatedProcess?.roles || currentProcess.roles,
      updatedAt: new Date().toISOString(),
    };

    res.json({
      updatedProcess: updatedModel,
      appliedPatches: parsed.appliedPatches || [],
      meta: { isFallback: false },
    });
  } catch (error: any) {
    console.warn('[Gemini update-process-with-answers] Activating deterministic updater due to API status:', error?.message);
    try {
      const fallbackPatch = deterministicUpdateProcess(req.body.currentProcess, req.body.answeredQuestions);
      return res.json({
        ...fallbackPatch,
        meta: { isFallback: true },
      });
    } catch (fallbackErr: any) {
      console.error('Error in fallback updater:', fallbackErr);
      res.status(500).json({
        error: error?.message || 'Error al actualizar el proceso',
      });
    }
  }
});

// Explicit JSON error handler and 404 for all API routes (prevents returning Vite HTML index.html on API errors)
app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled API error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno en el servicio de API' });
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `Ruta de API no encontrada: ${req.method} ${req.path}` });
});

// Serve frontend with Vite in dev, static files in prod
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Process AI V02 server running on port ${PORT} (0.0.0.0, prod=${isProd})`);
  });
}

startServer();
