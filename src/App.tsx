import React, { useState, useEffect, useCallback } from 'react';
import {
  auth,
  loginWithGoogle,
  logoutUser,
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Client, ProcessModel, ValidationQuestion, Survey } from './types/process';
import {
  saveClientToFirestore,
  loadClientsFromFirestore,
  deleteClientFromFirestore,
  saveSurveyToFirestore,
  loadSurveysFromFirestore,
  saveProcessToFirestore,
  loadProcessesFromFirestore,
  SyncState,
} from './lib/persistence';
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
  Cloud,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [activeTab, setActiveTab] = useState<
    'clients' | 'surveys' | 'processes' | 'validation' | 'improvements' | 'export'
  >('surveys');

  // Baseline Client
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

  // Initial Verified AS-IS Processes (Strict fidelity to actual interview, NO unprompted SAP/MIGO)
  const initialDireccionesProcess: ProcessModel = {
    id: 'proc_direcciones',
    surveyId: 'survey_01',
    clientId: defaultClient.id,
    ownerId: defaultClient.ownerId,
    code: 'PR-LOG-01',
    name: 'Gestión y Revisión de Direcciones de Cliente',
    docType: 'procedimiento',
    status: 'validado',
    version: '1.0',
    classificationReason:
      'Procedimiento administrativo-operativo para la normalización de direcciones de entrega en la ficha maestra y habilitación de enrutamiento automático.',
    objective:
      'Asegurar que las direcciones de entrega de los clientes estén validadas, normalizadas y con accesibilidad comprobada para optimizar el enrutamiento logístico.',
    scope: 'Desde la consulta de la ficha del cliente en el aplicativo hasta la validación de accesibilidad para camiones pesados.',
    trigger: 'Recepción de nueva orden de entrega o actualización requerida en los datos maestros del cliente.',
    result: 'Ficha maestra normalizada con dirección válida y nota operativa en el sistema de gestión.',
    inputs: ['Ficha de cliente', 'Datos de entrega (calle, número, código postal)', 'Requisitos de accesibilidad'],
    outputs: ['Ficha maestra actualizada', 'Dirección apta para enrutamiento automático'],
    roles: ['Administrativo de Tráfico'],
    systems: ['Aplicación de Gestión de Clientes / Tráfico'],
    procedureNarrative: `PROCEDIMIENTO OPERATIVO NORMALIZADO (ISO 9001:2026)
CÓDIGO: PR-LOG-01 | VERSIÓN: 1.0 | ESTADO: AS-IS RELEVADO
TÍTULO: GESTIÓN Y REVISIÓN DE DIRECCIONES DE CLIENTE
EMPRESA: Logística Global S.L.

1. OBJETO Y JUSTIFICACIÓN
Estandarizar y formalizar los pasos operativos de revisión, normalización y validación de direcciones de entrega de clientes, garantizando la fiabilidad de los datos en el sistema de tráfico para optimizar el enrutamiento logístico y evitar fallos en la distribución.

2. ALCANCE Y LÍMITES OPERATIVOS
Aplica íntegramente a las gestiones realizadas por el departamento de tráfico desde la consulta de la ficha del cliente en el aplicativo hasta la actualización de la ficha maestra y habilitación de la dirección para el enrutamiento automático. Involucra al rol de Administrativo de Tráfico.

3. MATRIZ DE RESPONSABILIDADES Y ROLES
• Administrativo de Tráfico: Responsable de acceder a la aplicación de gestión, verificar la integridad de los datos de dirección (calle, número, código postal), evaluar la viabilidad de acceso para camiones pesados y registrar las notas correspondientes en la ficha maestra.

4. DESARROLLO NARRATIVO Y OPERATIVO PASO A PASO
4.1. ACCESO Y CONSULTA DE FICHA DE CLIENTE [START]
- Rol Ejecutor: Administrativo de Tráfico | Sistema/Soporte: Aplicación de Gestión de Clientes
- Desarrollo Operativo: El administrativo accede al módulo de clientes del sistema de gestión y consulta el registro correspondiente al cliente destinatario, verificando los datos de entrega consignados para las expediciones en curso.
- Evidencia AS-IS: "En la aplicación de gestión de clientes, consultamos la ficha del cliente"

4.2. REVISIÓN Y NORMALIZACIÓN DE DIRECCIÓN [ACTION]
- Rol Ejecutor: Administrativo de Tráfico
- Desarrollo Operativo: Se comprueba minuciosamente que la dirección cuente con todos los campos normalizados: nombre de calle o polígono, numeración exterior/interior y código postal válido conforme a la cartografía del sistema logístico.
- Evidencia AS-IS: "verificamos si la dirección de entrega está normalizada con calle, número y código postal válidos."

4.3. CONTROL DE ACCESIBILIDAD PARA VEHÍCULOS PESADOS [DECISION]
- Rol Ejecutor: Administrativo de Tráfico
- Desarrollo Operativo: Se evalúa si el punto de destino presenta limitaciones físicas o normativas para el acceso de camiones pesados o si se detectan inconsistencias en la información geográfica.
- Evidencia AS-IS: "Si detectamos alguna inconsistencia o falta de accesibilidad para camiones pesados"

4.4. ACTUALIZACIÓN DE FICHA MAESTRA Y REGISTRO EN SISTEMA [ACTION]
- Rol Ejecutor: Administrativo de Tráfico | Sistema/Soporte: Aplicación de Gestión de Clientes
- Desarrollo Operativo: Si se detectan inconsistencias o restricciones de accesibilidad, el administrativo actualiza de inmediato la ficha maestra del cliente y añade una nota explicativa en el sistema para instruir al algoritmo de enrutamiento y al transportista.
- Evidencia AS-IS: "actualizamos la ficha maestra y dejamos nota en el sistema para que el enrutamiento automático no falle."

4.5. VALIDACIÓN CONFORME Y HABILITACIÓN PARA ENRUTAMIENTO [END]
- Rol Ejecutor: Administrativo de Tráfico
- Desarrollo Operativo: Con la dirección normalizada y las notas operativas registradas, la ficha queda validada y lista para ser procesada sin riesgo de fallo en el motor de enrutamiento automático.
- Evidencia AS-IS: "para que el enrutamiento automático no falle."

5. GESTIÓN DE EXCEPCIONES Y BIFURCACIONES
En caso de detectar falta de accesibilidad para camiones pesados o datos incompletos en el código postal, se deriva a la rama de actualización obligatoria de ficha maestra antes de liberar la expedición a enrutamiento.

6. REGISTROS DE CALIDAD Y AUDITORÍA
Se mantiene el histórico de cambios en la ficha maestra del cliente con fecha, usuario y motivo de actualización conforme a las directrices de trazabilidad ISO 9001.`,
    activities: [
      {
        id: 'step_1',
        stepNumber: 1,
        name: 'Consulta de ficha de cliente en aplicativo',
        description:
          'El administrativo accede a la aplicación de clientes y consulta la ficha correspondiente para revisar los datos de entrega.',
        role: 'Administrativo de Tráfico',
        system: 'Aplicación de Gestión de Clientes',
        type: 'start',
        sourceQuote: 'En la aplicación de gestión de clientes, consultamos la ficha del cliente',
        status: 'confirmed',
        verifiedByHuman: true,
      },
      {
        id: 'step_2',
        stepNumber: 2,
        name: 'Verificación y normalización de dirección',
        description:
          'Se verifica que la dirección de entrega cuente con calle, número y código postal normalizados y válidos.',
        role: 'Administrativo de Tráfico',
        type: 'action',
        sourceQuote: 'verificamos si la dirección de entrega está normalizada con calle, número y código postal válidos',
        status: 'confirmed',
        verifiedByHuman: true,
      },
      {
        id: 'step_3',
        stepNumber: 3,
        name: 'Control de accesibilidad e inconsistencias',
        description:
          'Se evalúa si existen inconsistencias geográficas o falta de accesibilidad para camiones de gran tonelaje.',
        role: 'Administrativo de Tráfico',
        type: 'decision',
        sourceQuote: 'Si detectamos alguna inconsistencia o falta de accesibilidad para camiones pesados',
        status: 'confirmed',
        verifiedByHuman: true,
      },
      {
        id: 'step_4',
        stepNumber: 4,
        name: 'Actualización de ficha maestra y registro de nota',
        description:
          'En caso de detectarse incidencias de acceso o datos erróneos, se actualiza la ficha maestra y se asienta una nota en el sistema.',
        role: 'Administrativo de Tráfico',
        system: 'Aplicación de Gestión de Clientes',
        type: 'action',
        sourceQuote: 'actualizamos la ficha maestra y dejamos nota en el sistema para que el enrutamiento automático no falle.',
        status: 'confirmed',
        verifiedByHuman: true,
      },
      {
        id: 'step_5',
        stepNumber: 5,
        name: 'Conformidad y habilitación para enrutamiento automático',
        description:
          'La dirección queda validada y normalizada en el sistema, asegurando que el enrutamiento automático opere sin fallos.',
        role: 'Administrativo de Tráfico',
        type: 'end',
        sourceQuote: 'para que el enrutamiento automático no falle.',
        status: 'confirmed',
        verifiedByHuman: true,
      },
    ],
    connections: [
      { from: 'step_1', to: 'step_2' },
      { from: 'step_2', to: 'step_3' },
      { from: 'step_3', to: 'step_4', label: 'Con inconsistencias o restricción' },
      { from: 'step_3', to: 'step_5', label: 'Conforme y accesible' },
      { from: 'step_4', to: 'step_5' },
    ],
    validationQuestions: [
      {
        id: 'q_dir_1',
        question: '¿Qué protocolo se sigue si el cliente no proporciona un código postal válido tras contactarlo?',
        reason: 'Se requiere delimitar el tratamiento de expediciones con dirección bloqueada.',
        criticality: 'importante',
        relatedActivityId: 'step_3',
        originalQuote: 'Si detectamos alguna inconsistencia...',
        status: 'pending',
      },
    ],
    privateImprovements: [
      {
        id: 'imp_dir_1',
        type: 'opportunity',
        title: 'Geocodificación y validación automática de direcciones',
        description: 'La verificación manual de códigos postales puede ralentizar la entrada de pedidos.',
        evidence: 'consultamos la ficha del cliente y verificamos si la dirección de entrega está normalizada',
        impact: 'Ahorro de hasta 15 minutos por lote de expedición.',
        proposal: 'Integrar API de geocodificación automática al dar de alta al cliente.',
        priority: 'media',
        status: 'detectado',
      },
    ],
    relatedUnits: ['Concertación de Entregas'],
    history: [
      {
        version: '1.0',
        date: new Date().toLocaleDateString('es-ES'),
        author: 'Process AI',
        description: 'Extracción AS-IS inicial del relevamiento operativo.',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const initialConcertacionesProcess: ProcessModel = {
    id: 'proc_concertaciones',
    surveyId: 'survey_01',
    clientId: defaultClient.id,
    ownerId: defaultClient.ownerId,
    code: 'PR-LOG-02',
    name: 'Concertación de Entregas',
    docType: 'procedimiento',
    status: 'validado',
    version: '1.0',
    classificationReason:
      'Procedimiento interactivo con bifurcación de decisión sobre confirmación de cita entre operador logístico y cliente destinatario.',
    objective:
      'Gestionar y concertar la cita de entrega de expediciones con el cliente destinatario según el canal establecido (teléfono, email o notificación automática).',
    scope: 'Desde la identificación de expediciones pendientes en la pestaña de concertaciones hasta la confirmación definitiva o posposición de la cita.',
    trigger: 'Generación de expediciones en estado pendiente de concertar en la bandeja de tráfico.',
    result: 'Cita de entrega aceptada y confirmada en sistema o reprogramación registrada.',
    inputs: ['Expediciones pendientes de concertar', 'Disponibilidad de flota y rutas', 'Canal de contacto del destinatario'],
    outputs: ['Cita concertada confirmada en sistema', 'Registro de posposición y nueva fecha pactada'],
    roles: ['Operador de Tráfico y Concertaciones', 'Cliente / Destinatario'],
    systems: ['Módulo de Concertaciones / Notificaciones'],
    procedureNarrative: `PROCEDIMIENTO OPERATIVO NORMALIZADO (ISO 9001:2026)
CÓDIGO: PR-LOG-02 | VERSIÓN: 1.0 | ESTADO: AS-IS RELEVADO
TÍTULO: CONCERTACIÓN DE ENTREGAS
EMPRESA: Logística Global S.L.

1. OBJETO Y JUSTIFICACIÓN
Establecer la metodología operativa para acordar la fecha y franja horaria de entrega de expediciones con los clientes destinatarios, garantizando el cumplimiento de los compromisos de servicio y evitando entregas fallidas conforme a la norma ISO 9001:2026.

2. ALCANCE Y LÍMITES OPERATIVOS
Aplica a todas las expediciones que requieran concertación previa, desde la visualización de órdenes en la pestaña de concertaciones hasta el cierre de la cita en el sistema de gestión. Involucra al Operador de Tráfico y al Cliente Destinatario.

3. MATRIZ DE RESPONSABILIDADES Y ROLES
• Operador de Tráfico y Concertaciones: Responsable de filtrar las expediciones pendientes, elegir el tipo de concertación, enviar la propuesta horaria y gestionar reprogramaciones en caso de posposición.
• Cliente / Destinatario: Responsable de recibir la propuesta horaria y responder mediante la aceptación o solicitud de posposición.

4. DESARROLLO NARRATIVO Y OPERATIVO PASO A PASO
4.1. IDENTIFICACIÓN DE EXPEDICIONES PENDIENTES [START]
- Rol Ejecutor: Operador de Tráfico y Concertaciones | Sistema/Soporte: Módulo de Concertaciones
- Desarrollo Operativo: El operador accede a la pestaña de concertaciones por email en la aplicación de tráfico y consulta el listado consolidado de expediciones que están pendientes de concertar una fecha con el destinatario.
- Evidencia AS-IS: "En esta pestaña concertaciones por email, ya te aparece el listado de expediciones pendientes de concertar."

4.2. SELECCIÓN DE CANAL DE CONCERTACIÓN [ACTION]
- Rol Ejecutor: Operador de Tráfico y Concertaciones
- Desarrollo Operativo: El operador evalúa la orden y selecciona el canal operativo adecuado conforme al tipo de servicio contratado: concertación telefónica directa, correo electrónico interactivo o notificación automática.
- Evidencia AS-IS: "Tenemos 3 tipos de concertación: telefónica, por email o notificación automática."

4.3. ENVÍO DE PROPUESTA DE FECHA Y FRANJA HORARIA [ACTION]
- Rol Ejecutor: Operador de Tráfico y Concertaciones | Sistema/Soporte: Módulo de Concertaciones
- Desarrollo Operativo: En función de la capacidad de transporte disponible, el operador define una propuesta con fecha y franja horaria de entrega y la transmite formalmente al destinatario a través del canal elegido.
- Evidencia AS-IS: "Tú le tienes que decir cuándo ya estás sin disponibilidad de entregarle, enviando la propuesta de fecha y franja horaria."

4.4. RESPUESTA A LA PROPUESTA (ACEPTAR O POSPONER) [DECISION]
- Rol Ejecutor: Cliente / Destinatario | Sistema/Soporte: Canal de Notificación / Teléfono
- Desarrollo Operativo: El cliente destinatario evalúa la propuesta recibida y comunica su decisión: confirma y acepta la fecha y hora sugeridas, o bien solicita posponer la cita para una fecha posterior.
- Evidencia AS-IS: "Ante esa propuesta, el cliente puede hacer 2 cosas: aceptar o posponer."

4.5. CIERRE Y CONFIRMACIÓN DE CONCERTACIÓN [END]
- Rol Ejecutor: Operador de Tráfico y Concertaciones / Sistema de Gestión
- Desarrollo Operativo: Si el cliente acepta la propuesta, el sistema confirma la cita automáticamente, actualiza el estado a "Concertada" y finaliza la gestión sin requerir ninguna acción adicional por parte del operador.
- Evidencia AS-IS: "Si el cliente acepta la concertación, el sistema ya no te pedirá nada más y la cita queda confirmada."

4.6. GESTIÓN DE POSPOSICIÓN Y REPROGRAMACIÓN [ACTION]
- Rol Ejecutor: Operador de Tráfico y Concertaciones
- Desarrollo Operativo: Si el cliente solicita posponer la entrega, el operador registra en el sistema el motivo de la posposición y reabre la orden para coordinar una nueva propuesta horaria viable.
- Evidencia AS-IS: "Si pospone, registramos la posposición para reprogramar la fecha."

5. GESTIÓN DE EXCEPCIONES Y BIFURCACIONES
Bifurcación en paso 4.4: Si el cliente acepta, se deriva a 4.5 (Cierre). Si el cliente pospone, se deriva a 4.6 (Gestión de posposición) y retorna al envío de propuesta horaria.

6. REGISTROS DE CALIDAD Y AUDITORÍA
Se registran en la base de datos la fecha de envío de la propuesta, el canal utilizado, la respuesta del cliente (aceptada/pospuesta) y el timestamp de confirmación final.`,
    activities: [
      {
        id: 'step_1',
        stepNumber: 1,
        name: 'Identificación de expediciones pendientes de concertar',
        description:
          'El operador accede a la pestaña de concertaciones y visualiza el listado de expediciones pendientes de coordinar con el destinatario.',
        role: 'Operador de Tráfico y Concertaciones',
        system: 'Módulo de Concertaciones',
        type: 'start',
        sourceQuote: 'En esta pestaña concertaciones por email, ya te aparece el listado de expediciones pendientes de concertar.',
        status: 'confirmed',
        verifiedByHuman: true,
      },
      {
        id: 'step_2',
        stepNumber: 2,
        name: 'Selección de modalidad de concertación',
        description:
          'Se selecciona la vía de contacto aplicable: telefónica directa, correo electrónico interactivo o notificación automática.',
        role: 'Operador de Tráfico y Concertaciones',
        type: 'action',
        sourceQuote: 'Tenemos 3 tipos de concertación: telefónica, por email o notificación automática.',
        status: 'confirmed',
        verifiedByHuman: true,
      },
      {
        id: 'step_3',
        stepNumber: 3,
        name: 'Envío de propuesta de fecha y franja horaria',
        description:
          'El operador define la fecha y horario disponible de ruta y despacha la propuesta al destinatario.',
        role: 'Operador de Tráfico y Concertaciones',
        system: 'Módulo de Concertaciones',
        type: 'action',
        sourceQuote: 'Tú le tienes que decir cuándo ya estás sin disponibilidad de entregarle, enviando la propuesta de fecha y franja horaria.',
        status: 'confirmed',
        verifiedByHuman: true,
      },
      {
        id: 'step_4',
        stepNumber: 4,
        name: 'Respuesta a la propuesta de entrega (Aceptar o Posponer)',
        description:
          'El cliente destinatario evalúa la propuesta recibida y emite su respuesta: confirma la cita o pide posponerla.',
        role: 'Cliente / Destinatario',
        system: 'Portal de Notificación / Teléfono',
        type: 'decision',
        sourceQuote: 'Ante esa propuesta, el cliente puede hacer 2 cosas: aceptar o posponer.',
        status: 'confirmed',
        verifiedByHuman: true,
      },
      {
        id: 'step_5',
        stepNumber: 5,
        name: 'Cierre y confirmación de concertación',
        description:
          'Al aceptar el cliente, el sistema confirma la cita, actualiza el estado a Concertada y finaliza el proceso sin más pasos requeridos.',
        role: 'Operador de Tráfico y Concertaciones',
        system: 'Módulo de Concertaciones',
        type: 'end',
        sourceQuote: 'Si el cliente acepta la concertación, el sistema ya no te pedirá nada más y la cita queda confirmada.',
        status: 'confirmed',
        verifiedByHuman: true,
      },
      {
        id: 'step_6',
        stepNumber: 6,
        name: 'Gestión de posposición y reprogramación',
        description:
          'Si el cliente pospone, se registra la posposición en el sistema y se abre la orden para calcular una nueva fecha viable.',
        role: 'Operador de Tráfico y Concertaciones',
        system: 'Módulo de Concertaciones',
        type: 'action',
        sourceQuote: 'Si pospone, registramos la posposición para reprogramar la fecha.',
        status: 'confirmed',
        verifiedByHuman: true,
      },
    ],
    connections: [
      { from: 'step_1', to: 'step_2' },
      { from: 'step_2', to: 'step_3' },
      { from: 'step_3', to: 'step_4' },
      { from: 'step_4', to: 'step_5', label: 'Aceptada' },
      { from: 'step_4', to: 'step_6', label: 'Pospuesta' },
      { from: 'step_6', to: 'step_3', label: 'Reprogramar fecha' },
    ],
    validationQuestions: [
      {
        id: 'q_conc_1',
        question: '¿Cuántas posposiciones consecutivas se permiten antes de escalar la expedición a incidencias de entrega?',
        reason: 'Es necesario fijar un límite operativo para no retrasar indefinidamente la rotación de bodega.',
        criticality: 'critica',
        relatedActivityId: 'step_4',
        originalQuote: 'Si pospone, registramos la posposición para reprogramar la fecha.',
        status: 'pending',
      },
    ],
    privateImprovements: [
      {
        id: 'imp_conc_1',
        type: 'opportunity',
        title: 'Autogestión de citas con enlace de posposición directa',
        description: 'Permitir al cliente elegir directamente un día en un calendario digital interactivo en vez de requerir llamada o reenvío manual.',
        evidence: 'Tenemos 3 tipos de concertación: telefónica, por email o notificación automática.',
        impact: 'Reducción de llamadas operativas en más de un 60%.',
        proposal: 'Habilitar microportal con selector de franjas horarias en tiempo real.',
        priority: 'alta',
        status: 'detectado',
      },
    ],
    relatedUnits: ['Gestión y Revisión de Direcciones de Cliente'],
    history: [
      {
        version: '1.0',
        date: new Date().toLocaleDateString('es-ES'),
        author: 'Process AI',
        description: 'Extracción AS-IS inicial del relevamiento operativo.',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const [processes, setProcesses] = useState<ProcessModel[]>([
    initialDireccionesProcess,
    initialConcertacionesProcess,
  ]);
  const [activeProcessId, setActiveProcessId] = useState<string>('proc_direcciones');

  // Load client data from Firestore (Section 2.1 & Section 8)
  const loadClientData = useCallback(async (userId: string, targetClient: Client) => {
    try {
      setSyncState('saving');
      const loadedProcs = await loadProcessesFromFirestore(userId, targetClient.id);
      if (loadedProcs.length > 0) {
        setProcesses(loadedProcs);
        setActiveProcessId(loadedProcs[0].id);
      } else {
        // If this is defaultClient and no records in DB yet, seed baseline processes
        if (targetClient.id === defaultClient.id) {
          setProcesses([initialDireccionesProcess, initialConcertacionesProcess]);
          setActiveProcessId('proc_direcciones');
          // Persist baseline
          await saveProcessToFirestore({ ...initialDireccionesProcess, ownerId: userId });
          await saveProcessToFirestore({ ...initialConcertacionesProcess, ownerId: userId });
        } else {
          setProcesses([]);
          setActiveProcessId('');
        }
      }
      setSyncState('saved');
    } catch (err) {
      console.warn('Error loading client processes:', err);
      setSyncState('error');
    }
  }, []);

  // Track Firebase Auth state & load user data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          setSyncState('saving');
          const loadedClients = await loadClientsFromFirestore(user.uid);
          if (loadedClients.length > 0) {
            setClients(loadedClients);
            setActiveClient(loadedClients[0]);
            await loadClientData(user.uid, loadedClients[0]);
          } else {
            // First time user: save default client for them
            const userDefaultClient: Client = {
              ...defaultClient,
              ownerId: user.uid,
            };
            await saveClientToFirestore(userDefaultClient);
            setClients([userDefaultClient]);
            setActiveClient(userDefaultClient);
            await loadClientData(user.uid, userDefaultClient);
          }
          setSyncState('saved');
        } catch (err) {
          console.warn('Firestore initial sync note:', err);
          setSyncState('error');
        }
      } else {
        // Reset to initial local state when logged out
        setClients([defaultClient]);
        setActiveClient(defaultClient);
        setProcesses([initialLogisticsProcess, initialSapMigoProcess]);
        setActiveProcessId('proc_recepcion');
        setSyncState('idle');
      }
    });

    return () => unsubscribe();
  }, [loadClientData]);

  // Client Switching: Strictly isolated per client (Section 8)
  const handleSelectClient = async (selected: Client) => {
    setActiveClient(selected);
    if (currentUser) {
      await loadClientData(currentUser.uid, selected);
    } else {
      // Local filter for non-authenticated demo
      const clientProcs = processes.filter((p) => p.clientId === selected.id);
      if (clientProcs.length > 0) {
        setActiveProcessId(clientProcs[0].id);
      } else {
        setActiveProcessId('');
      }
    }
  };

  // Process Update with complete await persistence (Section 2.1)
  const handleUpdateProcess = async (updated: ProcessModel) => {
    setProcesses((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

    if (currentUser) {
      setSyncState('saving');
      try {
        await saveProcessToFirestore({
          ...updated,
          clientId: activeClient.id,
          ownerId: currentUser.uid,
        });
        setSyncState('saved');
      } catch (err) {
        console.error('Error saving process to Firestore:', err);
        setSyncState('error');
      }
    }
  };

  // Client Saving with complete await persistence (Section 2.1)
  const handleSaveClient = async (newClient: Client) => {
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === newClient.id);
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = newClient;
        return copy;
      }
      return [newClient, ...prev];
    });
    setActiveClient(newClient);

    if (currentUser) {
      setSyncState('saving');
      try {
        await saveClientToFirestore({
          ...newClient,
          ownerId: currentUser.uid,
        });
        setSyncState('saved');
      } catch (err) {
        console.error('Error saving client to Firestore:', err);
        setSyncState('error');
      }
    }
  };

  // Client Deletion with Firestore & cascading cleanup
  const handleDeleteClient = async (clientId: string) => {
    setSyncState('saving');
    try {
      if (currentUser) {
        await deleteClientFromFirestore(clientId, currentUser.uid);
      }

      // Update clients state
      const remainingClients = clients.filter((c) => c.id !== clientId);

      // If deleted client was active, switch to first remaining or default
      if (activeClient?.id === clientId) {
        if (remainingClients.length > 0) {
          const nextClient = remainingClients[0];
          setActiveClient(nextClient);
          if (currentUser) {
            await loadClientData(currentUser.uid, nextClient);
          } else {
            const nextProcs = processes.filter((p) => p.clientId === nextClient.id);
            setActiveProcessId(nextProcs[0]?.id || '');
          }
        } else {
          // No clients left - create a fresh default client
          const fallbackClient: Client = {
            id: `client_${Date.now()}`,
            ownerId: currentUser?.uid || 'default_user',
            name: 'Nueva Empresa',
            code: 'EMP',
            sector: 'General',
            isoStandard: 'ISO 9001:2026',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          if (currentUser) {
            await saveClientToFirestore(fallbackClient);
          }
          setClients([fallbackClient]);
          setActiveClient(fallbackClient);
          setProcesses([]);
          setActiveProcessId('');
          setSyncState('saved');
          return;
        }
      }

      setClients(remainingClients);
      // Remove any processes associated with the deleted client from current state
      setProcesses((prev) => prev.filter((p) => p.clientId !== clientId));
      setSyncState('saved');
    } catch (err) {
      console.error('Error deleting client:', err);
      setSyncState('error');
    }
  };

  // Append & Merge new processes (Section 2.1: Never wipe existing work)
  const handleAnalysisComplete = async (
    newProcesses: ProcessModel[],
    summary: string,
    targetIndex: number = 0
  ) => {
    setSyncState('saving');
    try {
      // 1. Create & save Survey record
      const newSurvey: Survey = {
        id: `survey_${Date.now()}`,
        clientId: activeClient.id,
        ownerId: currentUser?.uid || activeClient.ownerId,
        title: `Relevamiento ${activeClient.name}`,
        transcriptText: newProcesses[0]?.transcriptText || '',
        status: 'analyzed',
        interviewSummary: summary,
        identifiedUnitCount: newProcesses.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (currentUser) {
        await saveSurveyToFirestore(newSurvey);
      }

      // 2. Persist each new process
      for (const p of newProcesses) {
        const fullProc = {
          ...p,
          surveyId: newSurvey.id,
          clientId: activeClient.id,
          ownerId: currentUser?.uid || activeClient.ownerId,
        };
        if (currentUser) {
          await saveProcessToFirestore(fullProc);
        }
      }

      // 3. Merge into current processes list without wiping
      setProcesses((prev) => {
        const filtered = prev.filter((p) => !newProcesses.some((np) => np.id === p.id));
        return [...newProcesses, ...filtered];
      });

      if (newProcesses.length > 0) {
        const target = newProcesses[targetIndex] || newProcesses[0];
        setActiveProcessId(target.id);
      }
      setSyncState('saved');
      setActiveTab('processes');
    } catch (err) {
      console.error('Error persisting new analysis:', err);
      setSyncState('error');
    }
  };

  const handleRefreshWithGemini = async (
    process: ProcessModel,
    answeredQuestions: ValidationQuestion[]
  ) => {
    try {
      setSyncState('saving');
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/gemini/update-process-with-answers', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          currentProcess: process,
          answeredQuestions,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.updatedProcess) {
          await handleUpdateProcess({
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
      setSyncState('saved');
    } catch (err) {
      console.error('Error updating process with Gemini:', err);
      setSyncState('error');
    }
  };

  // Filter processes visible in this view strictly for active client (Section 8)
  const currentClientProcesses = processes.filter(
    (p) => p.clientId === activeClient.id || !p.clientId
  );

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

          {/* Active Client Badge (Section 8: Clear Organization Separation) */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs">
            <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-slate-400 font-medium">Empresa:</span>
            <span className="font-bold text-white truncate max-w-[150px]">{activeClient.name}</span>
            <span className="text-[10px] font-mono text-blue-300">[{activeClient.code}]</span>
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
              <span>Relevamiento</span>
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
              <span>Procesos ({currentClientProcesses.length})</span>
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

          {/* Sync Status & Authentication */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Sync State Indicator (Section 2.1) */}
            {syncState === 'saving' && (
              <span className="hidden sm:flex items-center gap-1.5 text-xs text-blue-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Guardando...</span>
              </span>
            )}
            {syncState === 'saved' && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Guardado</span>
              </span>
            )}
            {syncState === 'error' && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-rose-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Error al guardar</span>
              </span>
            )}

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
                <span>Acceder</span>
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
            onSelectClient={handleSelectClient}
            onSaveClient={handleSaveClient}
            onDeleteClient={handleDeleteClient}
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
            processes={currentClientProcesses}
            activeProcessId={activeProcessId}
            onSelectProcessId={(id) => setActiveProcessId(id)}
            onUpdateProcess={handleUpdateProcess}
            client={activeClient}
          />
        )}

        {activeTab === 'validation' && (
          <ValidationView
            processes={currentClientProcesses}
            onUpdateProcess={handleUpdateProcess}
            onRefreshWithGemini={handleRefreshWithGemini}
          />
        )}

        {activeTab === 'improvements' && (
          <ImprovementView
            processes={currentClientProcesses}
            onUpdateProcess={handleUpdateProcess}
          />
        )}

        {activeTab === 'export' && (
          <ExportView processes={currentClientProcesses} client={activeClient} />
        )}
      </main>
    </div>
  );
}
