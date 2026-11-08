// @vitest-environment jsdom
import { ORPCError } from "@orpc/client";
import { signInWithCustomToken } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFirestoreSignalingChannel } from "@/features/tenant/webrtc/utils/signalingChannel";
import type { CameraConnection } from "@/server/router";
import { createEspCameraVideoSource } from "./espVideoSource";

vi.mock("firebase/auth", () => ({
  signInWithCustomToken: vi.fn(async () => {}),
}));
vi.mock("@/features/tenant/webrtc/utils/firebase", () => ({
  getNamedAuth: vi.fn(),
  getNamedDb: vi.fn(),
}));
vi.mock("@/features/tenant/webrtc/utils/refs", () => ({
  sessionDoc: vi.fn(() => ({})),
  signalsCollection: vi.fn(),
}));
vi.mock("@/features/tenant/webrtc/utils/signalingChannel", () => ({
  clearSession: vi.fn(async () => {}),
  createFirestoreSignalingChannel: vi.fn(() => ({
    send: vi.fn(),
    listen: () => vi.fn(),
  })),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(signInWithCustomToken).mockResolvedValue({} as never);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  vi.stubGlobal(
    "RTCPeerConnection",
    class {
      createDataChannel = vi.fn();
      addEventListener = vi.fn();
      close = vi.fn();
      createOffer = vi.fn().mockRejectedValue(new Error("offline"));
    },
  );
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    configurable: true,
    value: vi.fn(
      () =>
        ({
          getTracks: () => [{ stop: vi.fn() }],
          getVideoTracks: () => [{ requestFrame: vi.fn() }],
        }) as unknown as MediaStream,
    ),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLCanvasElement.prototype, "captureStream");
});

const connection = {
  sessionId: "session",
  firestoreToken: "token",
} as CameraConnection;
const options = {
  tenantId: "tenant",
  eventId: "event",
  edgeDeviceId: "camera",
  firebaseConfig: { projectId: "project", apiKey: "key" },
};

