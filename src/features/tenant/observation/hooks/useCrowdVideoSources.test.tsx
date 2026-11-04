// @vitest-environment jsdom
import { ORPCError } from "@orpc/client";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import type { CameraSourceSpec } from "../utils/cameraSources";
import type { CrowdVideoSource } from "../utils/videoSource";
import { useCrowdVideoSources } from "./useCrowdVideoSources";

vi.mock("../utils/detectCrowd", () => ({
  DetectionModelLoadError: class DetectionModelLoadError extends Error {},
  initializeCrowdDetector: vi.fn(async () => {}),
  resetCrowdTracking: vi.fn(),
}));

afterEach(cleanup);

function failingSource(error: unknown): CrowdVideoSource {
  return {
    label: "camera",
    open: vi.fn().mockRejectedValue(error),
    close: vi.fn(),
    lastFrameAt: () => null,
  };
}

const specs = (error: unknown): CameraSourceSpec[] => [
  {
    cameraEdgeId: "camera-1",
    createSource: () => failingSource(error),
  },
];

describe("useCrowdVideoSources", () => {
  it("exposes the connection authorization error with the viewer type", async () => {
    const cause = new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: "CONNECTION_AUTHORIZATION_REQUIRED",
        viewerType: "machine",
        eventId: "event-1",
        pageEdgeDeviceId: "page-1",
        cameraEdgeDeviceId: "camera-1",
      },
    });
    const { result } = renderHook(() => useCrowdVideoSources(specs(cause)), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.start();
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.cameraConnectionError).toEqual({
      code: "CONNECTION_AUTHORIZATION_REQUIRED",
      viewerType: "machine",
      eventId: "event-1",
      pageEdgeDeviceId: "page-1",
      cameraEdgeDeviceId: "camera-1",
    });
  });

  it("keeps a camera that is not linked out of the reauthorization flow", async () => {
    const cause = new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: "CAMERA_NOT_DELEGATED",
        viewerType: "staff",
        cameraEdgeDeviceId: "camera-1",
      },
    });
    const { result } = renderHook(() => useCrowdVideoSources(specs(cause)), {
      wrapper: IntlTestProvider,
    });

    act(() => {
      result.current.start();
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.cameraConnectionError).toMatchObject({
      code: "CAMERA_NOT_DELEGATED",
      viewerType: "staff",
    });
  });
});

it("retries only a failed camera while detecting and keeps the working descriptor", async () => {
  const goodDescriptor = {
    kind: "objectUrl",
    url: "blob:good",
    loop: false,
  } as const;
  const recoveredDescriptor = {
    kind: "objectUrl",
    url: "blob:recovered",
    loop: false,
  } as const;
  const good = {
    label: "good",
    open: vi.fn().mockResolvedValue(goodDescriptor),
    close: vi.fn(),
    lastFrameAt: () => performance.now(),
  };
  const failed = failingSource(new Error("offline"));
  const recovered = {
    ...good,
    open: vi.fn().mockResolvedValue(recoveredDescriptor),
    close: vi.fn(),
  };
  const retryFactory = vi
    .fn()
    .mockReturnValueOnce(failed)
    .mockReturnValue(recovered);
  const { result } = renderHook(
    () =>
      useCrowdVideoSources([
        { cameraEdgeId: "good", createSource: () => good },
        { cameraEdgeId: "bad", createSource: retryFactory },
      ]),
    { wrapper: IntlTestProvider },
  );
  act(() => result.current.start());
  await waitFor(() => expect(result.current.status).toBe("detecting"));
  act(() => result.current.retryCamera("bad"));
  expect(result.current.status).toBe("detecting");
  expect(result.current.sourceStates.find((s) => s.key === "bad")?.status).toBe(
    "opening",
  );
  await waitFor(() =>
    expect(
      result.current.sourceStates.find((s) => s.key === "bad")?.status,
    ).toBe("ready"),
  );
  expect(result.current.videoSources.get("good")).toBe(goodDescriptor);
  expect(result.current.videoSources.get("bad")).toBe(recoveredDescriptor);
  expect(good.open).toHaveBeenCalledOnce();
  expect(good.close).not.toHaveBeenCalled();
});

it("reports a runtime authorization failure for only the affected camera", async () => {
  const source = () => ({
    label: "camera",
    open: vi.fn().mockResolvedValue({
      kind: "objectUrl",
      url: "blob:camera",
      loop: false,
    }),
    close: vi.fn(),
    lastFrameAt: () => null,
  });
  const { result } = renderHook(
    () =>
      useCrowdVideoSources([
        { cameraEdgeId: "one", createSource: source },
        { cameraEdgeId: "two", createSource: source },
      ]),
    { wrapper: IntlTestProvider },
  );
  act(() => result.current.start());
  await waitFor(() => expect(result.current.status).toBe("detecting"));
  act(() =>
    result.current.reportSourceError(
      "one",
      new ORPCError("PRECONDITION_FAILED", {
        data: { code: "CONNECTION_AUTHORIZATION_REQUIRED" },
      }),
    ),
  );
  expect(result.current.cameraConnectionError?.cameraEdgeDeviceId).toBe("one");
  expect(result.current.sourceStates).toMatchObject([
    { key: "one", status: "error" },
    { key: "two", status: "ready" },
  ]);
  expect([...result.current.videoSources.keys()]).toEqual(["two"]);
  expect(result.current.status).toBe("detecting");
});

it("clears the failed camera's connection error after a successful individual retry", async () => {
  const cause = new ORPCError("PRECONDITION_FAILED", {
    data: { code: "CONNECTION_AUTHORIZATION_REQUIRED" },
  });
  const factory = vi
    .fn()
    .mockReturnValueOnce(failingSource(cause))
    .mockReturnValue({
      label: "recovered",
      open: vi.fn().mockResolvedValue({
        kind: "objectUrl",
        url: "blob:recovered",
        loop: false,
      }),
      close: vi.fn(),
      lastFrameAt: () => null,
    });
  const { result } = renderHook(
    () =>
      useCrowdVideoSources([{ cameraEdgeId: "camera", createSource: factory }]),
    { wrapper: IntlTestProvider },
  );
  act(() => result.current.start());
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current.cameraConnectionError).not.toBeNull();
  act(() => result.current.retryCamera("camera"));
  await waitFor(() => expect(result.current.status).toBe("detecting"));
  expect(result.current.cameraConnectionError).toBeNull();
  expect(result.current.sourceStates).toEqual([
    { key: "camera", status: "ready", error: null },
  ]);
  expect(result.current.videoSource).toMatchObject({ url: "blob:recovered" });
});
