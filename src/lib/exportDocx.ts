import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  HeadingLevel,
  AlignmentType,
} from 'docx';
import { ProcessModel, Client } from '../types/process';

export async function generateDocxBlob(process: ProcessModel, client?: Client): Promise<Blob> {
  // CRITICAL PRIVACY PURGE: Guarantee NO private improvement finding or hypothesis is leaked
  // We ensure the data passed into document sections strictly references official AS-IS operations
  const isDraft = process.status !== 'validado';
  const currentDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const docTitle = process.name;
  const docCode = process.code || 'PR-01';
  const docTypeLabel =
    process.docType === 'proceso'
      ? 'PROCESO'
      : process.docType === 'instructivo'
      ? 'INSTRUCTIVO DE TRABAJO'
      : 'PROCEDIMIENTO OPERATIVO';

  const clientName = client?.name || 'EMPRESA CLIENTE';
  const isoNorm = client?.isoStandard || 'ISO 9001:2026';

  const children: any[] = [];

  // Header / Identification Table
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: clientName.toUpperCase(), bold: true, size: 22, color: '1e3a8a' }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `Ref: ${isoNorm}`, size: 16, color: '64748b' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: docTypeLabel, bold: true, size: 20, color: '0f172a' }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({ text: docTitle, bold: true, size: 26, color: '1e3a8a' }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `Código: `, bold: true, size: 18 }),
                    new TextRun({ text: docCode, size: 18 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `Versión: `, bold: true, size: 18 }),
                    new TextRun({ text: process.version || '1.0', size: 18 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `Fecha: `, bold: true, size: 18 }),
                    new TextRun({ text: currentDate, size: 18 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: `Estado: `, bold: true, size: 18 }),
                    new TextRun({
                      text: process.status.toUpperCase(),
                      bold: true,
                      size: 18,
                      color: isDraft ? 'b91c1c' : '15803d',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  // Watermark warning if draft
  if (isDraft) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 250 },
        children: [
          new TextRun({
            text: '⚠ DOCUMENTO EN ESTADO BORRADOR — PENDIENTE DE VALIDACIÓN OPERATIVA DEFINITIVA ⚠',
            bold: true,
            color: 'dc2626',
            size: 20,
          }),
        ],
      })
    );
  }

  // Section 1: Objeto y Alcance
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: '1. Objeto y Alcance', bold: true, size: 24, color: '1e3a8a' })],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: '1.1 Objetivo: ', bold: true, size: 20 }),
        new TextRun({ text: process.objective || 'Definir la secuencia operativa actual del proceso.', size: 20 }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: '1.2 Alcance: ', bold: true, size: 20 }),
        new TextRun({ text: process.scope || 'Aplica a todas las actividades operativas descritas a continuación.', size: 20 }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: '1.3 Evento Disparador: ', bold: true, size: 20 }),
        new TextRun({ text: process.trigger || 'Inicio de la actividad operativa.', size: 20 }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun({ text: '1.4 Resultado Esperado: ', bold: true, size: 20 }),
        new TextRun({ text: process.result || 'Entrega conforme del resultado del proceso.', size: 20 }),
      ],
    })
  );

  // Section 2: Roles y Responsabilidades
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: '2. Roles y Responsabilidades', bold: true, size: 24, color: '1e3a8a' })],
    })
  );

  const roles = process.roles?.length
    ? process.roles
    : Array.from(new Set(process.activities.map((a) => a.role).filter(Boolean)));

  if (roles.length > 0) {
    roles.forEach((role) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: role, bold: true, size: 20 })],
        })
      );
    });
  } else {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Roles identificados según desarrollo de actividades.', size: 20 })],
      })
    );
  }

  // Section 3: Entradas y Sistemas
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: '3. Elementos de Entrada y Sistemas', bold: true, size: 24, color: '1e3a8a' })],
    })
  );

  if (process.inputs?.length) {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: 'Entradas del proceso: ', bold: true, size: 20 })],
      })
    );
    process.inputs.forEach((inp) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: inp, size: 20 })],
        })
      );
    });
  }

  if (process.systems?.length) {
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 80 },
        children: [new TextRun({ text: 'Sistemas y Herramientas utilizadas: ', bold: true, size: 20 })],
      })
    );
    process.systems.forEach((sys) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: sys, size: 20 })],
        })
      );
    });
  }

  // Section 4: Desarrollo del Proceso AS-IS (Tabla de Actividades)
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: '4. Desarrollo de Actividades (Procedimiento Operativo AS-IS)',
          bold: true,
          size: 24,
          color: '1e3a8a',
        }),
      ],
    })
  );

  // Table Header
  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Paso', bold: true, size: 18 })] })],
        }),
        new TableCell({
          width: { size: 24, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Actividad', bold: true, size: 18 })] })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Responsable', bold: true, size: 18 })] })],
        }),
        new TableCell({
          width: { size: 14, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Sistema', bold: true, size: 18 })] })],
        }),
        new TableCell({
          width: { size: 34, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Descripción Operativa', bold: true, size: 18 })] })],
        }),
      ],
    }),
  ];

  process.activities.forEach((act) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: `${act.stepNumber || ''}`, bold: true, size: 18 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 24, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: act.name,
                    bold: act.type === 'decision',
                    color: act.type === 'decision' ? 'b45309' : '0f172a',
                    size: 18,
                  }),
                ],
              }),
              ...(act.type === 'decision'
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '[Punto de Decisión / Control]',
                          size: 16,
                          italics: true,
                          color: 'b45309',
                        }),
                      ],
                    }),
                  ]
                : []),
            ],
          }),
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: act.role || 'Pendiente de definir',
                    bold: true,
                    color: act.role === 'Pendiente de definir' ? 'dc2626' : '1e3a8a',
                    size: 18,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: act.system || '—', size: 18, color: '475569' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 34, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: act.description, size: 18 })],
              }),
              ...(act.exceptions
                ? [
                    new Paragraph({
                      spacing: { before: 60 },
                      children: [
                        new TextRun({ text: 'Excepción: ', bold: true, color: 'b91c1c', size: 16 }),
                        new TextRun({ text: act.exceptions, italics: true, color: 'b91c1c', size: 16 }),
                      ],
                    }),
                  ]
                : []),
            ],
          }),
        ],
      })
    );
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    })
  );

  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  // Section 5: Salidas y Registros
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text: '5. Salidas y Evidencias Documentadas', bold: true, size: 24, color: '1e3a8a' })],
    })
  );

  if (process.outputs?.length) {
    process.outputs.forEach((out) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: out, size: 20 })],
        })
      );
    });
  } else {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'Registros generados según ejecución de actividades.', size: 20 })],
      })
    );
  }

  // Section 6: Control de Revisiones
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 250, after: 100 },
      children: [new TextRun({ text: '6. Control de Cambios y Revisiones', bold: true, size: 24, color: '1e3a8a' })],
    })
  );

  const historyRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Versión', bold: true, size: 18 })] })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Fecha', bold: true, size: 18 })] })],
        }),
        new TableCell({
          width: { size: 65, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Descripción del Cambio', bold: true, size: 18 })] })],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: process.version || '1.0', size: 18 })] })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: currentDate, size: 18 })] })],
        }),
        new TableCell({
          width: { size: 65, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Emisión inicial documentada a partir de relevamiento de procesos.',
                  size: 18,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: historyRows,
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
