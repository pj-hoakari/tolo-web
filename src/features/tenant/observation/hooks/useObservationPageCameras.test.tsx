// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { orpc } from "@/lib/orpc";
import type { DelegatedCamera } from "@/server/router";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { useCrowdVideoSources } from "./useCrowdVideoSources";
import { useObservationPageCameras } from "./useObservationPageCameras";

vi.mock("@/lib/orpc", () => ({
  orpc: { camera: { listDelegatedCameras: vi.fn() } },
}));
vi.mock("../utils/detectCrowd", () => ({
  DetectionModelLoadError: class extends Error {},
  initializeCrowdDetector: vi.fn(async () => {}),
  resetCrowdTracking: vi.fn(),
}));
afterEach(cleanup);

it("connects the authorized camera when another linked camera is paused", async () => {
  vi.mocked(orpc.camera.listDelegatedCameras).mockResolvedValue({
    cameras: [
      {
        edgeDeviceId: "paused",
        name: "Paused",
        observationPointId: "point-1",
        connectionAuthorized: false,
      },
      {
        edgeDeviceId: "active",
        name: "Active",
        observationPointId: "point-2",
        connectionAuthorized: true,
      },
    ] as DelegatedCamera[],
  });
  const createSource = vi.fn(() => ({
    label: "camera",
    open: vi.fn().mockResolvedValue({
      kind: "objectUrl",
      url: "blob:camera",
      loop: false,
    }),
    close: vi.fn(),
    lastFrameAt: () => null,
  }));
  const { result } = renderHook(
    () => {
      const list = useObservationPageCameras({
        eventId: "event",
        pageEdgeDeviceId: "page",
        requestedCameraId: "paused",
      });
      const sources = useCrowdVideoSources(
        list.cameras.map((camera) => ({
          cameraEdgeId: camera.edgeDeviceId,
          createSource,
        })),
        list.initialCameraId,
      );
      return { list, sources };
    },
    { wrapper: IntlTestProvider },
  );
  await waitFor(() => expect(result.current.list.status).toBe("ready"));
  expect(
    result.current.list.cameras.map((camera) => camera.edgeDeviceId),
  ).toEqual(["active"]);
  expect(result.current.list.initialCameraId).toBe("active");
  expect(result.current.list.cameraConnectionError).toMatchObject({
    code: "CONNECTION_AUTHORIZATION_REQUIRED",
    cameraEdgeDeviceId: "paused",
    eventId: "event",
    pageEdgeDeviceId: "page",
  });
  act(() => result.current.sources.start());
  await waitFor(() => expect(result.current.sources.status).toBe("detecting"));
  expect([...result.current.sources.videoSources.keys()]).toEqual(["active"]);
  expect(createSource).toHaveBeenCalledOnce();
});
