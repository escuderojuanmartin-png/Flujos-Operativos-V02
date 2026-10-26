import { jsPDF } from 'jspdf';
import { ProcessModel, Client } from '../types/process';

export function generatePdfBlob(process: ProcessModel, client?: Client): Blob {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  const clientName = client?.name || 'EMPRESA CLIENTE';
  const isoNorm = client?.isoStandard || 'ISO 9001:2026';
  const isDraft = process.status !== 'validado';
  const currentDate = new Date().toLocaleDateString('es-ES');

  // Header Box
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentWidth, 26);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138); // dark blue
  doc.text(clientName.toUpperCase(), margin + 4, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Norma: ${isoNorm}`, margin + 4, y + 14);
  doc.text(`Fecha: ${currentDate}`, margin + 4, y + 19);

  // Center Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  const titleText = process.name.length > 40 ? process.name.substring(0, 38) + '...' : process.name;
  doc.text(titleText, margin + 50, y + 12);

  const docTypeStr =
    process.docType === 'proceso'
      ? 'DOCUMENTO DE PROCESO'
      : process.docType === 'instructivo'
      ? 'INSTRUCTIVO TÉCNICO'
      : 'PROCEDIMIENTO OPERATIVO';
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(docTypeStr, margin + 50, y + 18);

  // Right Box: Code, Version, Status
  doc.line(pageWidth - margin - 45, y, pageWidth - margin - 45, y + 26);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Código: ${process.code || 'PR-01'}`, pageWidth - margin - 42, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Versión: ${process.version || '1.0'}`, pageWidth - margin - 42, y + 14);

  if (isDraft) {
    doc.setTextColor(220, 38, 38); // red
    doc.setFont('helvetica', 'bold');
    doc.text('BORRADOR', pageWidth - margin - 42, y + 20);
  } else {
    doc.setTextColor(22, 163, 74); // green
    doc.setFont('helvetica', 'bold');
    doc.text('VALIDADO', pageWidth - margin - 42, y + 20);
  }

  y += 32;

  // Draft Banner if applicable
  if (isDraft) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(248, 113, 113);
    doc.rect(margin, y, contentWidth, 8, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text(
      'DOCUMENTO EN ESTADO BORRADOR — PENDIENTE DE VALIDACIÓN OPERATIVA DEFINITIVA',
      margin + 8,
      y + 5.5
    );
    y += 12;
  }

  // 1. Objeto y Alcance
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text('1. OBJETO Y ALCANCE', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  const objLines = doc.splitTextToSize(`Objetivo: ${process.objective || 'Definir la secuencia operativa actual.'}`, contentWidth);
  doc.text(objLines, margin, y);
  y += objLines.length * 4.5;

  const scopeLines = doc.splitTextToSize(`Alcance: ${process.scope || 'Aplica a las actividades descritas.'}`, contentWidth);
  doc.text(scopeLines, margin, y);
  y += scopeLines.length * 4.5;

  const triggerLines = doc.splitTextToSize(`Disparador: ${process.trigger || 'Inicio de la actividad'} | Resultado: ${process.result || 'Entrega del resultado'}`, contentWidth);
  doc.text(triggerLines, margin, y);
  y += triggerLines.length * 4.5 + 4;

  // 2. Roles y Sistemas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text('2. ROLES Y SISTEMAS INVOLUCRADOS', margin, y);
  y += 5;

  const roles = process.roles?.length
    ? process.roles.join(', ')
    : Array.from(new Set(process.activities.map((a) => a.role).filter(Boolean))).join(', ');
  const systems = process.systems?.length ? process.systems.join(', ') : 'Ninguno especificado';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Roles responsables: ${roles || 'Pendientes de definir'}`, margin, y);
  y += 4.5;
  doc.text(`Sistemas / Software: ${systems}`, margin, y);
  y += 8;

  // 3. Tabla de Actividades AS-IS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text('3. DESARROLLO DEL PROCEDIMIENTO OPERATIVO (AS-IS)', margin, y);
  y += 5;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);

  doc.text('#', margin + 2, y + 5);
  doc.text('Actividad', margin + 12, y + 5);
  doc.text('Responsable', margin + 65, y + 5);
  doc.text('Sistema', margin + 105, y + 5);
  doc.text('Descripción Operativa', margin + 130, y + 5);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  process.activities.forEach((act) => {
    // Check if new page is needed
    if (y > pageHeight - 25) {
      doc.addPage();
      y = margin;
      // Repeat small header
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('#', margin + 2, y + 5);
      doc.text('Actividad', margin + 12, y + 5);
      doc.text('Responsable', margin + 65, y + 5);
      doc.text('Sistema', margin + 105, y + 5);
      doc.text('Descripción Operativa', margin + 130, y + 5);
      y += 8;
      doc.setFont('helvetica', 'normal');
    }

    const descLines = doc.splitTextToSize(act.description || '', 42);
    const rowHeight = Math.max(8, descLines.length * 3.8 + (act.exceptions ? 4 : 0));

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowHeight - 1, margin + contentWidth, y + rowHeight - 1);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`${act.stepNumber || ''}`, margin + 2, y + 4);

    const actNameLines = doc.splitTextToSize(act.name, 48);
    doc.text(actNameLines, margin + 12, y + 4);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 99, 235); // blue for role
    doc.text(act.role || 'Pendiente', margin + 65, y + 4);

    doc.setTextColor(100, 116, 139);
    doc.text(act.system || '—', margin + 105, y + 4);

    doc.setTextColor(15, 23, 42);
    doc.text(descLines, margin + 130, y + 4);

    if (act.exceptions) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(185, 28, 28);
      doc.text(`Excepción: ${act.exceptions}`, margin + 130, y + 4 + descLines.length * 3.5);
    }

    y += rowHeight + 2;
  });

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Process AI — Documentación de Procesos | ${clientName} | ${process.code || 'PR-01'} | Página ${i} de ${totalPages}`,
      margin,
      pageHeight - 8
    );
  }

  return doc.output('blob');
}
