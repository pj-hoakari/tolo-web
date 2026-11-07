import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CameraAccessError,
  createCameraVideoSource,
  FRAME_STALE_AFTER_MS,
  isFrameFresh,
} from "./videoSource";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubGetUserMediaRejecting(error: unknown) {
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(error) },
  });
}

describe("createCameraVideoSource", () => {
  it.each([
    ["NotAllowedError", "permissionDenied"],
    ["SecurityError", "permissionDenied"],
    ["NotFoundError", "notFound"],
    ["NotSupportedError", "unsupported"],
    ["NotReadableError", "unavailable"],
    ["AbortError", "unavailable"],
  ])(
    "%s で失敗すると理由 %s の CameraAccessError になる",
    async (name, reason) => {
      const cause = new DOMException("browser message", name);
      stubGetUserMediaRejecting(cause);

      const opening = createCameraVideoSource().open();

      await expect(opening).rejects.toBeInstanceOf(CameraAccessError);
      await expect(opening).rejects.toMatchObject({ reason, cause });
    },
  );

  it("DOMException 以外で失敗すると理由 unavailable の CameraAccessError になる", async () => {
    stubGetUserMediaRejecting(new TypeError("browser message"));

    await expect(createCameraVideoSource().open()).rejects.toMatchObject({
      reason: "unavailable",
    });
  });

  it("mediaDevices が無いと理由 unsupported の CameraAccessError になる", async () => {
    vi.stubGlobal("navigator", {});

    await expect(createCameraVideoSource().open()).rejects.toMatchObject({
      reason: "unsupported",
    });
  });
});

describe("isFrameFresh", () => {
  it("treats a frame as fresh until the staleness threshold and stale after it", () => {
    const now = 100_000;

    expect(isFrameFresh(now - 1_000, now)).toBe(true);
    expect(isFrameFresh(now - FRAME_STALE_AFTER_MS, now)).toBe(true);
    expect(isFrameFresh(now - FRAME_STALE_AFTER_MS - 1, now)).toBe(false);
    expect(isFrameFresh(null, now)).toBe(false);
  });
});
