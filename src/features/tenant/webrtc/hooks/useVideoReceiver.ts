"use client";

import type { DocumentReference } from "firebase/firestore";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { orpc } from "@/lib/orpc";
import type { ConnectionStatus } from "../type";
import {
  type DetectionOverlayFrame,
  parseDetectionOverlayFrame,
} from "../utils/detectionOverlay";
import { getDb } from "../utils/firebase";
import { PeerSignalingAdapter } from "../utils/peerSignaling";
import { sessionDoc, signalsCollection } from "../utils/refs";
import {
  clearSession,
  createFirestoreSignalingChannel,
} from "../utils/signalingChannel";
import { connectAsReceiver } from "../utils/webrtcReceiver";

export interface VideoReceiverController {
  status: ConnectionStatus;
  error: string | null;
  stream: MediaStream | null;
  /**
   * 受信した最新の検出結果。描画側が rAF で参照する前提の ref で，
   * メッセージ受信のたびに再レンダリングは発生させない。
   */
  detectionFrameRef: RefObject<DetectionOverlayFrame | null>;
  connectedEdgeId: string | null;
  connect: (edgeId: string) => void;
  disconnect: () => void;
}

export function useVideoReceiver(): VideoReceiverController {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectedEdgeId, setConnectedEdgeId] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const sessionRefRef = useRef<DocumentReference | null>(null);
  const detectionFrameRef = useRef<DetectionOverlayFrame | null>(null);

  const closePeer = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    detectionFrameRef.current = null;
  }, []);

  const disconnect = useCallback(() => {
    closePeer();
    const sessionRef = sessionRefRef.current;
    if (sessionRef) {
      clearSession(sessionRef).catch((e) =>
        console.error("failed to clear session", e),
      );
      sessionRefRef.current = null;
    }
    setStream(null);
    setConnectedEdgeId(null);
    setStatus("idle");
  }, [closePeer]);

  const watchConnection = useCallback((pc: RTCPeerConnection) => {
    pc.addEventListener("connectionstatechange", () => {
      switch (pc.connectionState) {
        case "connected":
          setStatus("connected");
          break;
        case "failed":
        case "disconnected":
        case "closed":
          setStatus((prev) => (prev === "idle" ? prev : "disconnected"));
          break;
      }
    });
  }, []);

  const connect = useCallback(
    (edgeId: string) => {
      disconnect();
      setError(null);
      setStatus("connecting");
      setConnectedEdgeId(edgeId);

      const run = async () => {
        const { sessionId } = await orpc.signaling.requestConnection({
          edgeId,
        });
        const db = getDb();
        const sessionRef = sessionDoc(db, edgeId, sessionId);
        sessionRefRef.current = sessionRef;
        const signalsRef = signalsCollection(sessionRef);
        const channel = createFirestoreSignalingChannel({
          signalsRef,
          self: "management",
        });
        const adapter = new PeerSignalingAdapter(channel.send);

        setStatus("negotiating");
        const pc = connectAsReceiver(
          adapter,
          (remoteStream) => setStream(remoteStream),
          (data) => {
            detectionFrameRef.current = parseDetectionOverlayFrame(data);
          },
        );
        pcRef.current = pc;
        watchConnection(pc);

        unsubscribeRef.current = channel.listen((message) =>
          adapter.deliver(message),
        );
      };

      run().catch((e) => {
        setError(e instanceof Error ? e.message : "接続に失敗しました");
        setStatus("error");
      });
    },
    [disconnect, watchConnection],
  );

  useEffect(() => disconnect, [disconnect]);

  return {
    status,
    error,
    stream,
    detectionFrameRef,
    connectedEdgeId,
    connect,
    disconnect,
  };
}
