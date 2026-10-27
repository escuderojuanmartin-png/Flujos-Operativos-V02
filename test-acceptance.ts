import assert from 'node:assert';
import { ProcessModel, Client } from './src/types/process.ts';
import { validateProcessGraph } from './src/lib/graphValidation.ts';
import { buildOfficialDocumentModel } from './src/lib/officialDocumentModel.ts';
import { generateDrawioXml } from './src/lib/exportDrawio.ts';

console.log('🧪 Iniciando pruebas de aceptación obligatorias (Process AI V02)...\n');

const testClient: Client = {
  id: 'client_test_01',
  ownerId: 'user_test',
  name: 'Empresa Test Calidad S.A.',
  code: 'ETC',
  sector: 'Logística',
  isoStandard: 'ISO 9001:2026',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// -------------------------------------------------------------
// PRUEBA 12: Confidencialidad estricta de hallazgos privados
// -------------------------------------------------------------
console.log('▶ Ejecutando Prueba 12: Confidencialidad estricta de hallazgos privados...');
const PRIVATE_TOKEN = 'HALLAZGO_PRIVADO_PRUEBA_82741';

const sampleProcessWithPrivateFinding: ProcessModel = {
  id: 'proc_test_private',
  surveyId: 'survey_test',
  clientId: testClient.id,
  ownerId: testClient.ownerId,
  code: 'PR-ETC-01',
  name: 'Proceso de Prueba de Confidencialidad',
  docType: 'procedimiento',
  status: 'validado',
  version: '1.0',
  objective: 'Verificar aislamiento estricto de hallazgos de consultoría.',
  scope: 'General.',
  trigger: 'Inicio.',
  result: 'Fin.',
  inputs: ['Entrada'],
  outputs: ['Salida'],
  roles: ['Operador'],
  systems: ['ERP'],
  activities: [
    {
      id: 'step_1',
      stepNumber: 1,
      name: 'Actividad oficial 1',
      description: 'Paso operativo oficial.',
      role: 'Operador',
      type: 'action',
      status: 'confirmed',
    },
  ],
  connections: [],
  validationQuestions: [],
  privateImprovements: [
    {
      id: 'imp_secret_1',
      type: 'pain_point',
      title: `Punto de dolor confidencial ${PRIVATE_TOKEN}`,
      description: `Descripción interna que contiene ${PRIVATE_TOKEN}`,
      evidence: `Evidencia confidencial ${PRIVATE_TOKEN}`,
      impact: 'Alto impacto financiero',
      proposal: 'Reestructuración interna',
      priority: 'alta',
      status: 'detectado',
    },
  ],
  history: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// 1. Verify buildOfficialDocumentModel filters out private improvements
const officialDoc = buildOfficialDocumentModel(sampleProcessWithPrivateFinding, testClient);
const officialDocJson = JSON.stringify(officialDoc);
assert.strictEqual(
  officialDocJson.includes(PRIVATE_TOKEN),
  false,
  'FALLO: El marcador privado apareció en el OfficialDocumentModel'
);
assert.strictEqual(
  (officialDoc as any).privateImprovements,
  undefined,
  'FALLO: La propiedad privateImprovements está presente en OfficialDocumentModel'
);

// 2. Verify draw.io XML generation does not contain private improvements
const drawioXml = generateDrawioXml(sampleProcessWithPrivateFinding);
assert.strictEqual(
  drawioXml.includes(PRIVATE_TOKEN),
  false,
  'FALLO: El marcador privado apareció en el XML de draw.io'
);

console.log('✔ Prueba 12 SUPERADA: Los hallazgos privados no figuran en ningún modelo de exportación oficial.\n');

// -------------------------------------------------------------
// PRUEBA 3: Bloqueo de validación ante preguntas críticas abiertas
// -------------------------------------------------------------
console.log('▶ Ejecutando Prueba 3: Bloqueo de validación con preguntas críticas...');
const procWithCriticalQuestion: ProcessModel = {
  ...sampleProcessWithPrivateFinding,
  status: 'pendiente_informacion',
  validationQuestions: [
    {
      id: 'q_crit_1',
      question: '¿Quién autoriza el rechazo si la mercancía está defectuosa?',
      reason: 'Falta documentar el rol con autoridad',
      criticality: 'critica',
      status: 'pending',
    },
  ],
};

const validationCritical = validateProcessGraph(procWithCriticalQuestion);
assert.strictEqual(
  validationCritical.canValidate,
  false,
  'FALLO: canValidate debería ser false mientras existan preguntas críticas abiertas'
);
assert.ok(
  validationCritical.issues.some((i) => i.severity === 'error' && i.message.toLowerCase().includes('crítica')),
  'FALLO: Se esperaba issue de severidad error por pregunta crítica'
);

console.log('✔ Prueba 3 SUPERADA: La validación oficial se bloquea correctamente ante preguntas críticas abiertas.\n');

// -------------------------------------------------------------
// PRUEBA 4: Detección de inconsistencias en grafo (Decisiones huérfanas)
// -------------------------------------------------------------
console.log('▶ Ejecutando Prueba 4: Detección de inconsistencias de grafo y cero datos ficticios...');
const procWithDanglingDecision: ProcessModel = {
  ...sampleProcessWithPrivateFinding,
  activities: [
    {
      id: 'act_1',
      stepNumber: 1,
      name: 'Inicio',
      description: 'Disparador',
      role: 'Operador',
      type: 'start',
    },
    {
      id: 'act_dec_2',
      stepNumber: 2,
      name: 'Control de Conformidad',
      description: '¿Mercancía correcta?',
      role: 'Inspector',
      type: 'decision',
    },
  ],
  connections: [{ from: 'act_1', to: 'act_dec_2' }], // act_dec_2 has 0 outgoing branches!
  validationQuestions: [],
};

const validationGraph = validateProcessGraph(procWithDanglingDecision);
assert.strictEqual(
  validationGraph.isValid,
  false,
  'FALLO: El grafo con decisión sin salida no debe ser válido'
);
assert.ok(
  validationGraph.issues.some((i) => i.type === 'dangling_decision' && i.severity === 'error'),
  'FALLO: No se detectó el error de decisión huérfana'
);

// Check that drawio does NOT invent a fictitious sequential edge
const drawioDangling = generateDrawioXml(procWithDanglingDecision);
assert.strictEqual(
  drawioDangling.includes('e_seq_'),
  false,
  'FALLO: draw.io inventó una conexión lineal secuencial ficticia'
);

console.log('✔ Prueba 4 SUPERADA: Decisiones sin salidas identificadas generan error y no inventan conexiones.\n');

// -------------------------------------------------------------
// PRUEBA 8: Sincronización y consistencia de identificadores
// -------------------------------------------------------------
console.log('▶ Ejecutando Prueba 8: Integridad referencial de nodos y conexiones...');
const procWithInvalidEdge: ProcessModel = {
  ...sampleProcessWithPrivateFinding,
  activities: [
    { id: 'n1', stepNumber: 1, name: 'Paso 1', description: 'Desc', role: 'Rol', type: 'action' }
  ],
  connections: [
    { from: 'n1', to: 'n_inexistente' }
  ],
};

const validationInvalidEdge = validateProcessGraph(procWithInvalidEdge);
assert.strictEqual(
  validationInvalidEdge.isValid,
  false,
  'FALLO: Grafo con conexión a nodo inexistente no debe ser válido'
);
assert.ok(
  validationInvalidEdge.issues.some((i) => i.type === 'invalid_connection'),
  'FALLO: No se detectó la conexión a actividad inexistente'
);

console.log('✔ Prueba 8 SUPERADA: Integridad referencial de identificadores asegurada.\n');

console.log('🎉 TODAS LAS PRUEBAS AUTOMATIZADAS DE ACEPTACIÓN SE EJECUTARON CON ÉXITO.');
