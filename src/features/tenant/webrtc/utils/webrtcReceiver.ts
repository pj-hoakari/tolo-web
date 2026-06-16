import { ICE_SERVERS } from "./config";
import { setupIceExchange } from "./iceExchange";
import type { PeerSignaling } from "./peerSignaling";

export function connectAsReceiver(
  signaling: PeerSignaling,
  onRemoteStream: (stream: MediaStream) => void,
): RTCPeerConnection {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const remoteStream = new MediaStream();

  pc.addEventListener("track", (event) => {
    if (event.streams[0]) {
      onRemoteStream(event.streams[0]);
      return;
    }
    remoteStream.addTrack(event.track);
    onRemoteStream(remoteStream);
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
