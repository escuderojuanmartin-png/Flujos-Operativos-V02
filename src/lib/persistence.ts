import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Client, Survey, ProcessModel, ProcessRevision } from '../types/process';

export type SyncState = 'idle' | 'saving' | 'saved' | 'error' | 'offline';

// --- CLIENTS ---
export async function saveClientToFirestore(client: Client): Promise<void> {
  const path = `clients/${client.id}`;
  try {
    const docRef = doc(db, 'clients', client.id);
    await setDoc(docRef, {
      ...client,
      updatedAt: new Date().toISOString(),
      _serverUpdatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function loadClientsFromFirestore(userId: string): Promise<Client[]> {
  const path = 'clients';
  try {
    const clientsCol = collection(db, path);
    const q = query(clientsCol, where('ownerId', '==', userId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as Client);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

export async function deleteClientFromFirestore(clientId: string, userId: string): Promise<void> {
  const path = `clients/${clientId}`;
  try {
    const docRef = doc(db, 'clients', clientId);
    await deleteDoc(docRef);

    // Cascade delete associated processes
    const processesCol = collection(db, 'processes');
    const qProc = query(processesCol, where('ownerId', '==', userId), where('clientId', '==', clientId));
    const procSnapshot = await getDocs(qProc);
    for (const d of procSnapshot.docs) {
      await deleteDoc(d.ref);
    }

    // Cascade delete associated surveys
    const surveysCol = collection(db, 'surveys');
    const qSurveys = query(surveysCol, where('ownerId', '==', userId), where('clientId', '==', clientId));
    const surveySnapshot = await getDocs(qSurveys);
    for (const d of surveySnapshot.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// --- SURVEYS (RELEVAMIENTOS) ---
export async function saveSurveyToFirestore(survey: Survey): Promise<void> {
  const path = `surveys/${survey.id}`;
  try {
    const docRef = doc(db, 'surveys', survey.id);
    await setDoc(docRef, {
      ...survey,
      updatedAt: new Date().toISOString(),
      _serverUpdatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function loadSurveysFromFirestore(userId: string, clientId?: string): Promise<Survey[]> {
  const path = 'surveys';
  try {
    const surveysCol = collection(db, path);
    let q = query(surveysCol, where('ownerId', '==', userId));
    if (clientId) {
      q = query(surveysCol, where('ownerId', '==', userId), where('clientId', '==', clientId));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as Survey);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

// --- PROCESSES ---
export async function saveProcessToFirestore(process: ProcessModel): Promise<void> {
  const path = `processes/${process.id}`;
  try {
    const docRef = doc(db, 'processes', process.id);
    await setDoc(docRef, {
      ...process,
      updatedAt: new Date().toISOString(),
      _serverUpdatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function loadProcessesFromFirestore(
  userId: string,
  clientId?: string
): Promise<ProcessModel[]> {
  const path = 'processes';
  try {
    const processesCol = collection(db, path);
    let q = query(processesCol, where('ownerId', '==', userId));
    if (clientId) {
      q = query(processesCol, where('ownerId', '==', userId), where('clientId', '==', clientId));
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as ProcessModel);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
    return [];
  }
}

export async function deleteProcessFromFirestore(processId: string): Promise<void> {
  const path = `processes/${processId}`;
  try {
    const docRef = doc(db, 'processes', processId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// Snapshot versioning support (Section 7)
export function createRevisionSnapshot(
  process: ProcessModel,
  author: string,
  changeDescription: string,
  isValidationSnapshot: boolean = false
): ProcessRevision {
  const currentVer = parseFloat(process.version || '1.0');
  const nextVer = isValidationSnapshot
    ? `${Math.floor(currentVer) + 1}.0`
    : (currentVer + 0.1).toFixed(1);

  return {
    version: nextVer,
    date: new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    author,
    description: changeDescription,
    snapshotData: JSON.parse(JSON.stringify(process)),
  };
}
