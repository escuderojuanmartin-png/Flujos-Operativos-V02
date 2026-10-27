import { jsPDF } from 'jspdf';
import { ProcessModel, Client } from '../types/process';
import { buildOfficialDocumentModel } from './officialDocumentModel';

export function generatePdfBlob(process: ProcessModel, client?: Client): Blob {
  const official = buildOfficialDocumentModel(process, client);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  // Header Box
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentWidth, 24);

  // Left column: Client & standard reference
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 58, 138);
  doc.text(official.clientName.toUpperCase(), margin + 4, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Ref. Calidad: ${official.isoStandard}`, margin + 4, y + 13);
  doc.text(`Fecha: ${official.date}`, margin + 4, y + 18);

  // Center column: Document title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  const truncatedTitle =
    official.title.length > 38 ? official.title.substring(0, 36) + '...' : official.title;
  doc.text(truncatedTitle, margin + 46, y + 10);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(official.docTypeLabel, margin + 46, y + 16);

  // Right column: Code, Version & Status
  doc.line(pageWidth - margin - 44, y, pageWidth - margin - 44, y + 24);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Código: ${official.code}`, pageWidth - margin - 40, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(`Versión: ${official.version}`, pageWidth - margin - 40, y + 13);

  if (official.isDraft) {
    doc.setTextColor(220, 38, 38);
    doc.setFont('helvetica', 'bold');
    doc.text('BORRADOR', pageWidth - margin - 40, y + 19);
  } else {
    doc.setTextColor(22, 163, 74);
    doc.setFont('helvetica', 'bold');
    doc.text('VALIDADO AS-IS', pageWidth - margin - 40, y + 19);
  }

  y += 29;

  // Draft Banner if applicable
  if (official.isDraft) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(248, 113, 113);
    doc.rect(margin, y, contentWidth, 7, 'FD');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28);
    doc.text(
      'DOCUMENTO EN ESTADO BORRADOR — PENDIENTE DE VALIDACIÓN OPERATIVA DEFINITIVA',
      margin + 6,
      y + 4.8
    );
    y += 11;
  }

  // 1. Objeto y Alcance
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 58, 138);
  doc.text('1. OBJETO Y ALCANCE', margin, y);
  y += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  const objLines = doc.splitTextToSize(`Objetivo: ${official.objective}`, contentWidth);
  doc.text(objLines, margin, y);
  y += objLines.length * 4;

  const scopeLines = doc.splitTextToSize(`Alcance: ${official.scope}`, contentWidth);
  doc.text(scopeLines, margin, y);
  y += scopeLines.length * 4;

  const trigLines = doc.splitTextToSize(
    `Disparador: ${official.trigger}  |  Resultado esperado: ${official.result}`,
    contentWidth
  );
  doc.text(trigLines, margin, y);
  y += trigLines.length * 4 + 3;

  // 2. Roles y Sistemas
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 58, 138);
  doc.text('2. ROLES Y SISTEMAS INVOLUCRADOS', margin, y);
  y += 4.5;

  const rolesText = official.roles.length ? official.roles.join(', ') : 'Pendientes de confirmar';
  const sysText = official.systems.length ? official.systems.join(', ') : 'Ninguno especificado';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text(`Roles responsables: ${rolesText}`, margin, y);
  y += 4;
  doc.text(`Sistemas y herramientas: ${sysText}`, margin, y);
  y += 7;

  // 3. Tabla de Actividades AS-IS
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 58, 138);
  doc.text('3. DESARROLLO DEL PROCEDIMIENTO OPERATIVO (AS-IS)', margin, y);
  y += 4.5;

  // Table header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6.5, 'F');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);

  doc.text('#', margin + 2, y + 4.5);
  doc.text('Actividad', margin + 10, y + 4.5);
  doc.text('Responsable', margin + 60, y + 4.5);
  doc.text('Sistema', margin + 100, y + 4.5);
  doc.text('Descripción Operativa', margin + 124, y + 4.5);
  y += 7.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  official.activities.forEach((act) => {
    // Check if new page is needed
    if (y > pageHeight - 25) {
      doc.addPage();
      y = margin;
      doc.setFillColor(241, 245, 249);
      doc.rect(margin, y, contentWidth, 6.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.text('#', margin + 2, y + 4.5);
      doc.text('Actividad', margin + 10, y + 4.5);
      doc.text('Responsable', margin + 60, y + 4.5);
      doc.text('Sistema', margin + 100, y + 4.5);
      doc.text('Descripción Operativa', margin + 124, y + 4.5);
      y += 7.5;
      doc.setFont('helvetica', 'normal');
    }

    const descLines = doc.splitTextToSize(act.description, 48);
    const rowHeight = Math.max(7, descLines.length * 3.5 + (act.exceptions ? 3.5 : 0));

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowHeight - 0.5, margin + contentWidth, y + rowHeight - 0.5);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(String(act.stepNumber), margin + 2, y + 3.5);

    const nameLines = doc.splitTextToSize(act.name, 46);
    doc.text(nameLines, margin + 10, y + 3.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 99, 235);
    doc.text(act.role, margin + 60, y + 3.5);

    doc.setTextColor(100, 116, 139);
    doc.text(act.system, margin + 100, y + 3.5);

    doc.setTextColor(15, 23, 42);
    doc.text(descLines, margin + 124, y + 3.5);

    if (act.exceptions) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(185, 28, 28);
      doc.text(`Excepción: ${act.exceptions}`, margin + 124, y + 3.5 + descLines.length * 3.2);
    }

    y += rowHeight + 1.5;
  });

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Process AI | ${official.clientName} | ${official.code} v${official.version} | Pág. ${i} de ${totalPages} | Documento estructurado según buenas prácticas de control documental`,
      margin,
      pageHeight - 8
    );
  }

  return doc.output('blob');
}
