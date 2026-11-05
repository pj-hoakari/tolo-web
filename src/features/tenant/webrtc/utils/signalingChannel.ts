import {
  addDoc,
  type CollectionReference,
  type DocumentReference,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { signalsCollection } from "./refs";

export type SignalMessage =
  | { kind: "description"; description: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit | null };

export type SignalingRole = "edge" | "console";

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

/**
 * Firestore はクラスインスタンスを受け付けない。`pc.localDescription` は
 * RTCSessionDescription インスタンスなので、送信前に plain object にする。
 * undefined も Firestore が拒否するため、候補の任意フィールドは詰める。
 */
function toPlainSignal(message: SignalMessage): SignalMessage {
  if (message.kind === "description") {
    return {
      kind: "description",
      description: {
        type: message.description.type,
        sdp: message.description.sdp ?? "",
      },
    };
  }
  if (message.candidate === null) {
    return { kind: "candidate", candidate: null };
  }
  const candidate: RTCIceCandidateInit = {
    candidate: message.candidate.candidate ?? "",
    sdpMid: message.candidate.sdpMid ?? null,
    sdpMLineIndex: message.candidate.sdpMLineIndex ?? null,
  };
  if (message.candidate.usernameFragment !== undefined) {
    candidate.usernameFragment = message.candidate.usernameFragment;
  }
  return { kind: "candidate", candidate };
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
        payload: toPlainSignal(message),
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

/**
 * ESP32 との経路で使うポーリング版。ESP 側は Firestore REST を一定間隔で
 * 読むため、ブラウザ側も同じ粒度に揃えて挙動を追いやすくする。
 * 既存の管理 UI ↔ 観測ページ経路は onSnapshot のままにする。
 */
export function createFirestorePollingSignalingChannel(params: {
  signalsRef: CollectionReference;
  self: SignalingRole;
  intervalMs?: number;
}): SignalingChannel {
  const { signalsRef, self, intervalMs = 300 } = params;
  const seen = new Set<string>();
  let stopped = false;
  let polling = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let handler: ((message: SignalMessage) => void) | null = null;

  const poll = async (): Promise<void> => {
    if (stopped || polling) {
      return;
    }
    polling = true;
    try {
      const snapshot = await getDocs(signalsRef);
      for (const document of snapshot.docs) {
        if (seen.has(document.id)) {
          continue;
        }
        seen.add(document.id);
        const data = document.data() as SignalDoc;
        if (data.from === self) {
          continue; // 自分が送ったものは無視
        }
        handler?.(data.payload);
      }
    } catch (error) {
      console.error("[firestore-signaling] poll", error);
    } finally {
      polling = false;
    }
  };

  return {
    send(message) {
      addDoc(signalsRef, {
        from: self,
        payload: toPlainSignal(message),
        createdAt: serverTimestamp(),
      }).catch((error) => console.error("[firestore-signaling] send", error));
    },
    listen(onMessage) {
      handler = onMessage;
      void poll();
      timer = setInterval(() => void poll(), intervalMs);
      return () => {
        stopped = true;
        handler = null;
        if (timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
}

export async function clearSession(
  sessionRef: DocumentReference,
): Promise<void> {
  const signalsRef = signalsCollection(sessionRef);
  await clearSignals(signalsRef);
  const batch = writeBatch(sessionRef.firestore);
  batch.delete(sessionRef);
  await batch.commit();
}

async function clearSignals(signalsRef: CollectionReference): Promise<void> {
  const snapshot = await getDocs(signalsRef);
  const batch = writeBatch(signalsRef.firestore);
  for (const docSnapshot of snapshot.docs) {
    batch.delete(docSnapshot.ref);
  }
  await batch.commit();
}
