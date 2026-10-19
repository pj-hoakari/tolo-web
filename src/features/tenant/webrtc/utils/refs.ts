import {
  type CollectionReference,
  collection,
  type DocumentReference,
  doc,
  type Firestore,
} from "firebase/firestore";
import {
  EDGE_DEVICES_SUBCOLLECTION,
  EVENTS_SUBCOLLECTION,
  SESSIONS_SUBCOLLECTION,
  SIGNALS_SUBCOLLECTION,
  TENANTS_COLLECTION,
} from "./config";

export function sessionsCollection(
  db: Firestore,
  tenantId: string,
  eventId: string,
  edgeId: string,
): CollectionReference {
  return collection(
    db,
    TENANTS_COLLECTION,
    tenantId,
    EVENTS_SUBCOLLECTION,
    eventId,
    EDGE_DEVICES_SUBCOLLECTION,
    edgeId,
    SESSIONS_SUBCOLLECTION,
  );
}

export function sessionDoc(
  db: Firestore,
  tenantId: string,
  eventId: string,
  edgeId: string,
  sessionId: string,
): DocumentReference {
  return doc(sessionsCollection(db, tenantId, eventId, edgeId), sessionId);
}

export function signalsCollection(
  sessionRef: DocumentReference,
): CollectionReference {
  return collection(sessionRef, SIGNALS_SUBCOLLECTION);
}
