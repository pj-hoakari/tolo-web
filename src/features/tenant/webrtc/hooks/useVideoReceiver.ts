"use client";

import type { DocumentReference } from "firebase/firestore";
import { useTranslations } from "next-intl";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  applyLineCounts,
  applySettings,
  type DetectionStores,
  useDetectionStores,
} from "@/features/tenant/detection/stores/detectionStore";
import { orpc } from "@/lib/orpc";
import type { ConnectionStatus } from "../type";
import {
  encodeDetectionControlRequest,
  parseDetectionControlNotice,
  sendOverDataChannel,
} from "../utils/detectionControl";
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
  /**
   * observation 側と同期している検出設定・検出結果・画面操作の状態。
   * 設定ストアへの書き込みはそのまま observation 側への変更要求になる。
   */
  stores: DetectionStores;
  /** 検出設定を一度でも受け取ったか。受け取るまでは設定 UI を出さない */
  settingsSynced: boolean;
  connectedEdgeId: string | null;
  connect: (edgeId: string) => void;
  disconnect: () => void;
}

export function useVideoReceiver(): VideoReceiverController {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [connectedEdgeId, setConnectedEdgeId] = useState<string | null>(null);
  const [settingsSynced, setSettingsSynced] = useState(false);
  const t = useTranslations("Webrtc.receiver");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const sessionRefRef = useRef<DocumentReference | null>(null);
  const detectionFrameRef = useRef<DetectionOverlayFrame | null>(null);
  const controlChannelRef = useRef<RTCDataChannel | null>(null);
  // observation から受け取った設定を反映している間の変更要求を止める
  const applyingRemoteSettingsRef = useRef(false);

  const stores = useDetectionStores();
  const { settingsStore, resultStore } = stores;

  // ローカルの設定変更をそのまま observation 側への変更要求として送る。
  // 手元のストアは先に更新してあるので，操作は往復を待たずに反映される。
  useEffect(
    () =>
      settingsStore.subscribe((settings) => {
        if (applyingRemoteSettingsRef.current) {
          return;
        }
        sendOverDataChannel(
          controlChannelRef.current,
          encodeDetectionControlRequest(settings),
        );
      }),
    [settingsStore],
  );

  const closePeer = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    detectionFrameRef.current = null;
    controlChannelRef.current = null;
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
    setSettingsSynced(false);
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

  const handleDetectionMessage = useCallback(
    (data: string) => {
      const frame = parseDetectionOverlayFrame(data);
      detectionFrameRef.current = frame;
      if (frame) {
        applyLineCounts(resultStore, frame.lineCounts);
      }
    },
    [resultStore],
  );

  const handleControlMessage = useCallback(
    (data: string) => {
      const notice = parseDetectionControlNotice(data);
      if (!notice) {
        return;
      }
      applyingRemoteSettingsRef.current = true;
      try {
        applySettings(settingsStore, notice.settings);
      } finally {
        applyingRemoteSettingsRef.current = false;
      }
      setSettingsSynced(true);
    },
    [settingsStore],
  );

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
        const pc = connectAsReceiver(adapter, {
          onRemoteStream: (remoteStream) => setStream(remoteStream),
          onDetectionMessage: handleDetectionMessage,
          onControlMessage: handleControlMessage,
          onControlChannelChange: (controlChannel) => {
            controlChannelRef.current = controlChannel;
          },
        });
        pcRef.current = pc;
        watchConnection(pc);

        unsubscribeRef.current = channel.listen((message) =>
          adapter.deliver(message),
        );
      };

      run().catch((e) => {
        setError(e instanceof Error ? e.message : t("connectError"));
        setStatus("error");
      });
    },
    [
      disconnect,
      watchConnection,
      handleDetectionMessage,
      handleControlMessage,
      t,
    ],
  );

  useEffect(() => disconnect, [disconnect]);

  return {
    status,
    error,
    stream,
    detectionFrameRef,
    stores,
    settingsSynced,
    connectedEdgeId,
    connect,
    disconnect,
  };
}
