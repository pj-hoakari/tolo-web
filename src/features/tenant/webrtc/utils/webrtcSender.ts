import { ICE_SERVERS } from "./config";
import { setupIceExchange } from "./iceExchange";
import type { PeerSignaling } from "./peerSignaling";

export const DETECTION_DATA_CHANNEL_LABEL = "detections";

// 帯域が逼迫したときにエンコーダが過剰なビットレートを出して
// ブロックノイズ化するのを防ぐための上限
const MAX_VIDEO_BITRATE = 2_500_000;
const MAX_VIDEO_FRAMERATE = 30;

export interface SenderConnection {
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel;
}

export function connectAsSender(
  stream: MediaStream,
  signaling: PeerSignaling,
): SenderConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // 検出結果（ボックス・カウントライン）は映像に焼き込まず
  // DataChannel で送り，受信側で描画する
  const dataChannel = pc.createDataChannel(DETECTION_DATA_CHANNEL_LABEL);

  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }

  const ice = setupIceExchange(pc, signaling);

  signaling.onDescription(async (description) => {
    if (description.type !== "answer") {
      return;
    }
    if (pc.signalingState !== "have-local-offer") {
      console.warn(
        "[webrtc-sender] skip answer because signalingState is",
        pc.signalingState,
      );
      return;
    }
    if (pc.remoteDescription) {
      console.warn(
        "[webrtc-sender] skip answer because remoteDescription exists",
      );
      return;
    }
    await pc.setRemoteDescription(description);
    void applyVideoEncodingLimits(pc);
    await ice.flush();
  });

  void sendOffer(pc, signaling);

  return { pc, dataChannel };
}

// ネゴシエーション完了後（encodings が確定してから）に呼ぶ
async function applyVideoEncodingLimits(pc: RTCPeerConnection): Promise<void> {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind !== "video") {
      continue;
    }
    try {
      const parameters = sender.getParameters();
      if (parameters.encodings.length === 0) {
        continue;
      }
      parameters.degradationPreference = "balanced";
      for (const encoding of parameters.encodings) {
        encoding.maxBitrate = MAX_VIDEO_BITRATE;
        encoding.maxFramerate = MAX_VIDEO_FRAMERATE;
      }
      await sender.setParameters(parameters);
    } catch (error) {
      console.warn("[webrtc-sender] failed to apply encoding limits", error);
    }
  }
}

async function sendOffer(
  pc: RTCPeerConnection,
  signaling: PeerSignaling,
): Promise<void> {
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    signaling.sendDescription(offer);
  } catch (error) {
    console.error("[webrtc-sender] failed to create/send offer", error);
  }
}
