import { ProcessModel } from '../types/process';

export function generateDrawioXml(process: ProcessModel): string {
  const dateIso = new Date().toISOString();
  const diagramId = `diag_${process.id || 'proc'}`;

  let cellsXml = '';
  // Default cell 0 and 1
  cellsXml += `      <mxCell id="0" />\n`;
  cellsXml += `      <mxCell id="1" parent="0" />\n`;

  // Calculate layout coordinates
  const nodeMap = new Map<string, { x: number; y: number; width: number; height: number }>();
  let currentY = 60;
  const startX = 350;

  process.activities.forEach((act, idx) => {
    let width = 220;
    let height = 80;
    let style = '';

    if (act.type === 'start') {
      width = 160;
      height = 60;
      style = 'ellipse;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;strokeWidth=2;fontStyle=1;fontSize=13;fontColor=#1e293b;';
    } else if (act.type === 'end') {
      width = 160;
      height = 60;
      style = 'ellipse;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;strokeWidth=2;fontStyle=1;fontSize=13;fontColor=#1e293b;';
    } else if (act.type === 'decision') {
      width = 190;
      height = 100;
      style = 'rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;strokeWidth=2;fontStyle=1;fontSize=12;fontColor=#1e293b;';
    } else {
      // standard action
      width = 240;
      height = 85;
      style = 'rounded=1;whiteSpace=wrap;html=1;fillColor=#f8fafc;strokeColor=#94a3b8;strokeWidth=2;arcSize=8;fontSize=12;fontColor=#0f172a;';
    }

    const x = startX - (width / 2);
    const y = currentY;
    nodeMap.set(act.id, { x, y, width, height });

    let label = '';
    if (act.type === 'start') {
      label = `&lt;b&gt;INICIO&lt;/b&gt;&lt;br/&gt;${escapeXml(act.name)}`;
    } else if (act.type === 'end') {
      label = `&lt;b&gt;FIN&lt;/b&gt;&lt;br/&gt;${escapeXml(act.name)}`;
    } else if (act.type === 'decision') {
      label = `&lt;b&gt;¿${escapeXml(act.name)}?&lt;/b&gt;&lt;br/&gt;&lt;small&gt;${escapeXml(act.role)}&lt;/small&gt;`;
    } else {
      label = `&lt;b&gt;${act.stepNumber}. ${escapeXml(act.name)}&lt;/b&gt;&lt;br/&gt;` +
        `&lt;font color="#2563eb"&gt;&lt;b&gt;${escapeXml(act.role)}&lt;/b&gt;&lt;/font&gt;` +
        (act.system ? `&lt;br/&gt;&lt;font color="#64748b"&gt;[${escapeXml(act.system)}]&lt;/font&gt;` : '');
    }

    cellsXml += `      <mxCell id="${act.id}" value="${label}" style="${style}" vertex="1" parent="1">\n`;
    cellsXml += `        <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" />\n`;
    cellsXml += `      </mxCell>\n`;

    currentY += height + 50;
  });

  // Connections (edges)
  let edgeCounter = 1;
  const processedConnections = new Set<string>();

  process.connections.forEach((conn) => {
    const key = `${conn.from}->${conn.to}`;
    if (processedConnections.has(key)) return;
    processedConnections.add(key);

    const edgeId = `edge_${edgeCounter++}`;
    const edgeLabel = conn.label ? escapeXml(conn.label) : '';
    const edgeStyle = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=2;fontSize=11;fontStyle=1;';

    cellsXml += `      <mxCell id="${edgeId}" value="${edgeLabel}" style="${edgeStyle}" edge="1" parent="1" source="${conn.from}" target="${conn.to}">\n`;
    cellsXml += `        <mxGeometry relative="1" as="geometry" />\n`;
    cellsXml += `      </mxCell>\n`;
  });

  // If no connections generated, create sequential fallback edges
  if (process.connections.length === 0 && process.activities.length > 1) {
    for (let i = 0; i < process.activities.length - 1; i++) {
      const from = process.activities[i].id;
      const to = process.activities[i + 1].id;
      const edgeId = `edge_seq_${i}`;
      cellsXml += `      <mxCell id="${edgeId}" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=2;" edge="1" parent="1" source="${from}" target="${to}">\n`;
      cellsXml += `        <mxGeometry relative="1" as="geometry" />\n`;
      cellsXml += `      </mxCell>\n`;
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="app.diagrams.net" modified="${dateIso}" agent="Process AI" version="21.0.0" type="device">
  <diagram name="${escapeXml(process.name)}" id="${diagramId}">
    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1169" pageHeight="827" background="#ffffff" math="0" shadow="0">
      <root>
${cellsXml}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
