import React, { useState, useEffect } from 'react';
import {
  auth,
  db,
  loginWithGoogle,
  logoutUser,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { Client, ProcessModel, ValidationQuestion } from './types/process';
import { ClientManager } from './components/ClientManager';
import { SurveyView } from './components/SurveyView';
import { ProcessWorkspace } from './components/ProcessWorkspace';
import { ValidationView } from './components/ValidationView';
import { ImprovementView } from './components/ImprovementView';
import { ExportView } from './components/ExportView';
import {
  Workflow,
  Building2,
  FileSearch,
  GitBranch,
  HelpCircle,
  Lightbulb,
  Download,
  LogIn,
  LogOut,
  User as UserIcon,
  Shield,
  Layers,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    'clients' | 'surveys' | 'processes' | 'validation' | 'improvements' | 'export'
  >('surveys');

  // Initial Demo Client
  const defaultClient: Client = {
    id: 'client_logistics_01',
    ownerId: 'default_user',
    name: 'Logística Global S.L.',
    code: 'LOG',
    sector: 'Operaciones Logísticas y Almacén',
    isoStandard: 'ISO 9001:2026',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const [clients, setClients] = useState<Client[]>([defaultClient]);
  const [activeClient, setActiveClient] = useState<Client>(defaultClient);

  // Initial Processes (Loaded from synthetic logistics example as demonstration or empty)
  const [processes, setProcesses] = useState<ProcessModel[]>([
    {
      id: 'proc_recepcion',
      surveyId: 'survey_01',
      clientId: defaultClient.id,
      ownerId: defaultClient.ownerId,
      code: 'PR-LOG-01',
      name: 'Recepción de Mercancías',
      docType: 'procedimiento',
      status: 'pendiente_informacion',
      version: '1.0',
      classificationReason:
        'Procedimiento con múltiples roles (administrativo, carretillero, jefe de almacén) y puntos de control/decisión.',
      objective:
        'Asegurar la recepción, verificación de albarán, inspección física y registro en SAP de mercancías.',
      scope: 'Desde la llegada del camión a muelle hasta el registro final en el sistema SAP.',
      trigger: 'Llegada del camión de transporte a las instalaciones.',
      result: 'Mercancía descargada conforme y recepción contabilizada en SAP.',
      inputs: ['Camión con mercancía', 'Albarán de entrega', 'Reserva de transporte'],
      outputs: ['Recepción registrada en SAP', 'Registro de incidencia (si aplica)'],
      roles: ['Administrativo', 'Carretillero', 'Responsable de Almacén'],
      systems: ['SAP ERP (MIGO)'],
      activities: [
        {
          id: 'step_1',
          stepNumber: 1,
          name: 'Llegada del transporte',
          description: 'El camión con mercancía llega a las instalaciones.',
          role: 'Carretillero / Administrativo',
          type: 'start',
        },
        {
          id: 'step_2',
          stepNumber: 2,
          name: 'Revisión de albarán y matrícula',
          description:
            'El administrativo revisa el albarán en papel y comprueba que la matrícula del camión corresponda con la reserva.',
          role: 'Administrativo',
          type: 'action',
        },
        {
          id: 'step_3',
          stepNumber: 3,
          name: 'Verificación de coincidencia de reserva',
          description: 'Se evalúa si la matrícula y los datos coinciden con la reserva previa.',
          role: 'Administrativo',
          type: 'decision',
          conditionLabel: '¿Datos correctos?',
        },
        {
          id: 'step_4',
          stepNumber: 4,
          name: 'Asignación de muelle de descarga',
          description: 'Si está todo correcto, se le asigna el muelle de descarga correspondiente.',
          role: 'Administrativo',
          type: 'action',
        },
        {
          id: 'step_5',
          stepNumber: 5,
          name: 'Descarga e inspección visual de palés',
          description:
            'El carretillero descarga los palés y revisa visualmente si existe algún daño visible en los bultos.',
          role: 'Carretillero',
          type: 'action',
        },
        {
          id: 'step_6',
          stepNumber: 6,
          name: 'Control de daños visibles',
          description: 'Comprobación de la integridad física de los palés recibidos.',
          role: 'Carretillero',
          type: 'decision',
          conditionLabel: '¿Daños detectados?',
        },
        {
          id: 'step_7',
          stepNumber: 7,
          name: 'Notificación de daños y registro de incidencia',
          description:
            'En caso de encontrar daños, el carretillero avisa al responsable de almacén y se genera un registro de incidencia.',
          role: 'Carretillero',
          type: 'action',
          exceptions: 'Mercancía con golpes o roturas en embalaje.',
        },
        {
          id: 'step_8',
          stepNumber: 8,
          name: 'Registro de recepción en SAP',
          description:
            'Cuando termina la descarga, se registra la recepción en la transacción SAP MIGO.',
          role: 'Administrativo / Carretillero',
          system: 'SAP MIGO',
          type: 'action',
        },
        {
          id: 'step_9',
          stepNumber: 9,
          name: 'Fin de la recepción',
          description: 'Mercancía ubicada y stock contabilizado.',
          role: 'Responsable de Almacén',
          type: 'end',
        },
      ],
      connections: [
        { from: 'step_1', to: 'step_2' },
        { from: 'step_2', to: 'step_3' },
        { from: 'step_3', to: 'step_4', label: 'Sí' },
        { from: 'step_4', to: 'step_5' },
        { from: 'step_5', to: 'step_6' },
        { from: 'step_6', to: 'step_7', label: 'Con daños' },
        { from: 'step_6', to: 'step_8', label: 'Conforme' },
        { from: 'step_7', to: 'step_8' },
        { from: 'step_8', to: 'step_9' },
      ],
      validationQuestions: [
        {
          id: 'q_rec_1',
          question: '¿Qué acción se toma si la matrícula no coincide con la reserva previa?',
          reason: 'Falta documentar la rama negativa de la primera decisión operativa.',
          relatedActivityId: 'step_3',
          originalQuote: 'Si está todo bien, le asignan el muelle de descarga.',
          status: 'pending',
        },
        {
          id: 'q_rec_2',
          question: '¿Quién registra físicamente la transacción MIGO en SAP, el carretillero o el administrativo?',
          reason: 'Ambigüedad en el responsable del paso 8 del procedimiento.',
          relatedActivityId: 'step_8',
          originalQuote: 'Cuando termina, registra la recepción en SAP.',
          status: 'pending',
        },
      ],
      privateImprovements: [
        {
          id: 'imp_rec_1',
          type: 'pain_point',
          title: 'Revisión manual en papel del albarán de matrícula',
          description: 'El administrativo verifica visualmente el albarán en papel contra reserva.',
          evidence: 'el administrativo revisa el albarán y comprueba que la matrícula corresponda',
          impact: 'Riesgo de error humano y colas de espera en puerta de camiones.',
          proposal: 'Implementar lector OCR de matrícula o código QR en albarán de transporte.',
          priority: 'media',
          status: 'detectado',
        },
        {
          id: 'imp_rec_2',
          type: 'opportunity',
          title: 'Automatización del registro de incidencias por foto móvil',
          description: 'Avisar verbalmente al responsable puede retrasar la descarga.',
          evidence: 'Si encuentra daños, avisa al responsable del almacén y se registra una incidencia',
          impact: 'Tiempo muerto del transportista.',
          proposal: 'App móvil para carretillero con captura fotográfica automática en SAP.',
          priority: 'alta',
          status: 'detectado',
        },
      ],
      relatedUnits: ['Instructivo de Registro en SAP MIGO'],
      history: [
        {
          version: '1.0',
          date: new Date().toLocaleDateString('es-ES'),
          author: 'Process AI',
          description: 'Extracción AS-IS inicial del relevamiento logístico.',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proc_sap_migo',
      surveyId: 'survey_01',
      clientId: defaultClient.id,
      ownerId: defaultClient.ownerId,
      code: 'IT-SAP-01',
      name: 'Instructivo de Registro de Recepción en SAP',
      docType: 'instructivo',
      status: 'validado',
      version: '1.0',
      classificationReason:
        'Instructivo técnico con instrucciones paso a paso de uso de la transacción MIGO en software.',
      objective: 'Detallar los pasos exactos para contabilizar recepciones en la transacción MIGO.',
      scope: 'Exclusivo para la operativa del sistema SAP ERP.',
      trigger: 'Finalización de la descarga física de palés.',
      result: 'Documento de material SAP generado y contabilizado.',
      inputs: ['Número de pedido / albarán', 'Cantidades contadas'],
      outputs: ['Documento de material SAP'],
      roles: ['Administrativo de Recepción'],
      systems: ['SAP ERP (Transacción MIGO)'],
      activities: [
        {
          id: 'sap_1',
          stepNumber: 1,
          name: 'Acceso a transacción MIGO',
          description: 'Acceder al entorno SAP y digitar el código de transacción MIGO.',
          role: 'Administrativo de Recepción',
          system: 'SAP',
          type: 'start',
        },
        {
          id: 'sap_2',
          stepNumber: 2,
          name: 'Seleccionar documento de referencia',
          description: 'Elegir el pedido de compra o albarán de entrega correspondiente.',
          role: 'Administrativo de Recepción',
          system: 'SAP',
          type: 'action',
        },
        {
          id: 'sap_3',
          stepNumber: 3,
          name: 'Introducir cantidades recibidas',
          description: 'Digitar las unidades físicas descargadas y verificar almacén de destino.',
          role: 'Administrativo de Recepción',
          system: 'SAP',
          type: 'action',
        },
        {
          id: 'sap_4',
          stepNumber: 4,
          name: 'Verificar datos (Check)',
          description: 'Pulsar el botón de verificación para comprobar que no existan inconsistencias.',
          role: 'Administrativo de Recepción',
          system: 'SAP',
          type: 'decision',
          conditionLabel: '¿Datos válidos?',
        },
        {
          id: 'sap_5',
          stepNumber: 5,
          name: 'Contabilizar recepción (Post)',
          description: 'Contabilizar el documento de material generando el asiento de inventario.',
          role: 'Administrativo de Recepción',
          system: 'SAP',
          type: 'end',
        },
      ],
      connections: [
        { from: 'sap_1', to: 'sap_2' },
        { from: 'sap_2', to: 'sap_3' },
        { from: 'sap_3', to: 'sap_4' },
        { from: 'sap_4', to: 'sap_5', label: 'Conforme' },
      ],
      validationQuestions: [],
      privateImprovements: [
        {
          id: 'imp_sap_1',
          type: 'opportunity',
          title: 'Escaneo de código de barras para transacción MIGO',
          description: 'La digitación manual de cantidades puede provocar discrepancias.',
          evidence: 'introducimos las cantidades recibidas, verificamos los datos y contabilizamos',
          impact: 'Diferencias de inventario.',
          proposal: 'Pistolas RFID o terminales portátiles para confirmación directa.',
          priority: 'media',
          status: 'detectado',
        },
      ],
      relatedUnits: ['Recepción de Mercancías'],
      history: [
        {
          version: '1.0',
          date: new Date().toLocaleDateString('es-ES'),
          author: 'Process AI',
          description: 'Instructivo técnico AS-IS.',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const [activeProcessId, setActiveProcessId] = useState<string>('proc_recepcion');

  // Track Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Attempt loading user clients from Firestore
        try {
          const clientsCol = collection(db, 'clients');
          const q = query(clientsCol, where('ownerId', '==', user.uid));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const loadedClients = snapshot.docs.map((d) => d.data() as Client);
            setClients(loadedClients);
            setActiveClient(loadedClients[0]);
          }
        } catch (err) {
          // If firestore rules reject or offline, fall back to state
          console.warn('Firestore initial sync note:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateProcess = (updated: ProcessModel) => {
    setProcesses((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

    // Save to Firestore if authenticated
    if (currentUser) {
      try {
        const procDoc = doc(db, 'processes', updated.id);
        setDoc(procDoc, { ...updated, ownerId: currentUser.uid });
      } catch (err) {
        console.warn('Syncing process to Firestore:', err);
      }
    }
  };

  const handleSaveClient = (newClient: Client) => {
    setClients((prev) => [newClient, ...prev]);
    setActiveClient(newClient);

    if (currentUser) {
      try {
        const clientDoc = doc(db, 'clients', newClient.id);
        setDoc(clientDoc, { ...newClient, ownerId: currentUser.uid });
      } catch (err) {
        console.warn('Syncing client to Firestore:', err);
      }
    }
  };

  const handleAnalysisComplete = (
    newProcesses: ProcessModel[],
    summary: string,
    targetIndex: number = 0
  ) => {
    setProcesses(newProcesses);
    if (newProcesses.length > 0) {
      const target = newProcesses[targetIndex] || newProcesses[0];
      setActiveProcessId(target.id);
    }
    setActiveTab('processes');
  };

  const handleRefreshWithGemini = async (
    process: ProcessModel,
    answeredQuestions: ValidationQuestion[]
  ) => {
    try {
      const res = await fetch('/api/gemini/update-process-with-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentProcess: process,
          answeredQuestions,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.updatedProcess) {
          handleUpdateProcess({
            ...process,
            ...data.updatedProcess,
            id: process.id,
            surveyId: process.surveyId,
            clientId: process.clientId,
            ownerId: process.ownerId,
            status: process.status,
            validationQuestions: process.validationQuestions,
            privateImprovements: process.privateImprovements,
          });
        }
      }
    } catch (err) {
      console.error('Error updating process with Gemini:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 font-sans">
      {/* Top Main Navigation Bar */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wide text-white">PROCESS AI</span>
              <span className="text-[10px] text-blue-400 font-medium block -mt-1 tracking-wider uppercase">
                ISO 9001 Engine
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 overflow-x-auto text-xs py-1 scrollbar-none">
            <button
              onClick={() => setActiveTab('clients')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'clients'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Clientes</span>
            </button>

            <button
              onClick={() => setActiveTab('surveys')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'surveys'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FileSearch className="w-3.5 h-3.5" />
              <span>Relevamientos</span>
            </button>

            <button
              onClick={() => setActiveTab('processes')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'processes'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Procesos ({processes.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('validation')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'validation'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Validación</span>
            </button>

            <button
              onClick={() => setActiveTab('improvements')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'improvements'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Mejoras (Privado)</span>
            </button>

            <button
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1.5 transition-colors shrink-0 ${
                activeTab === 'export'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar</span>
            </button>
          </nav>

          {/* Authentication & User Status */}
          <div className="flex items-center gap-2 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300 hidden md:inline truncate max-w-[130px]">
                  {currentUser.email || currentUser.displayName}
                </span>
                <button
                  onClick={() => logoutUser()}
                  title="Cerrar sesión"
                  className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => loginWithGoogle()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors border border-slate-700"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Acceder con Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'clients' && (
          <ClientManager
            clients={clients}
            activeClient={activeClient}
            onSelectClient={(c) => setActiveClient(c)}
            onSaveClient={handleSaveClient}
          />
        )}

        {activeTab === 'surveys' && (
          <SurveyView
            activeClient={activeClient}
            onAnalysisComplete={handleAnalysisComplete}
          />
        )}

        {activeTab === 'processes' && (
          <ProcessWorkspace
            processes={processes}
            activeProcessId={activeProcessId}
            onSelectProcessId={(id) => setActiveProcessId(id)}
            onUpdateProcess={handleUpdateProcess}
            client={activeClient}
          />
        )}

        {activeTab === 'validation' && (
          <ValidationView
            processes={processes}
            onUpdateProcess={handleUpdateProcess}
            onRefreshWithGemini={handleRefreshWithGemini}
          />
        )}

        {activeTab === 'improvements' && (
          <ImprovementView
            processes={processes}
            onUpdateProcess={handleUpdateProcess}
          />
        )}

        {activeTab === 'export' && (
          <ExportView processes={processes} client={activeClient} />
        )}
      </main>
    </div>
  );
}
