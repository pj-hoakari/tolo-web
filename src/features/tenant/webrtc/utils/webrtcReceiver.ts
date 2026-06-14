import { ICE_SERVERS } from "./config";
import type { PeerSignaling } from "./peerSignaling";

export function connectAsReceiver(
  _signaling: PeerSignaling,
  _onRemoteStream: (stream: MediaStream) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  return pc;
}

// remote description 確定までに貯めた candidate をまとめて追加
// biome-ignore lint/correctness/noUnusedVariables: skeleton
async function flushCandidates(
  pc: RTCPeerConnection,
  pending: RTCIceCandidateInit[],
): Promise<void> {
  while (pending.length > 0) {
    const candidate = pending.shift();
    if (candidate) {
      await pc.addIceCandidate(candidate);
    }
  }
}
