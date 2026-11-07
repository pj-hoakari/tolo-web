// @vitest-environment jsdom
import { ORPCError } from "@orpc/client";
import { signInWithCustomToken } from "firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  createFirestorePollingSignalingChannel: vi.fn(() => ({
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
