import { ICE_SERVERS } from "./config";
import type { PeerSignaling } from "./peerSignaling";

export function connectAsReceiver(
  signaling: PeerSignaling,
  onRemoteStream: (stream: MediaStream) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const remoteStream = new MediaStream();
  const pendingCandidates: RTCIceCandidateInit[] = [];

  pc.addEventListener("track", (event) => {
    if (event.streams[0]) {
      onRemoteStream(event.streams[0]);
      return;
    }
    remoteStream.addTrack(event.track);
    onRemoteStream(remoteStream);
  });

  pc.addEventListener("icecandidate", (event) => {
    signaling.sendCandidate(event.candidate?.toJSON() ?? null);
  });

  signaling.onDescription(async (description) => {
    if (
      description.type !== "offer" ||
      pc.signalingState !== "stable" ||
      pc.remoteDescription
    ) {
      return;
    }
    await pc.setRemoteDescription(description);
    await flushCandidates(pc, pendingCandidates);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    signaling.sendDescription(answer);
  });

  signaling.onCandidate(async (candidate) => {
    if (!candidate) {
      return;
    }
    if (!pc.remoteDescription) {
      pendingCandidates.push(candidate);
      return;
    }
    await pc.addIceCandidate(candidate);
  });

  return pc;
}

// remote description 確定までに貯めた candidate をまとめて追加
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
