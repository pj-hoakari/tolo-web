import {
  addDoc,
  type CollectionReference,
  collection,
  type DocumentReference,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { SIGNALS_SUBCOLLECTION } from "./config";

export type SignalMessage =
  | { kind: "description"; description: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit | null };

export type SignalingRole = "edge" | "management";

export interface SignalingChannel {
  /** シグナリングメッセージを相手へ送る */
  send: (message: SignalMessage) => void;
  /** 相手からのメッセージ購読を開始，返り値で購読を解除する。 */
  listen: (onMessage: (message: SignalMessage) => void) => () => void;
}

interface SignalDoc {
  from: SignalingRole;
  payload: SignalMessage;
}

export function createFirestoreSignalingChannel(params: {
  signalsRef: CollectionReference;
  self: SignalingRole;
}): SignalingChannel {
  const { signalsRef, self } = params;

  return {
    send(message) {
      addDoc(signalsRef, {
        from: self,
        payload: message,
        createdAt: serverTimestamp(),
      }).catch((error) => console.error("[firestore-signaling] send", error));
    },
    listen(onMessage) {
      return onSnapshot(signalsRef, (snapshot) => {
        for (const change of snapshot.docChanges()) {
          if (change.type !== "added") {
            continue;
          }
          const data = change.doc.data() as SignalDoc;
          if (data.from === self) {
            continue; // 自分が送ったものは無視
          }
          onMessage(data.payload);
        }
      });
    },
  };
}

export async function clearSession(
  sessionRef: DocumentReference,
): Promise<void> {
  const signalsRef = collection(sessionRef, SIGNALS_SUBCOLLECTION);
  await clearSignals(signalsRef);
  const batch = writeBatch(sessionRef.firestore);
  batch.delete(sessionRef);
  await batch.commit();
}

export async function clearSignals(
  signalsRef: CollectionReference,
): Promise<void> {
  const snapshot = await getDocs(signalsRef);
  const batch = writeBatch(signalsRef.firestore);
  for (const docSnapshot of snapshot.docs) {
    batch.delete(docSnapshot.ref);
  }
  await batch.commit();
}
