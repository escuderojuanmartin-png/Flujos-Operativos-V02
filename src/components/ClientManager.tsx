import React, { useState } from 'react';
import { Client } from '../types/process';
import { Building2, Plus, Check, Shield, FileText, Upload, Paperclip, Trash2, AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  clients: Client[];
  activeClient: Client | null;
  onSelectClient: (client: Client) => void;
  onSaveClient: (client: Client) => void;
  onDeleteClient?: (clientId: string) => Promise<void> | void;
}

export const ClientManager: React.FC<Props> = ({
  clients,
  activeClient,
  onSelectClient,
  onSaveClient,
  onDeleteClient,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sector, setSector] = useState('');
  const [isoStandard, setIsoStandard] = useState('ISO 9001:2026');
  const [templateFileName, setTemplateFileName] = useState('');
  const [clientPendingDelete, setClientPendingDelete] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    const newClient: Client = {
      id: `client_${Date.now()}`,
      ownerId: 'default_user',
      name: name.trim(),
      code: code.trim().toUpperCase(),
      sector: sector.trim() || 'Logística y Operaciones',
      isoStandard: isoStandard.trim() || 'ISO 9001:2026',
      templateFileName: templateFileName.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveClient(newClient);
    onSelectClient(newClient);
    setName('');
    setCode('');
    setSector('');
    setTemplateFileName('');
    setIsCreating(false);
  };

  const handleTemplateFileUpload = (clientId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetClient = clients.find((c) => c.id === clientId);
    if (!targetClient) return;

    const updated: Client = {
      ...targetClient,
      templateFileName: file.name,
      updatedAt: new Date().toISOString(),
    };
    onSaveClient(updated);
    if (activeClient?.id === clientId) {
      onSelectClient(updated);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-left">
          <h2 className="text-lg font-bold text-slate-900">Empresas Clientes</h2>
          <p className="text-xs text-slate-500">
            Aislamiento lógico, configuración documental, codificación y plantillas por cliente
          </p>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Empresa Cliente
        </button>
      </div>

      {/* Creation Modal / Inline Box */}
      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="bg-white p-5 rounded-lg border border-blue-200 shadow-xs space-y-4 text-left"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
            Registrar Nueva Empresa
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-600 block mb-1 font-medium">Nombre de la Empresa *</label>
              <input
                type="text"
                required
                value={name}
                placeholder="Ej. Logística Global Ibérica S.A."
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 block mb-1 font-medium">Identificador / Código *</label>
              <input
                type="text"
                required
                value={code}
                placeholder="Ej. LGI"
                onChange={(e) => setCode(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 block mb-1 font-medium">Sector o Actividad</label>
              <input
                type="text"
                value={sector}
                placeholder="Ej. Distribución y Transporte"
                onChange={(e) => setSector(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-600 block mb-1 font-medium">Norma de Referencia</label>
              <input
                type="text"
                value={isoStandard}
                placeholder="ISO 9001:2026"
                onChange={(e) => setIsoStandard(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded"
            >
              Guardar Empresa
            </button>
          </div>
        </form>
      )}

      {/* Clients Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clients.map((c) => {
          const isSelected = activeClient?.id === c.id;

          return (
            <div
              key={c.id}
              onClick={() => onSelectClient(c)}
              className={`rounded-lg border p-5 text-left cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-600 bg-blue-50/20 shadow-xs ring-1 ring-blue-500'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                      isSelected ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-tight">{c.name}</h3>
                    <span className="text-[11px] text-slate-500 font-mono">Código: {c.code}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isSelected ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> Activo
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">Seleccionar</span>
                  )}

                  {onDeleteClient && (
                    <button
                      type="button"
                      title={`Eliminar ${c.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setClientPendingDelete(c);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-1"
                      aria-label={`Eliminar ${c.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[10px]">Sector:</span>
                  <span className="font-medium text-slate-800 truncate block">
                    {c.sector || 'General'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Norma:</span>
                  <span className="font-semibold text-blue-800">{c.isoStandard}</span>
                </div>
              </div>

              {/* Word Template Section (Section 6.4) */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-500 text-[11px]">Plantilla Word:</span>
                  <span className="font-medium text-slate-800 truncate text-[11px]">
                    {c.templateFileName || 'Estándar ISO'}
                  </span>
                </div>

                <label className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer shrink-0 transition-colors">
                  <Upload className="w-3 h-3 inline mr-1" />
                  <span>{c.templateFileName ? 'Cambiar .docx' : 'Cargar .docx'}</span>
                  <input
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={(e) => handleTemplateFileUpload(c.id, e)}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal for Client Deletion */}
      {clientPendingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-left border border-slate-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="p-2.5 rounded-full bg-red-100 text-red-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">¿Eliminar empresa cliente?</h3>
                <p className="text-xs text-slate-500 mt-0.5">Esta acción eliminará de forma irreversible el cliente.</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 mb-4 text-xs text-slate-700 space-y-1.5">
              <div>
                <span className="text-slate-400 font-medium">Empresa: </span>
                <strong className="text-slate-900">{clientPendingDelete.name}</strong>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Código: </span>
                <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold text-slate-800">
                  {clientPendingDelete.code}
                </span>
              </div>
              <p className="text-[11px] text-amber-700 pt-1 font-medium">
                Aviso: Se eliminarán los procesos, relevamientos y configuraciones asociados a este cliente.
              </p>
            </div>

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setClientPendingDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={async () => {
                  if (!onDeleteClient) return;
                  setIsDeleting(true);
                  try {
                    await onDeleteClient(clientPendingDelete.id);
                    setClientPendingDelete(null);
                  } catch (err) {
                    console.error('Error deleting client:', err);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md shadow-xs transition-colors disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Empresa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
