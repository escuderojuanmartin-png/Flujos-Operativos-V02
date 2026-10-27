import { ProcessModel, Client, DocType, ProcessActivity } from '../types/process';

export interface OfficialActivityStep {
  stepNumber: number;
  name: string;
  role: string;
  system: string;
  type: string;
  description: string;
  exceptions?: string;
  sourceQuote?: string;
}

export interface OfficialDocumentModel {
  title: string;
  code: string;
  version: string;
  date: string;
  status: string;
  isDraft: boolean;
  docType: DocType;
  docTypeLabel: string;
  clientName: string;
  clientCode: string;
  isoStandard: string;
  objective: string;
  scope: string;
  trigger: string;
  result: string;
  roles: string[];
  systems: string[];
  inputs: string[];
  outputs: string[];
  activities: OfficialActivityStep[];
  exceptions: string[];
  revisionHistory: {
    version: string;
    date: string;
    author: string;
    description: string;
  }[];
}

/**
 * Builds the sanitized, official document model.
 * STRICT ISOLATION: Strips privateImprovements and consultative findings completely.
 */
export function buildOfficialDocumentModel(
  process: ProcessModel,
  client?: Client
): OfficialDocumentModel {
  const isDraft = process.status !== 'validado';
  const currentDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const docType = process.docType || 'procedimiento';
  const docTypeLabel =
    docType === 'proceso'
      ? 'MAPA Y DEFINICIÓN DE PROCESO'
      : docType === 'instructivo'
      ? 'INSTRUCTIVO TÉCNICO DE TRABAJO'
      : 'PROCEDIMIENTO OPERATIVO ESTÁNDAR';

  // Sanitize activities strictly without fabricating fake steps
  const activities: OfficialActivityStep[] = (process.activities || []).map((a) => ({
    stepNumber: a.stepNumber,
    name: a.name || 'Actividad no especificada',
    role: a.role || 'Pendiente de definir',
    system: a.system || '—',
    type: a.type || 'action',
    description: a.description || 'Sin descripción operativa registrada en la fuente.',
    exceptions: a.exceptions || undefined,
    sourceQuote: a.sourceQuote || undefined,
  }));

  // Extract explicit exceptions mentioned
  const exceptions = activities
    .map((a) => a.exceptions)
    .filter((e): e is string => Boolean(e && e.trim()));

  const roles = process.roles?.length
    ? process.roles
    : Array.from(new Set(activities.map((a) => a.role).filter((r) => r && r !== 'Pendiente de definir')));

  const revisionHistory = (process.history || []).map((h) => ({
    version: h.version,
    date: h.date,
    author: h.author,
    description: h.description,
  }));

  if (revisionHistory.length === 0) {
    revisionHistory.push({
      version: process.version || '1.0',
      date: currentDate,
      author: 'Revisión Técnica',
      description: 'Documentación inicial AS-IS generada a partir de relevamiento de operaciones.',
    });
  }

  return {
    title: process.name,
    code: process.code || 'PR-01',
    version: process.version || '1.0',
    date: currentDate,
    status: isDraft ? 'BORRADOR — PENDIENTE DE VALIDACIÓN' : 'VALIDADO AS-IS',
    isDraft,
    docType,
    docTypeLabel,
    clientName: client?.name || 'EMPRESA CLIENTE',
    clientCode: client?.code || 'CLI',
    isoStandard: client?.isoStandard || 'ISO 9001:2026',
    objective: process.objective || 'Definir la secuencia operativa actual conforme al relevamiento AS-IS.',
    scope: process.scope || 'Aplica a las actividades y roles descritos en este documento.',
    trigger: process.trigger || 'Disparador operativo identificado.',
    result: process.result || 'Resultado final entregable de la tarea.',
    roles,
    systems: process.systems || [],
    inputs: process.inputs || [],
    outputs: process.outputs || [],
    activities,
    exceptions,
    revisionHistory,
  };
}
