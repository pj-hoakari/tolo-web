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
