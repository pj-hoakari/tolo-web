import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { EDGES_COLLECTION } from "./config";
import { getDb } from "./firebase";

export const HEARTBEAT_INTERVAL_MS = 10_000;

export function writeEdgePresence(edgeId: string): Promise<void> {
  const ref = doc(getDb(), EDGES_COLLECTION, edgeId);
  return setDoc(
    ref,
    { id: edgeId, lastSeenAt: serverTimestamp() },
    { merge: true },
  );
}
