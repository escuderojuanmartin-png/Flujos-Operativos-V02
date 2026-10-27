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
import { buildOfficialDocumentModel } from './officialDocumentModel';

export async function generateDocxBlob(process: ProcessModel, client?: Client): Promise<Blob> {
  // Use the standardized OfficialDocumentModel to strictly decouple official deliverables from private consultative findings
  const official = buildOfficialDocumentModel(process, client);

  const children: any[] = [];

  // Header / Document Control Box
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
                    new TextRun({
                      text: official.clientName.toUpperCase(),
                      bold: true,
                      size: 20,
                      color: '1e3a8a',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Ref. Calidad: ${official.isoStandard}`,
                      size: 15,
                      color: '64748b',
                    }),
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
                    new TextRun({
                      text: official.docTypeLabel,
                      bold: true,
                      size: 18,
                      color: '0f172a',
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: official.title,
                      bold: true,
                      size: 24,
                      color: '1e3a8a',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Código: ', bold: true, size: 17 }),
                    new TextRun({ text: official.code, size: 17 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Versión: ', bold: true, size: 17 }),
                    new TextRun({ text: official.version, size: 17 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Fecha: ', bold: true, size: 17 }),
                    new TextRun({ text: official.date, size: 17 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({ text: 'Estado: ', bold: true, size: 17 }),
                    new TextRun({
                      text: official.isDraft ? 'BORRADOR' : 'VALIDADO',
                      bold: true,
                      size: 17,
                      color: official.isDraft ? 'dc2626' : '16a34a',
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

  children.push(new Paragraph({ text: '', spacing: { after: 150 } }));

  // Clear Borrador Banner if draft
  if (official.isDraft) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 200 },
        children: [
          new TextRun({
            text: '⚠ DOCUMENTO EN ESTADO: BORRADOR — PENDIENTE DE VALIDACIÓN OPERATIVA DEFINITIVA ⚠',
            bold: true,
            color: 'dc2626',
            size: 18,
          }),
        ],
      })
    );
  }

  // 1. Objeto y Alcance
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 180, after: 100 },
      children: [
        new TextRun({ text: '1. Objeto y Alcance del Documento', bold: true, size: 22, color: '1e3a8a' }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: '1.1 Objetivo: ', bold: true, size: 19 }),
        new TextRun({ text: official.objective, size: 19 }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: '1.2 Alcance: ', bold: true, size: 19 }),
        new TextRun({ text: official.scope, size: 19 }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: '1.3 Evento Disparador: ', bold: true, size: 19 }),
        new TextRun({ text: official.trigger, size: 19 }),
      ],
    })
  );

  children.push(
    new Paragraph({
      spacing: { after: 180 },
      children: [
        new TextRun({ text: '1.4 Resultado Esperado: ', bold: true, size: 19 }),
        new TextRun({ text: official.result, size: 19 }),
      ],
    })
  );

  // 2. Roles y Sistemas
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 180, after: 100 },
      children: [
        new TextRun({ text: '2. Roles, Responsabilidades y Sistemas', bold: true, size: 22, color: '1e3a8a' }),
      ],
    })
  );

  if (official.roles.length > 0) {
    official.roles.forEach((role) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: role, bold: true, size: 19 })],
        })
      );
    });
  } else {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'Roles pendientes de confirmación según el desarrollo de las actividades.',
            size: 19,
            color: '64748b',
          }),
        ],
      })
    );
  }

  if (official.systems.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 80 },
        children: [
          new TextRun({ text: 'Sistemas informáticos y herramientas involucradas: ', bold: true, size: 19 }),
        ],
      })
    );
    official.systems.forEach((sys) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: sys, size: 19 })],
        })
      );
    });
  }

  // 3. Procedimiento Operativo AS-IS
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: '3. Desarrollo de Actividades (Secuencia Operativa AS-IS)',
          bold: true,
          size: 22,
          color: '1e3a8a',
        }),
      ],
    })
  );

  // Table of Activities
  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Paso', bold: true, size: 17 })] })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Actividad', bold: true, size: 17 })] })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Responsable', bold: true, size: 17 })] })],
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Sistema', bold: true, size: 17 })] })],
        }),
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({ children: [new TextRun({ text: 'Descripción Operativa Fiel', bold: true, size: 17 })] }),
          ],
        }),
      ],
    }),
  ];

  official.activities.forEach((act) => {
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 8, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: String(act.stepNumber), bold: true, size: 17 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: act.name,
                    bold: act.type === 'decision',
                    color: act.type === 'decision' ? 'b45309' : '0f172a',
                    size: 17,
                  }),
                ],
              }),
              ...(act.type === 'decision'
                ? [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '[Punto de Decisión / Control]',
                          size: 15,
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
                    text: act.role,
                    bold: true,
                    color: act.role === 'Pendiente de definir' ? 'dc2626' : '1e3a8a',
                    size: 17,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: act.system, size: 17, color: '475569' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: act.description, size: 17 })],
              }),
              ...(act.exceptions
                ? [
                    new Paragraph({
                      spacing: { before: 50 },
                      children: [
                        new TextRun({ text: 'Excepción documentada: ', bold: true, color: 'b91c1c', size: 15 }),
                        new TextRun({ text: act.exceptions, italics: true, color: 'b91c1c', size: 15 }),
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

  children.push(new Paragraph({ text: '', spacing: { after: 180 } }));

  // 4. Salidas y Evidencias
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 180, after: 100 },
      children: [
        new TextRun({
          text: '4. Entradas, Salidas y Registros del Proceso',
          bold: true,
          size: 22,
          color: '1e3a8a',
        }),
      ],
    })
  );

  if (official.inputs.length > 0) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: 'Entradas identificadas: ', bold: true, size: 19 })],
      })
    );
    official.inputs.forEach((inp) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: inp, size: 19 })],
        })
      );
    });
  }

  if (official.outputs.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 80, after: 60 },
        children: [new TextRun({ text: 'Salidas y entregables conforme: ', bold: true, size: 19 })],
      })
    );
    official.outputs.forEach((out) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: out, size: 19 })],
        })
      );
    });
  }

  // 5. Historial de Revisiones
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({ text: '5. Control de Cambios y Revisiones', bold: true, size: 22, color: '1e3a8a' }),
      ],
    })
  );

  const historyRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 15, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Versión', bold: true, size: 17 })] })],
        }),
        new TableCell({
          width: { size: 22, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Fecha', bold: true, size: 17 })] })],
        }),
        new TableCell({
          width: { size: 63, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: 'Descripción del Cambio', bold: true, size: 17 })] })],
        }),
      ],
    }),
  ];

  official.revisionHistory.forEach((h) => {
    historyRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: h.version, size: 17 })] })],
          }),
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: h.date, size: 17 })] })],
          }),
          new TableCell({
            width: { size: 63, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ children: [new TextRun({ text: h.description, size: 17 })] })],
          }),
        ],
      })
    );
  });

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
