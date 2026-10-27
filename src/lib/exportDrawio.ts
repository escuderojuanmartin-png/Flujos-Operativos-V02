import { ProcessModel } from '../types/process';

export function generateDrawioXml(process: ProcessModel): string {
  const dateIso = new Date().toISOString();
  const diagramId = `diag_${process.id || 'proc'}`;

  let cellsXml = '';
  // Default cell 0 and 1
  cellsXml += `      <mxCell id="0" />\n`;
  cellsXml += `      <mxCell id="1" parent="0" />\n`;

  const activities = process.activities || [];
  const connections = process.connections || [];
  const actIdSet = new Set(activities.map((a) => a.id));

  // Compute positions respecting branching where possible
  const nodeMap = new Map<string, { x: number; y: number; width: number; height: number }>();
  let currentY = 50;
  const centerX = 400;

  // Track decision branches to space them horizontally
  const outgoingMap: Record<string, string[]> = {};
  connections.forEach((c) => {
    if (actIdSet.has(c.from) && actIdSet.has(c.to)) {
      if (!outgoingMap[c.from]) outgoingMap[c.from] = [];
      outgoingMap[c.from].push(c.to);
    }
  });

  activities.forEach((act, idx) => {
    let width = 220;
    let height = 80;
    let style = '';

    if (act.type === 'start') {
      width = 150;
      height = 55;
      style =
        'ellipse;whiteSpace=wrap;html=1;fillColor=#dcfce7;strokeColor=#16a34a;strokeWidth=2;fontStyle=1;fontSize=12;fontColor=#1e293b;';
    } else if (act.type === 'end') {
      width = 150;
      height = 55;
      style =
        'ellipse;whiteSpace=wrap;html=1;fillColor=#f1f5f9;strokeColor=#475569;strokeWidth=2;fontStyle=1;fontSize=12;fontColor=#1e293b;';
    } else if (act.type === 'decision') {
      width = 190;
      height = 95;
      style =
        'rhombus;whiteSpace=wrap;html=1;fillColor=#fef3c7;strokeColor=#d97706;strokeWidth=2;fontStyle=1;fontSize=12;fontColor=#1e293b;';
    } else {
      width = 240;
      height = 80;
      style =
        'rounded=1;whiteSpace=wrap;html=1;fillColor=#f8fafc;strokeColor=#94a3b8;strokeWidth=1.5;arcSize=8;fontSize=12;fontColor=#0f172a;';
    }

    // Determine X position (branch offset if child of a decision)
    let x = centerX - width / 2;
    const y = currentY;
    nodeMap.set(act.id, { x, y, width, height });

    let label = '';
    if (act.type === 'start') {
      label = `&lt;b&gt;INICIO&lt;/b&gt;&lt;br/&gt;${escapeXml(act.name)}`;
    } else if (act.type === 'end') {
      label = `&lt;b&gt;FIN&lt;/b&gt;&lt;br/&gt;${escapeXml(act.name)}`;
    } else if (act.type === 'decision') {
      label = `&lt;b&gt;¿${escapeXml(act.name)}?&lt;/b&gt;&lt;br/&gt;&lt;font color="#b45309"&gt;${escapeXml(act.role)}&lt;/font&gt;`;
    } else {
      label =
        `&lt;b&gt;${act.stepNumber}. ${escapeXml(act.name)}&lt;/b&gt;&lt;br/&gt;` +
        `&lt;font color="#2563eb"&gt;&lt;b&gt;${escapeXml(act.role)}&lt;/b&gt;&lt;/font&gt;` +
        (act.system ? `&lt;br/&gt;&lt;font color="#64748b"&gt;[${escapeXml(act.system)}]&lt;/font&gt;` : '');
    }

    cellsXml += `      <mxCell id="${act.id}" value="${label}" style="${style}" vertex="1" parent="1">\n`;
    cellsXml += `        <mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry" />\n`;
    cellsXml += `      </mxCell>\n`;

    currentY += height + 45;
  });

  // Connections (edges) - ONLY VERIFIED, REAL CONNECTIONS (NO FICTITIOUS FALLBACKS)
  let edgeCounter = 1;
  const processedConnections = new Set<string>();

  connections.forEach((conn) => {
    // Only export connection if both endpoints exist in confirmed activities
    if (!actIdSet.has(conn.from) || !actIdSet.has(conn.to)) return;

    const key = `${conn.from}->${conn.to}`;
    if (processedConnections.has(key)) return;
    processedConnections.add(key);

    const edgeId = `edge_${edgeCounter++}`;
    const edgeLabel = conn.label ? escapeXml(conn.label) : '';
    const edgeStyle =
      'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;strokeColor=#475569;strokeWidth=1.5;fontSize=11;fontStyle=1;';

    cellsXml += `      <mxCell id="${edgeId}" value="${edgeLabel}" style="${edgeStyle}" edge="1" parent="1" source="${conn.from}" target="${conn.to}">\n`;
    cellsXml += `        <mxGeometry relative="1" as="geometry" />\n`;
    cellsXml += `      </mxCell>\n`;
  });

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