describe("ESP camera reconnect", () => {
  it("stops listening to signaling after the peer connects", async () => {
    const unsubscribe = vi.fn();
    vi.mocked(createFirestoreSignalingChannel).mockReturnValueOnce({
      send: vi.fn(),
      listen: () => unsubscribe,
    });
    class Peer extends EventTarget {
      connectionState = "new";
      iceGatheringState = "complete";
      localDescription = { type: "offer", sdp: "offer" };
      createDataChannel = vi.fn();
      close = vi.fn();
      createOffer = vi.fn(async () => this.localDescription);
      setLocalDescription = vi.fn(async () => {});
    }
    let peer: Peer | undefined;
    vi.stubGlobal(
      "RTCPeerConnection",
      class extends Peer {
        constructor() {
          super();
          peer = this;
        }
      },
    );
    const source = createEspCameraVideoSource({
      ...options,
      requestConnection: vi.fn().mockResolvedValue(connection),
    });
    await source.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(unsubscribe).not.toHaveBeenCalled();
    if (!peer) throw new Error("peer was not created");
    peer.connectionState = "connected";
    peer.dispatchEvent(new Event("connectionstatechange"));
    expect(unsubscribe).toHaveBeenCalledOnce();
    source.close();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
  it.each(["CONNECTION_AUTHORIZATION_REQUIRED", "CAMERA_NOT_DELEGATED"])(
    "stops retry timers for %s",
    async (code) => {
      const cause = new ORPCError("PRECONDITION_FAILED", { data: { code } });
      const requestConnection = vi
        .fn()
        .mockResolvedValueOnce(connection)
        .mockRejectedValue(cause);
      const onError = vi.fn();
      const source = createEspCameraVideoSource({
        ...options,
        requestConnection,
        onError,
      });
      await source.open();
      await vi.advanceTimersByTimeAsync(2_000);
      expect(onError).toHaveBeenCalledExactlyOnceWith(cause);
      expect(vi.getTimerCount()).toBe(0);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(requestConnection).toHaveBeenCalledTimes(2);
      source.close();
    },
  );

  it("reports authorization errors from reconnect sign-in", async () => {
    const cause = new ORPCError("PRECONDITION_FAILED", {
      data: { code: "CAMERA_NOT_DELEGATED" },
    });
    vi.mocked(signInWithCustomToken)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(cause);
    const onError = vi.fn();
    const source = createEspCameraVideoSource({
      ...options,
      requestConnection: vi.fn().mockResolvedValue(connection),
      onError,
    });
    await source.open();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onError).toHaveBeenCalledExactlyOnceWith(cause);
    expect(vi.getTimerCount()).toBe(0);
    source.close();
  });

  it("backs off after transient connection failures", async () => {
    const requestConnection = vi
      .fn()
      .mockResolvedValueOnce(connection)
      .mockRejectedValue(new Error("offline"));
    const onError = vi.fn();
    const source = createEspCameraVideoSource({
      ...options,
      requestConnection,
      onError,
    });
    await source.open();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(requestConnection).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(3_999);
    expect(requestConnection).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(requestConnection).toHaveBeenCalledTimes(3);
    expect(onError).not.toHaveBeenCalled();
    source.close();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("ESP camera observation mode", () => {
  const h264 = (fmtp: string) => ({
    mimeType: "video/H264",
    clockRate: 90000,
    sdpFmtpLine: fmtp,
  });
  const baseline = h264(
    "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
  );
  const high = h264(
    "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640034",
  );
  const singleNal = h264(
    "level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f",
  );

  function stubPeer() {
    const setCodecPreferences = vi.fn();
    const peers: Peer[] = [];
    class Peer extends EventTarget {
      connectionState = "new";
      iceGatheringState = "complete";
      localDescription = { type: "offer", sdp: "offer" };
      createDataChannel = vi.fn();
      addTransceiver = vi.fn(() => ({ setCodecPreferences }));
      close = vi.fn();
      createOffer = vi.fn(async () => this.localDescription);
      setLocalDescription = vi.fn(async () => {});
      getStats = vi.fn(async () => new Map());
      constructor() {
        super();
        peers.push(this);
      }
    }
    vi.stubGlobal("RTCPeerConnection", Peer);
    vi.stubGlobal(
      "MediaStream",
      class {
        private tracks: MediaStreamTrack[] = [];
        getTracks = () => [...this.tracks];
        getVideoTracks = () => [...this.tracks];
        addTrack = (track: MediaStreamTrack) => this.tracks.push(track);
        removeTrack = (track: MediaStreamTrack) => {
          this.tracks = this.tracks.filter((entry) => entry !== track);
        };
      },
    );
    vi.stubGlobal("RTCRtpReceiver", {
      getCapabilities: () => ({
        codecs: [
          { mimeType: "video/VP8", clockRate: 90000 },
          singleNal,
          high,
          baseline,
        ],
      }),
    });
    return { peers, setCodecPreferences };
  }

  it("keeps the burst offer free of video transceivers", async () => {
    const { peers } = stubPeer();
    const source = createEspCameraVideoSource({
      ...options,
      requestConnection: vi.fn().mockResolvedValue(connection),
    });
    await source.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(peers[0]?.createDataChannel).toHaveBeenCalledWith("control");
    expect(peers[0]?.addTransceiver).not.toHaveBeenCalled();
    source.close();
  });

  it("receives H.264 video as a stream in continuous mode", async () => {
    const { peers, setCodecPreferences } = stubPeer();
    const source = createEspCameraVideoSource({
      ...options,
      observationMode: "continuous",
      requestConnection: vi.fn().mockResolvedValue(connection),
    });
    const descriptor = await source.open();
    await vi.advanceTimersByTimeAsync(0);
    const peer = peers[0];
    if (!peer || descriptor.kind !== "stream") throw new Error("not opened");
    expect(peer.createDataChannel).toHaveBeenCalledWith("control");
    expect(peer.addTransceiver).toHaveBeenCalledWith("video", {
      direction: "recvonly",
    });
    expect(setCodecPreferences).toHaveBeenCalledWith([
      baseline,
      high,
      singleNal,
    ]);

    const first = {
      kind: "video",
      stop: vi.fn(),
    } as unknown as MediaStreamTrack;
    const second = {
      kind: "video",
      stop: vi.fn(),
    } as unknown as MediaStreamTrack;
    for (const track of [first, second]) {
      peer.dispatchEvent(Object.assign(new Event("track"), { track }));
    }
    expect(descriptor.stream.getVideoTracks()).toEqual([second]);

    expect(source.lastFrameAt()).toBeNull();
    peer.connectionState = "connected";
    peer.dispatchEvent(new Event("connectionstatechange"));
    peer.getStats.mockResolvedValue(
      new Map([
        ["v", { type: "inbound-rtp", kind: "video", framesDecoded: 3 }],
      ]),
    );
    await vi.advanceTimersByTimeAsync(2_000);
    expect(source.lastFrameAt()).not.toBeNull();
    source.close();
  });
});
