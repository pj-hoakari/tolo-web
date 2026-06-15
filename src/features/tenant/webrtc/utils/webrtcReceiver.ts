"use client";

import {
  createFirestoreSignalingChannel,
  type WebRtcStatus,
} from "./firestoreSignaling";
import { RTC_CONFIG } from "./rtcConfig";

export type WebRtcReceiver = {
  stop: () => void;
};

export type WebRtcReceiverOptions = {
  roomId: string;
  onRemoteStream: (stream: MediaStream) => void;
  onStatusChange?: (status: WebRtcStatus) => void;
  onError?: (message: string) => void;
};

export async function startWebRtcReceiver({
  roomId,
  onRemoteStream,
  onStatusChange,
  onError,
}: WebRtcReceiverOptions): Promise<WebRtcReceiver> {
  onStatusChange?.("connecting");

  const signaling = await createFirestoreSignalingChannel(roomId, "receiver");
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const pendingCandidates: RTCIceCandidateInit[] = [];

  const addCandidate = async (candidate: RTCIceCandidateInit) => {
    if (!pc.remoteDescription) {
      pendingCandidates.push(candidate);
      return;
    }
    await pc.addIceCandidate(candidate);
  };

  const flushCandidates = async () => {
    while (pendingCandidates.length > 0) {
      const candidate = pendingCandidates.shift();
      if (candidate) {
        await pc.addIceCandidate(candidate);
      }
    }
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      onRemoteStream(stream);
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      void signaling
        .send({ type: "candidate", data: event.candidate.toJSON() })
        .catch((error) => {
          console.error("[webrtc-receiver] failed to send candidate", error);
          onError?.("通信候補の送信に失敗しました");
          onStatusChange?.("error");
        });
    }
  };

  pc.onconnectionstatechange = () => {
    switch (pc.connectionState) {
      case "connected":
        onStatusChange?.("connected");
        break;
      case "failed":
        onError?.("WebRTC接続に失敗しました");
        onStatusChange?.("error");
        break;
      case "closed":
      case "disconnected":
        onStatusChange?.("disconnected");
        break;
    }
  };

  signaling.onMessage(async (message) => {
    try {
      if (message.type === "offer") {
        onStatusChange?.("negotiating");
        await pc.setRemoteDescription(message.data);
        await flushCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await signaling.send({ type: "answer", data: answer });
        return;
      }
      if (message.type === "candidate") {
        await addCandidate(message.data);
      }
    } catch (error) {
      console.error("[webrtc-receiver] failed to handle signal", error);
      onError?.("WebRTCシグナリングの処理に失敗しました");
      onStatusChange?.("error");
    }
  });

  onStatusChange?.("waiting");

  return {
    stop() {
      pc.close();
      signaling.close();
      onStatusChange?.("idle");
    },
  };
}
