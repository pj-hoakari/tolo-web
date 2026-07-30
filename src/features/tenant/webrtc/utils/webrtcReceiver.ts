import { ICE_SERVERS } from "./config";
import { DETECTION_CONTROL_CHANNEL_LABEL } from "./detectionControl";
import { setupIceExchange } from "./iceExchange";
import type { PeerSignaling } from "./peerSignaling";

export type ReceiverHandlers = {
  onRemoteStream: (stream: MediaStream) => void;
  /** 検出結果（ボックス・カウントライン）の 1 フレーム分 */
  onDetectionMessage?: (data: string) => void;
  /** 検出設定チャンネルのメッセージ */
  onControlMessage?: (data: string) => void;
  /** 検出設定チャンネルの開閉。送信側として使うために受け取る */
  onControlChannelChange?: (channel: RTCDataChannel | null) => void;
};

export function connectAsReceiver(
  signaling: PeerSignaling,
  handlers: ReceiverHandlers,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const remoteStream = new MediaStream();

  pc.addEventListener("track", (event) => {
    if (event.streams[0]) {
      handlers.onRemoteStream(event.streams[0]);
      return;
    }
    remoteStream.addTrack(event.track);
    handlers.onRemoteStream(remoteStream);
  });

  // 送信側が開くチャンネルを label で振り分ける
  pc.addEventListener("datachannel", (event) => {
    const channel = event.channel;

    if (channel.label === DETECTION_CONTROL_CHANNEL_LABEL) {
      channel.addEventListener("message", (messageEvent) => {
        if (typeof messageEvent.data === "string") {
          handlers.onControlMessage?.(messageEvent.data);
        }
      });
      channel.addEventListener("open", () =>
        handlers.onControlChannelChange?.(channel),
      );
      channel.addEventListener("close", () =>
        handlers.onControlChannelChange?.(null),
      );
      if (channel.readyState === "open") {
        handlers.onControlChannelChange?.(channel);
      }
      return;
    }

    channel.addEventListener("message", (messageEvent) => {
      if (typeof messageEvent.data === "string") {
        handlers.onDetectionMessage?.(messageEvent.data);
      }
    });
  });

  const ice = setupIceExchange(pc, signaling);

  signaling.onDescription(async (description) => {
    if (
      description.type !== "offer" ||
      pc.signalingState !== "stable" ||
      pc.remoteDescription
    ) {
      return;
    }
    await pc.setRemoteDescription(description);
    await ice.flush();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    signaling.sendDescription(answer);
  });

  return pc;
}
