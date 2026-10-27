export type DocType = 'proceso' | 'procedimiento' | 'instructivo';
export type ProcessStatus = 'borrador' | 'pendiente_informacion' | 'en_revision' | 'validado';
export type ActivityType = 'start' | 'action' | 'decision' | 'end';
export type ItemEvidenceStatus = 'confirmed' | 'inferred' | 'pending_validation' | 'user_modified';
export type QuestionCriticality = 'critica' | 'importante' | 'complementaria';

export interface ProcessActivity {
  id: string;
  stepNumber: number;
  name: string;
  description: string;
  role: string;
  system?: string;
  type: ActivityType;
  conditionLabel?: string;
  exceptions?: string;
  sourceQuote?: string; // Cita textual literal de la fuente
  sourceTimestamp?: string; // Minuto/segundo o párrafo de origen
  status?: ItemEvidenceStatus; // Estado de evidencia en la fuente
  verifiedByHuman?: boolean; // Confirmado o editado por el usuario
}

export interface ProcessConnection {
  from: string;
  to: string;
  label?: string;
  status?: 'confirmed' | 'inferred' | 'pending';
}

export interface ValidationQuestion {
  id: string;
  question: string;
  reason: string;
  criticality: QuestionCriticality; // Nivel de criticidad
  relatedActivityId?: string;
  originalQuote?: string;
  status: 'pending' | 'answered' | 'not_applicable' | 'accepted_pending';
  userAnswer?: string;
  answeredAt?: string;
  justification?: string;
}

export interface ImprovementFinding {
  id: string;
  type: 'pain_point' | 'opportunity';
  relatedActivityId?: string;
  title: string;
  description: string;
  evidence: string;
  impact: string;
  proposal: string;
  priority: 'alta' | 'media' | 'baja';
  status: 'detectado' | 'en_analisis' | 'descartado' | 'aprobado';
  isManual?: boolean;
}

export interface ProcessRevision {
  version: string;
  date: string;
  author: string;
  description: string;
  snapshotData?: any; // Instantánea recuperable del modelo
}

export interface ProcessModel {
  id: string;
  surveyId: string;
  clientId: string;
  ownerId: string;
  code: string;
  name: string;
  docType: DocType;
  status: ProcessStatus;
  version: string;
  classificationReason?: string;
  relatedUnits?: string[];
  objective: string;
  scope: string;
  trigger: string;
  result: string;
  inputs: string[];
  outputs: string[];
  roles: string[];
  systems: string[];
  activities: ProcessActivity[];
  connections: ProcessConnection[];
  validationQuestions: ValidationQuestion[];
  privateImprovements: ImprovementFinding[];
  procedureNarrative?: string; // Redacción narrativa formal y completa del procedimiento ISO 9001
  history: ProcessRevision[];
  transcriptText?: string; // Fragmento de transcripción de referencia para trazabilidad
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: string;
  ownerId: string;
  name: string;
  code: string;
  sector?: string;
  isoStandard: string;
  templateFileName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Survey {
  id: string;
  clientId: string;
  ownerId: string;
  title: string;
  transcriptText: string;
  audioFileName?: string;
  status: 'draft' | 'analyzed' | 'in_progress' | 'completed';
  interviewSummary?: string;
  identifiedUnitCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessGraphIssue {
  type: 'dangling_decision' | 'isolated_node' | 'invalid_connection' | 'open_path' | 'missing_role';
  severity: 'error' | 'warning';
  activityId?: string;
  message: string;
}

export interface ProcessGraphValidation {
  isValid: boolean;
  canValidate: boolean; // Si puede pasar a estado 'validado'
  issues: ProcessGraphIssue[];
}

export interface ProcessPatchItem {
  elementId?: string;
  field: string;
  previousValue?: any;
  newValue: any;
  reason: string;
  evidence?: string;
}

export interface ProcessPatchResult {
  updatedProcess: ProcessModel;
  appliedPatches: ProcessPatchItem[];
}
