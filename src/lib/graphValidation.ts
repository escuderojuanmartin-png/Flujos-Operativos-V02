import { ProcessModel, ProcessGraphValidation, ProcessGraphIssue } from '../types/process';

/**
 * Validates the operational process graph and business rules before approval
 * Ensures NO fictitious data or broken graphs can be marked as validated.
 */
export function validateProcessGraph(process: ProcessModel): ProcessGraphValidation {
  const issues: ProcessGraphIssue[] = [];

  const activities = process.activities || [];
  const connections = process.connections || [];
  const questions = process.validationQuestions || [];

  const actIds = new Set<string>();
  const incomingCount: Record<string, number> = {};
  const outgoingCount: Record<string, number> = {};

  // 1. Verify Activity Identifiers & Duplicates
  activities.forEach((act) => {
    if (actIds.has(act.id)) {
      issues.push({
        type: 'invalid_connection',
        severity: 'error',
        activityId: act.id,
        message: `Identificador duplicado detectado: ${act.id}`,
      });
    }
    actIds.add(act.id);
    incomingCount[act.id] = 0;
    outgoingCount[act.id] = 0;

    if (!act.name || !act.name.trim()) {
      issues.push({
        type: 'isolated_node',
        severity: 'error',
        activityId: act.id,
        message: `El paso #${act.stepNumber} no tiene nombre definido.`,
      });
    }

    if (!act.role || act.role === 'Pendiente de definir') {
      issues.push({
        type: 'missing_role',
        severity: 'warning',
        activityId: act.id,
        message: `El paso #${act.stepNumber} ("${act.name}") no tiene responsable confirmado.`,
      });
    }
  });

  // 2. Verify Connections
  connections.forEach((conn, idx) => {
    if (!actIds.has(conn.from)) {
      issues.push({
        type: 'invalid_connection',
        severity: 'error',
        message: `Conexión #${idx + 1} apunta desde una actividad inexistente: "${conn.from}".`,
      });
    } else {
      outgoingCount[conn.from] = (outgoingCount[conn.from] || 0) + 1;
    }

    if (!actIds.has(conn.to)) {
      issues.push({
        type: 'invalid_connection',
        severity: 'error',
        message: `Conexión #${idx + 1} apunta hacia una actividad inexistente: "${conn.to}".`,
      });
    } else {
      incomingCount[conn.to] = (incomingCount[conn.to] || 0) + 1;
    }
  });

  // 3. Verify Decisions (Must have at least 2 outgoing branches for meaningful decision)
  activities.forEach((act) => {
    if (act.type === 'decision') {
      const out = outgoingCount[act.id] || 0;
      if (out === 0) {
        issues.push({
          type: 'dangling_decision',
          severity: 'error',
          activityId: act.id,
          message: `La decisión "${act.name}" no tiene caminos de salida definidos en la fuente.`,
        });
      } else if (out === 1) {
        issues.push({
          type: 'dangling_decision',
          severity: 'warning',
          activityId: act.id,
          message: `La decisión "${act.name}" solo tiene una rama de salida identificada. Falta documentar la alternativa.`,
        });
      }
    } else if (act.type === 'action') {
      const out = outgoingCount[act.id] || 0;
      const inc = incomingCount[act.id] || 0;
      if (inc === 0 && out === 0 && activities.length > 1) {
        issues.push({
          type: 'isolated_node',
          severity: 'warning',
          activityId: act.id,
          message: `La actividad "${act.name}" está aislada (sin conexiones de entrada ni salida).`,
        });
      }
    }
  });

  // 4. Critical Questions Check
  const pendingCriticalQuestions = questions.filter(
    (q) => q.status === 'pending' && q.criticality === 'critica'
  );

  if (pendingCriticalQuestions.length > 0) {
    issues.push({
      type: 'open_path',
      severity: 'error',
      message: `Existen ${pendingCriticalQuestions.length} pregunta(s) crítica(s) pendientes de resolución que impiden validar formalmente el proceso.`,
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  const isValid = issues.length === 0;
  const canValidate = !hasErrors;

  return {
    isValid,
    canValidate,
    issues,
  };
}
