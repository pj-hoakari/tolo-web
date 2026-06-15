import { ICE_SERVERS } from "./config";
import type { PeerSignaling } from "./peerSignaling";

export function connectAsSender(
  stream: MediaStream,
  signaling: PeerSignaling,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }

  pc.addEventListener("icecandidate", (event) => {
    signaling.sendCandidate(event.candidate?.toJSON() ?? null);
  });

  const pendingCandidates: RTCIceCandidateInit[] = [];

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
    await flushCandidates(pc, pendingCandidates);
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

  void sendOffer(pc, signaling);

  return pc;
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
