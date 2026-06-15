"use client";

import {
  createFirestoreSignalingChannel,
  type WebRtcStatus,
} from "./firestoreSignaling";
import { RTC_CONFIG } from "./rtcConfig";

export type WebRtcSender = {
  stop: () => void;
};

export type WebRtcSenderOptions = {
  roomId: string;
  stream: MediaStream;
  onStatusChange?: (status: WebRtcStatus) => void;
  onError?: (message: string) => void;
};

export async function startWebRtcSender({
  roomId,
  stream,
  onStatusChange,
  onError,
}: WebRtcSenderOptions): Promise<WebRtcSender> {
  onStatusChange?.("connecting");

  const signaling = await createFirestoreSignalingChannel(roomId, "sender");
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

  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      void signaling
        .send({ type: "candidate", data: event.candidate.toJSON() })
        .catch((error) => {
          console.error("[webrtc-sender] failed to send candidate", error);
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
      if (message.type === "answer") {
        await pc.setRemoteDescription(message.data);
        await flushCandidates();
        return;
      }
      if (message.type === "candidate") {
        await addCandidate(message.data);
      }
    } catch (error) {
      console.error("[webrtc-sender] failed to handle signal", error);
      onError?.("WebRTCシグナリングの処理に失敗しました");
      onStatusChange?.("error");
    }
  });

  try {
    onStatusChange?.("negotiating");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await signaling.send({ type: "offer", data: offer });
  } catch (error) {
    console.error("[webrtc-sender] failed to send offer", error);
    onError?.("WebRTC接続要求の送信に失敗しました");
    onStatusChange?.("error");
    pc.close();
    signaling.close();
    throw error;
  }

  return {
    stop() {
      pc.close();
      signaling.close();
      onStatusChange?.("idle");
    },
  };
}
