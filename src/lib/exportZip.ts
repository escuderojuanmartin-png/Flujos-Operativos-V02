import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ProcessModel, Client } from '../types/process';
import { generateDocxBlob } from './exportDocx';
import { generatePdfBlob } from './exportPdf';
import { generateDrawioXml } from './exportDrawio';

export async function exportProcessZip(process: ProcessModel, client?: Client): Promise<void> {
  const zip = new JSZip();
  const baseName = `${process.code || 'PROCESO'}_${process.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;

  // 1. DOCX
  const docxBlob = await generateDocxBlob(process, client);
  zip.file(`${baseName}.docx`, docxBlob);

  // 2. PDF
  const pdfBlob = generatePdfBlob(process, client);
  zip.file(`${baseName}.pdf`, pdfBlob);

  // 3. DRAW.IO XML
  const drawioXml = generateDrawioXml(process);
  zip.file(`${baseName}.drawio`, drawioXml);

  // 4. Markdown Specification
  const mdSummary = `# ${process.name}
**Código:** ${process.code || 'PR-01'}  
**Tipo Documental:** ${process.docType}  
**Versión:** ${process.version || '1.0'}  
**Estado:** ${process.status}  
**Norma de Referencia:** ${client?.isoStandard || 'ISO 9001:2026'}  

## 1. Objeto y Alcance
- **Objetivo:** ${process.objective}
- **Alcance:** ${process.scope}
- **Disparador:** ${process.trigger}
- **Resultado:** ${process.result}

## 2. Roles y Sistemas
- **Roles:** ${(process.roles || []).join(', ')}
- **Sistemas:** ${(process.systems || []).join(', ')}

## 3. Procedimiento Operativo AS-IS
${process.activities
  .map(
    (a) =>
      `### ${a.stepNumber}. ${a.name} [${a.type.toUpperCase()}]
- **Responsable:** ${a.role}
- **Sistema:** ${a.system || 'N/A'}
- **Descripción:** ${a.description}
${a.exceptions ? `- **Excepción:** ${a.exceptions}` : ''}`
  )
  .join('\n\n')}

---
*Generado por Process AI — Documentación ISO 9001*
`;
  zip.file(`${baseName}_especificacion.md`, mdSummary);

  const zipContent = await zip.generateAsync({ type: 'blob' });
  saveAs(zipContent, `${baseName}_entregables.zip`);
}
