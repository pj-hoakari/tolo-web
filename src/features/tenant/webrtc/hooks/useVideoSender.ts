"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, useRef } from "react";
import {
  EDGES_COLLECTION,
  SESSIONS_SUBCOLLECTION,
  SIGNALS_SUBCOLLECTION,
} from "../utils/config";
import { getDb } from "../utils/firebase";
import { PeerSignalingAdapter } from "../utils/peerSignaling";
import { createFirestoreSignalingChannel } from "../utils/signalingChannel";
import { connectAsSender } from "../utils/webrtcSender";
import { useEdgePresence } from "./useEdgePresence";

interface SenderSession {
  pc: RTCPeerConnection;
  unsubscribe: () => void;
}

export interface VideoSenderController {
  active: boolean;
  edgeId: string | null;
}

function applyStream(pc: RTCPeerConnection, stream: MediaStream | null): void {
  const tracks = stream ? stream.getTracks() : [];
  for (const sender of pc.getSenders()) {
    const next = tracks.find((track) => track.kind === sender.track?.kind);
    sender
      .replaceTrack(next ?? null)
      .catch((e) => console.error("[webrtc-sender] replaceTrack", e));
  }
}

export function useVideoSender(params: {
  tenantId: string;
  eventId: string;
  stream: MediaStream | null;
}): VideoSenderController {
  const { tenantId, eventId, stream } = params;
  const active = stream !== null;

  const { edgeId } = useEdgePresence({ tenantId, eventId, enabled: active });

  const streamRef = useRef<MediaStream | null>(stream);
  const sessionsRef = useRef<Map<string, SenderSession>>(new Map());

  // 最新ストリームを保持し
  // 既存の視聴者接続にも replaceTrack で反映
  useEffect(() => {
    streamRef.current = stream;
    for (const { pc } of sessionsRef.current.values()) {
      applyStream(pc, stream);
    }
  }, [stream]);

  useEffect(() => {
    if (!edgeId || !active) {
      return;
    }

    const db = getDb();
    const sessionsCol = collection(
      db,
      EDGES_COLLECTION,
      edgeId,
      SESSIONS_SUBCOLLECTION,
    );
    const sessions = sessionsRef.current;

    const startSession = (sessionId: string) => {
      const currentStream = streamRef.current;
      if (!currentStream) {
        return;
      }
      const signalsRef = collection(
        db,
        EDGES_COLLECTION,
        edgeId,
        SESSIONS_SUBCOLLECTION,
        sessionId,
        SIGNALS_SUBCOLLECTION,
      );
      const channel = createFirestoreSignalingChannel({
        signalsRef,
        self: "edge",
      });
      const adapter = new PeerSignalingAdapter(channel.send);
      const pc = connectAsSender(currentStream, adapter);
      const unsubscribe = channel.listen((message) => adapter.deliver(message));
      sessions.set(sessionId, { pc, unsubscribe });
    };

    const closeSession = (sessionId: string) => {
      const session = sessions.get(sessionId);
      if (session) {
        session.unsubscribe();
        session.pc.close();
        sessions.delete(sessionId);
      }
    };

    const unsubscribeSessions = onSnapshot(sessionsCol, (snapshot) => {
      for (const change of snapshot.docChanges()) {
        const sessionId = change.doc.id;
        if (change.type === "removed") {
          closeSession(sessionId);
          continue;
        }
        if (change.type !== "added" && change.type !== "modified") {
          continue;
        }
        if (sessions.has(sessionId)) {
          continue;
        }
        if (change.doc.data().status === "requested") {
          startSession(sessionId);
        }
      }
    });

    return () => {
      unsubscribeSessions();
      for (const sessionId of [...sessions.keys()]) {
        closeSession(sessionId);
      }
    };
  }, [edgeId, active]);

  return { active, edgeId };
}
