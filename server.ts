import express from 'express';
import dotenv from 'dotenv';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import fs from 'fs';

dotenv.config();

const app = express();
// Runtime Environment constraint: Dev server must always run on port 3000
const isProd = process.env.NODE_ENV === 'production';
const PORT = isProd ? (process.env.PORT ? parseInt(process.env.PORT, 10) : 8080) : 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB
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

// Endpoint: Audio transcription using gemini-3.5-transcribe
app.post('/api/gemini/transcribe-audio', upload.single('audio'), async (req, res) => {
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
      model: 'gemini-3.5-transcribe',
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
    console.error('Error in /api/gemini/transcribe-audio:', error);
    res.status(500).json({
      error: error.message || 'Error al procesar la transcripción de audio con Gemini',
    });
  }
});

// Endpoint: Analyze Interview Transcript into Structured Multi-Process Units
app.post('/api/gemini/analyze-interview', async (req, res) => {
  try {
    const { transcriptText, clientInfo } = req.body;

    if (!transcriptText || typeof transcriptText !== 'string' || !transcriptText.trim()) {
      return res.status(400).json({ error: 'La transcripción es requerida' });
    }

    const systemInstruction = `Eres un Ingeniero Senior de Procesos y Auditor Líder ISO 9001:2026.
Tu objetivo es analizar la transcripción de una reunión o entrevista de relevamiento y estructurarla en unidades documentales precisas (Procesos, Procedimientos o Instructivos).

PRINCIPIO FUNDAMENTAL Y ABSOLUTO:
- Documentar ESTRICTAMENTE lo que REALMENTE se hace (AS-IS), no lo que debería hacerse.
- PROHIBIDO INVENTAR: No agregues actividades, controles, responsables ni condiciones que no estén en la transcripción.
- Si falta información operativa (ej. quién revisa, qué criterio se usa para decidir, qué pasa en caso de fallo), márcalo como "Pendiente de definir" o genéralo como una PREGUNTA DE VALIDACIÓN.

CLASIFICACIÓN DE UNIDADES:
1. Proceso: Conjunto amplio de actividades interrelacionadas que transforman entradas en resultados.
2. Procedimiento: Descripción de cómo se desarrolla una actividad o conjunto de actividades con varios roles o decisiones.
3. Instructivo: Instrucciones detalladas y específicas para ejecutar una tarea técnica concreta (por ej. transacciones en un software como SAP MIGO).

SUBDIVISIÓN:
Si la reunión menciona varios procesos o procedimientos distintos (por ejemplo: Recepción de mercancías, Gestión de devoluciones, y un Instructivo de registro en SAP), sepáralos en unidades documentales individuales e indica su relación.

SEPARACIÓN ESTRICTA DE MEJORAS:
Las oportunidades de mejora, puntos de dolor, cuellos de botella y riesgos operativos deben registrarse ÚNICAMENTE en el campo 'privateImprovements'. NUNCA deben contaminar el flujo de actividades ni las descripciones oficiales del proceso.`;

    const prompt = `Analiza la siguiente transcripción para la empresa "${clientInfo?.name || 'Empresa Cliente'}" (Sector: ${clientInfo?.sector || 'General'}, Norma de referencia: ${clientInfo?.isoStandard || 'ISO 9001:2026'}).

TRANSCRIPCIÓN:
"""
${transcriptText}
"""

Extrae todas las unidades documentales encontradas con su estructura completa, actividades en secuencia real (con roles, sistemas y tipos de nodo inicio/accion/decision/fin), preguntas de validación para lagunas o contradicciones detectadas, y puntos de dolor u oportunidades de mejora privadas.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            interviewSummary: {
              type: Type.STRING,
              description: 'Breve síntesis de los temas tratados en el relevamiento.',
            },
            identifiedUnits: {
              type: Type.ARRAY,
              description: 'Lista de procesos, procedimientos e instructivos identificados.',
              items: {
                type: Type.OBJECT,
                properties: {
                  tempId: { type: Type.STRING, description: 'Identificador temporal como unit_1, unit_2' },
                  code: { type: Type.STRING, description: 'Código sugerido ej. PR-LOG-01, IT-SAP-01' },
                  name: { type: Type.STRING, description: 'Nombre claro del proceso o procedimiento' },
                  docType: {
                    type: Type.STRING,
                    description: 'Clasificación recomendada: proceso, procedimiento o instructivo',
                  },
                  classificationReason: {
                    type: Type.STRING,
                    description: 'Justificación de por qué es proceso, procedimiento o instructivo',
                  },
                  relatedUnits: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Nombres o IDs de unidades relacionadas',
                  },
                  objective: {
                    type: Type.STRING,
                    description: 'Objetivo AS-IS identificado según la conversación',
                  },
                  scope: {
                    type: Type.STRING,
                    description: 'Alcance operativo (dónde inicia y dónde finaliza)',
                  },
                  trigger: {
                    type: Type.STRING,
                    description: 'Disparador o evento inicial (ej. Llegada de camión a planta)',
                  },
                  result: {
                    type: Type.STRING,
                    description: 'Resultado o entregable final del proceso',
                  },
                  inputs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Entradas mencionadas (albarán, solicitud, mercancía, etc.)',
                  },
                  outputs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Salidas generadas (recepción contabilizada, informe de daños, etc.)',
                  },
                  roles: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Roles o puestos involucrados mencionados',
                  },
                  systems: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Sistemas informáticos o herramientas utilizadas (SAP, Excel, etc.)',
                  },
                  activities: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING, description: 'ID único ej. step_1, step_2' },
                        stepNumber: { type: Type.INTEGER },
                        name: { type: Type.STRING, description: 'Nombre conciso de la actividad' },
                        description: { type: Type.STRING, description: 'Descripción AS-IS fiel de lo que se hace' },
                        role: { type: Type.STRING, description: 'Responsable de la tarea o "Pendiente de definir"' },
                        system: { type: Type.STRING, description: 'Sistema o herramienta utilizada si aplica' },
                        type: {
                          type: Type.STRING,
                          description: 'Tipo de elemento: start, action, decision, end',
                        },
                        conditionLabel: {
                          type: Type.STRING,
                          description: 'Si es una rama de decisión, etiqueta ej. Sí / No',
                        },
                        exceptions: {
                          type: Type.STRING,
                          description: 'Excepción mencionada si ocurre un problema',
                        },
                      },
                      required: ['id', 'stepNumber', 'name', 'description', 'role', 'type'],
                    },
                  },
                  connections: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        from: { type: Type.STRING, description: 'ID de actividad origen' },
                        to: { type: Type.STRING, description: 'ID de actividad destino' },
                        label: { type: Type.STRING, description: 'Etiqueta de la conexión (ej. Sí, No, Conforme)' },
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
                        question: { type: Type.STRING, description: 'Pregunta concreta sobre dato faltante o ambiguo' },
                        reason: { type: Type.STRING, description: 'Por qué es importante para la definición' },
                        relatedActivityId: { type: Type.STRING },
                        originalQuote: { type: Type.STRING, description: 'Frase textual de la transcripción' },
                      },
                      required: ['id', 'question', 'reason'],
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
                        title: { type: Type.STRING, description: 'Título del hallazgo' },
                        description: { type: Type.STRING, description: 'Detalle del punto de dolor o cuello de botella' },
                        evidence: { type: Type.STRING, description: 'Cita o evidencia extraída del audio/texto' },
                        impact: { type: Type.STRING, description: 'Impacto potencial en la operación o calidad' },
                        proposal: { type: Type.STRING, description: 'Propuesta de mejora técnica o automatización' },
                        priority: { type: Type.STRING, description: 'alta, media o baja' },
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

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze-interview:', error);
    res.status(500).json({
      error: error.message || 'Error al analizar la entrevista con Gemini',
    });
  }
});

// Endpoint: Update process model when user answers validation questions
app.post('/api/gemini/update-process-with-answers', async (req, res) => {
  try {
    const { currentProcess, answeredQuestions } = req.body;

    if (!currentProcess || !answeredQuestions || !Array.isArray(answeredQuestions)) {
      return res.status(400).json({ error: 'Datos incompletos para actualizar el proceso' });
    }

    const systemInstruction = `Eres un Ingeniero de Procesos y documentador ISO 9001.
El usuario ha respondido a preguntas de validación para aclarar lagunas o datos incompletos en un proceso.
Tu labor es actualizar el modelo estructurado del proceso incorporando con precisión las respuestas del usuario.

REGLAS:
1. No destruyas ni borres actividades previamente válidas que no fueron modificadas.
2. Actualiza los roles, condiciones, sistemas o actividades adicionales señaladas en las respuestas.
3. Si el usuario indicó quién es el responsable de un paso donde estaba "Pendiente de definir", asígnalo.
4. Si el usuario explicó el criterio de una decisión o qué pasa en una excepción, actualiza la actividad y la bifurcación.
5. NO inventes ningún detalle adicional más allá de lo contestado.
6. Devuelve el modelo completo actualizado conservando la coherencia de conexiones.`;

    const prompt = `PROCESO ACTUAL:
${JSON.stringify(currentProcess, null, 2)}

RESPUESTAS DEL USUARIO A LAS PREGUNTAS DE VALIDACIÓN:
${JSON.stringify(answeredQuestions, null, 2)}

Devuelve el proceso actualizado con las actividades, conexiones, roles y metadatos ajustados.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const updated = JSON.parse(response.text || '{}');
    res.json({ updatedProcess: updated });
  } catch (error: any) {
    console.error('Error in /api/gemini/update-process-with-answers:', error);
    res.status(500).json({
      error: error.message || 'Error al actualizar el proceso con Gemini',
    });
  }
});

// In development, hook Vite middleware; in production, serve built dist files
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

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
    console.log(`Process AI server running on port ${PORT} (0.0.0.0, prod=${isProd})`);
  });
}

startServer();
