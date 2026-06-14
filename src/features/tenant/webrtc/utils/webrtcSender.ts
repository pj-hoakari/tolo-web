import { ICE_SERVERS } from "./config";
import type { PeerSignaling } from "./peerSignaling";

export function connectAsSender(
  _stream: MediaStream,
  _signaling: PeerSignaling,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  return pc;
}

// biome-ignore lint/correctness/noUnusedVariables: skeleton
async function sendOffer(
  _pc: RTCPeerConnection,
  _signaling: PeerSignaling,
): Promise<void> {
  try {
    console.log("[webrtc-sender] creating offer...");
  } catch (error) {
    console.error("[webrtc-sender] failed to create/send offer", error);
  }
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
