import type { PeerSignaling } from "./peerSignaling";

export interface IceExchange {
  /** remote description 確定までに貯めた candidate をまとめて追加 */
  flush: () => Promise<void>;
}

/**
 * ICE candidate の送受信を仲介する。
 * - ローカルで収集した candidate を signaling 経由で相手へ送る
 * - 相手からの candidate は remoteDescription 確定までバッファし、flush() でまとめて追加する
 *
 * sender / receiver で共通
 * setRemoteDescription の直後に flush() を呼ぶ
 */
export function setupIceExchange(
  pc: RTCPeerConnection,
  signaling: PeerSignaling,
): IceExchange {
  const pending: RTCIceCandidateInit[] = [];

  pc.addEventListener("icecandidate", (event) => {
    signaling.sendCandidate(event.candidate?.toJSON() ?? null);
  });

  signaling.onCandidate(async (candidate) => {
    if (!candidate) {
      return;
    }
    if (!pc.remoteDescription) {
      pending.push(candidate);
      return;
    }
    await pc.addIceCandidate(candidate);
  });

  return {
    async flush() {
      while (pending.length > 0) {
        const candidate = pending.shift();
        if (candidate) {
          await pc.addIceCandidate(candidate);
        }
      }
    },
  };
}
