import React, { useState } from 'react';
import { Client } from '../types/process';
import { Building2, Plus, Check, Shield, FileText, Upload } from 'lucide-react';

interface Props {
  clients: Client[];
  activeClient: Client | null;
  onSelectClient: (client: Client) => void;
  onSaveClient: (client: Client) => void;
}

export const ClientManager: React.FC<Props> = ({
  clients,
  activeClient,
  onSelectClient,
  onSaveClient,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sector, setSector] = useState('');
  const [isoStandard, setIsoStandard] = useState('ISO 9001:2026');

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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveClient(newClient);
    onSelectClient(newClient);
    setName('');
    setCode('');
    setSector('');
    setIsCreating(false);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-left">
          <h2 className="text-lg font-bold text-slate-900">Empresas Clientes</h2>
          <p className="text-xs text-slate-500">
            Configuración documental, codificación y norma de calidad por empresa
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

                {isSelected ? (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100/70 px-2.5 py-0.5 rounded-full">
                    <Check className="w-3 h-3" /> Activo
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">Seleccionar</span>
                )}
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
