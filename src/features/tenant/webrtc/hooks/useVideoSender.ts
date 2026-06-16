"use client";

import { onSnapshot } from "firebase/firestore";
import { useEffect, useRef } from "react";
import { getDb } from "../utils/firebase";
import { PeerSignalingAdapter } from "../utils/peerSignaling";
import {
  sessionDoc,
  sessionsCollection,
  signalsCollection,
} from "../utils/refs";
import {
  clearSignals,
  createFirestoreSignalingChannel,
} from "../utils/signalingChannel";
import { connectAsSender } from "../utils/webrtcSender";
import { useEdgePresence } from "./useEdgePresence";

interface SenderSession {
  pc: RTCPeerConnection;
  unsubscribe: () => void;
}

interface SessionsListener {
  edgeId: string;
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
  const startingSessionIdsRef = useRef<Set<string>>(new Set());
  const effectRunIdRef = useRef(0);
  const sessionsListenerRef = useRef<SessionsListener | null>(null);

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

    const effectRunId = ++effectRunIdRef.current;
    console.debug("[webrtc-sender] sessions effect setup", {
      effectRunId,
      edgeId,
    });

    sessionsListenerRef.current?.unsubscribe();
    sessionsListenerRef.current = null;

    const db = getDb();
    const sessionsCol = sessionsCollection(db, edgeId);
    const sessions = sessionsRef.current;
    const startingSessionIds = startingSessionIdsRef.current;
    let disposed = false;

    const startSession = async (sessionId: string) => {
      if (sessions.has(sessionId) || startingSessionIds.has(sessionId)) {
        console.debug("[webrtc-sender] skip duplicate session start", {
          effectRunId,
          sessionId,
          hasSession: sessions.has(sessionId),
          isStarting: startingSessionIds.has(sessionId),
        });
        return;
      }
      console.debug("[webrtc-sender] start session", {
        effectRunId,
        sessionId,
      });
      startingSessionIds.add(sessionId);
      const currentStream = streamRef.current;
      if (!currentStream || disposed) {
        startingSessionIds.delete(sessionId);
        return;
      }
      try {
        const signalsRef = signalsCollection(sessionDoc(db, edgeId, sessionId));
        await clearSignals(signalsRef);
        if (disposed) {
          return;
        }
        const channel = createFirestoreSignalingChannel({
          signalsRef,
          self: "edge",
        });
        const adapter = new PeerSignalingAdapter(channel.send);
        const pc = connectAsSender(currentStream, adapter);
        const unsubscribe = channel.listen((message) =>
          adapter.deliver(message),
        );
        if (disposed) {
          unsubscribe();
          pc.close();
          return;
        }
        sessions.set(sessionId, { pc, unsubscribe });
      } finally {
        startingSessionIds.delete(sessionId);
      }
    };

    const closeSession = (sessionId: string) => {
      const session = sessions.get(sessionId);
      if (session) {
        session.unsubscribe();
        session.pc.close();
        sessions.delete(sessionId);
      }
      startingSessionIds.delete(sessionId);
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
          startSession(sessionId).catch((e) =>
            console.error("[webrtc-sender] start session", e),
          );
        }
      }
    });
    sessionsListenerRef.current = {
      edgeId,
      unsubscribe: unsubscribeSessions,
    };

    return () => {
      disposed = true;
      console.debug("[webrtc-sender] sessions effect cleanup", {
        effectRunId,
        edgeId,
        sessionCount: sessions.size,
      });
      unsubscribeSessions();
      if (sessionsListenerRef.current?.unsubscribe === unsubscribeSessions) {
        sessionsListenerRef.current = null;
      }
      for (const sessionId of [...sessions.keys()]) {
        closeSession(sessionId);
      }
      startingSessionIds.clear();
    };
  }, [edgeId, active]);

  return { active, edgeId };
}
