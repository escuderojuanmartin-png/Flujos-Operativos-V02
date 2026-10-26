import React, { useState } from 'react';
import { ProcessModel, Client } from '../types/process';
import { saveAs } from 'file-saver';
import { generateDocxBlob } from '../lib/exportDocx';
import { generatePdfBlob } from '../lib/exportPdf';
import { generateDrawioXml } from '../lib/exportDrawio';
import { exportProcessZip } from '../lib/exportZip';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Archive,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

interface Props {
  processes: ProcessModel[];
  client?: Client;
}

export const ExportView: React.FC<Props> = ({ processes, client }) => {
  const [selectedProcessId, setSelectedProcessId] = useState<string>(processes[0]?.id || '');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const activeProcess = processes.find((p) => p.id === selectedProcessId) || processes[0];

  if (!activeProcess) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-slate-500">
        <p className="font-semibold text-slate-700">No hay procesos para exportar</p>
      </div>
    );
  }

  const isDraft = activeProcess.status !== 'validado';
  const baseFileName = `${activeProcess.code || 'PR-01'}_${activeProcess.name.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;

  const handleDownloadDocx = async () => {
    setIsExporting(true);
    try {
      const blob = await generateDocxBlob(activeProcess, client);
      saveAs(blob, `${baseFileName}.docx`);
      setExportSuccess('Documento Word (.docx) descargado exitosamente');
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = () => {
    setIsExporting(true);
    try {
      const blob = generatePdfBlob(activeProcess, client);
      saveAs(blob, `${baseFileName}.pdf`);
      setExportSuccess('Documento PDF (.pdf) descargado exitosamente');
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadDrawio = () => {
    setIsExporting(true);
    try {
      const xml = generateDrawioXml(activeProcess);
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      saveAs(blob, `${baseFileName}.drawio`);
      setExportSuccess('Diagrama editable draw.io (.drawio) descargado exitosamente');
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadZip = async () => {
    setIsExporting(true);
    try {
      await exportProcessZip(activeProcess, client);
      setExportSuccess('Paquete completo de entregables (.zip) descargado exitosamente');
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Process Selection Header */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Proceso a exportar:
          </label>
          <select
            value={activeProcess.id}
            onChange={(e) => {
              setSelectedProcessId(e.target.value);
              setExportSuccess(null);
            }}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-800 bg-white"
          >
            {processes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code ? `[${p.code}] ` : ''}{p.name} ({p.docType})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Estado:</span>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
              isDraft ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {activeProcess.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* ISO Quality & Privacy Verification Card */}
      <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-left">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-900 leading-relaxed">
          <strong className="font-bold block text-sm mb-0.5 text-emerald-950">
            Garantía de Conformidad ISO 9001:2026 y Separación de Confidencialidad
          </strong>
          Los archivos exportados contienen exclusivamente los datos del procedimiento operativo AS-IS
          aprobado ({activeProcess.activities.length} actividades documentadas).
          Cualquier oportunidad privada o punto de dolor ha sido físicamente filtrado para no figurar en
          los entregables oficiales de la empresa.
        </div>
      </div>

      {isDraft && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3 text-left">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <strong className="font-bold block text-sm mb-0.5">Aviso de Documento en Borrador</strong>
            Este proceso aún no ha sido marcado como "Validado". Los documentos generados incluirán
            la marca oficial de BORRADOR para cumplir con las buenas prácticas de control de documentos.
          </div>
        </div>
      )}

      {exportSuccess && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          {exportSuccess}
        </div>
      )}

      {/* Export Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Word Document */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 text-left flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Documento Word (.docx)</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Procedimiento editable estructurado bajo ISO 9001:2026 con encabezado, tabla de control de versiones,
              roles, y tabla de actividades AS-IS.
            </p>
          </div>
          <button
            onClick={handleDownloadDocx}
            disabled={isExporting}
            className="mt-4 w-full py-2 px-3 rounded-md bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar Word (.docx)
          </button>
        </div>

        {/* PDF Document */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 text-left flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-700 flex items-center justify-center mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Documento PDF (.pdf)</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Documento formal vectorizado listo para distribución y firma con formato limpio, paginado y
              especificaciones de calidad.
            </p>
          </div>
          <button
            onClick={handleDownloadPdf}
            disabled={isExporting}
            className="mt-4 w-full py-2 px-3 rounded-md bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar PDF (.pdf)
          </button>
        </div>

        {/* draw.io Diagram */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 text-left flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mb-3">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Diagrama Editable draw.io (.drawio)</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Archivo XML compatible con diagrams.net / draw.io con nodos, etiquetas, decisiones y conectores
              totalmente editables (no imagen incrustada).
            </p>
          </div>
          <button
            onClick={handleDownloadDrawio}
            disabled={isExporting}
            className="mt-4 w-full py-2 px-3 rounded-md bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar draw.io (.drawio)
          </button>
        </div>

        {/* ZIP Package */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 text-left flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs">
          <div>
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center mb-3">
              <Archive className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-slate-900">Paquete Completo (.zip)</h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Agrupa en un único archivo comprimido el Word, el PDF, el archivo draw.io y la memoria técnica en Markdown.
            </p>
          </div>
          <button
            onClick={handleDownloadZip}
            disabled={isExporting}
            className="mt-4 w-full py-2 px-3 rounded-md bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            Descargar Paquete ZIP
          </button>
        </div>
      </div>
    </div>
  );
};
