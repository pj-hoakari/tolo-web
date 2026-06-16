import {
  type CollectionReference,
  collection,
  type DocumentReference,
  doc,
  type Firestore,
} from "firebase/firestore";
import {
  EDGES_COLLECTION,
  SESSIONS_SUBCOLLECTION,
  SIGNALS_SUBCOLLECTION,
} from "./config";

export function sessionsCollection(
  db: Firestore,
  edgeId: string,
): CollectionReference {
  return collection(db, EDGES_COLLECTION, edgeId, SESSIONS_SUBCOLLECTION);
}

export function sessionDoc(
  db: Firestore,
  edgeId: string,
  sessionId: string,
): DocumentReference {
  return doc(db, EDGES_COLLECTION, edgeId, SESSIONS_SUBCOLLECTION, sessionId);
}

export function signalsCollection(
  sessionRef: DocumentReference,
): CollectionReference {
  return collection(sessionRef, SIGNALS_SUBCOLLECTION);
}
