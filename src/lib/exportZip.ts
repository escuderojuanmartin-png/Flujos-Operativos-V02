import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ProcessModel, Client } from '../types/process';
import { generateDocxBlob } from './exportDocx';
import { generatePdfBlob } from './exportPdf';
import { generateDrawioXml } from './exportDrawio';
import { buildOfficialDocumentModel } from './officialDocumentModel';

export async function exportProcessZip(process: ProcessModel, client?: Client): Promise<void> {
  const official = buildOfficialDocumentModel(process, client);
  const zip = new JSZip();
  const baseName = `${official.code}_${official.title.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;

  // 1. DOCX
  const docxBlob = await generateDocxBlob(process, client);
  zip.file(`${baseName}.docx`, docxBlob);

  // 2. PDF
  const pdfBlob = generatePdfBlob(process, client);
  zip.file(`${baseName}.pdf`, pdfBlob);

  // 3. DRAW.IO XML
  const drawioXml = generateDrawioXml(process);
  zip.file(`${baseName}.drawio`, drawioXml);

  // 4. Markdown Specification based STRICTLY on official document model
  const mdSummary = `# ${official.title}
**Código:** ${official.code}  
**Tipo Documental:** ${official.docTypeLabel}  
**Versión:** ${official.version}  
**Estado:** ${official.status}  
**Norma de Referencia:** ${official.isoStandard}  
**Empresa Cliente:** ${official.clientName}  

## 1. Objeto y Alcance
- **Objetivo:** ${official.objective}
- **Alcance:** ${official.scope}
- **Disparador:** ${official.trigger}
- **Resultado:** ${official.result}

## 2. Roles y Sistemas Involucrados
- **Roles:** ${official.roles.join(', ') || 'Pendientes de confirmar'}
- **Sistemas:** ${official.systems.join(', ') || 'Ninguno especificado'}

## 3. Desarrollo de Actividades (AS-IS)
${official.activities
  .map(
    (a) =>
      `### ${a.stepNumber}. ${a.name} [${a.type.toUpperCase()}]
- **Responsable:** ${a.role}
- **Sistema:** ${a.system}
- **Descripción:** ${a.description}
${a.exceptions ? `- **Excepción:** ${a.exceptions}` : ''}`
  )
  .join('\n\n')}

---
*Documento estructurado utilizando buenas prácticas de gestión por procesos y control de información documentada (Ref. ISO 9001:2026).*
`;
  zip.file(`${baseName}_especificacion_oficial.md`, mdSummary);

  const zipContent = await zip.generateAsync({ type: 'blob' });
  saveAs(zipContent, `${baseName}_entregables.zip`);
}
