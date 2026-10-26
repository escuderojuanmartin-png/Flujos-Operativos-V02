export type DocType = 'proceso' | 'procedimiento' | 'instructivo';
export type ProcessStatus = 'borrador' | 'pendiente_informacion' | 'en_revision' | 'validado';
export type ActivityType = 'start' | 'action' | 'decision' | 'end';

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
}

export interface ProcessConnection {
  from: string;
  to: string;
  label?: string;
}

export interface ValidationQuestion {
  id: string;
  question: string;
  reason: string;
  relatedActivityId?: string;
  originalQuote?: string;
  status: 'pending' | 'answered' | 'not_applicable';
  userAnswer?: string;
  answeredAt?: string;
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
  history: ProcessRevision[];
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
  createdAt: string;
  updatedAt: string;
}
