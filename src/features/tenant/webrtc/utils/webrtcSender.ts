import { ICE_SERVERS } from "./config";
import { setupIceExchange } from "./iceExchange";
import type { PeerSignaling } from "./peerSignaling";

export function connectAsSender(
  stream: MediaStream,
  signaling: PeerSignaling,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

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
    await ice.flush();
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
