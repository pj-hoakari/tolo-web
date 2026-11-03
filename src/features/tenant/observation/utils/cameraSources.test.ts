import { describe, expect, it, vi } from "vitest";
import type { EdgeDevice } from "@/server/router";
import { openCameraSources, selectObservationCameras } from "./cameraSources";
import type { CrowdVideoSource } from "./videoSource";

const page = (cameraIds: string[]): EdgeDevice => ({
  edgeDeviceId: "1111111111111111",
  name: "Entry page",
  kind: "observation_page",
  cameraLinks: cameraIds.map((cameraEdgeDeviceId) => ({
    cameraEdgeDeviceId,
    observationPointId: "aaaaaaaaaaaaaaaa",
  })),
  online: true,
  lastHeartbeatAt: null,
  observationPoints: [
    { observationPointId: "aaaaaaaaaaaaaaaa", name: "Entry" },
  ],
});

const camera = (edgeDeviceId: string, name = edgeDeviceId): EdgeDevice => ({
  edgeDeviceId,
  name,
  kind: "camera",
  cameraLinks: [
    {
      cameraEdgeDeviceId: edgeDeviceId,
      observationPointId: "aaaaaaaaaaaaaaaa",
    },
  ],
  online: null,
  lastHeartbeatAt: null,
  observationPoints: [],
});

describe("selectObservationCameras", () => {
  const first = camera("2222222222222222", "First");
  const second = camera("3333333333333333", "Second");
  const unlinked = camera("4444444444444444", "Unlinked");
  const devices = [
    page([first.edgeDeviceId, second.edgeDeviceId]),
    first,
    second,
    unlinked,
  ];

  it("returns the linked cameras and selects the first one by default", () => {
    expect(selectObservationCameras(devices, page([]).edgeDeviceId)).toEqual({
      page: page([first.edgeDeviceId, second.edgeDeviceId]),
      cameras: [
        {
          edgeDeviceId: first.edgeDeviceId,
          name: "First",
          observationPointId: "aaaaaaaaaaaaaaaa",
        },
        {
          edgeDeviceId: second.edgeDeviceId,
          name: "Second",
          observationPointId: "aaaaaaaaaaaaaaaa",
        },
      ],
      initialCameraId: first.edgeDeviceId,
    });
  });

  it("selects a linked camera requested by ?camera=", () => {
    const selection = selectObservationCameras(
      devices,
      page([]).edgeDeviceId,
      second.edgeDeviceId,
    );

    expect(selection.initialCameraId).toBe(second.edgeDeviceId);
    expect(selection.cameras.map((entry) => entry.edgeDeviceId)).toEqual([
      first.edgeDeviceId,
      second.edgeDeviceId,
    ]);
  });

  it("does not select an unlinked camera in production", () => {
    const selection = selectObservationCameras(
      devices,
      page([]).edgeDeviceId,
      unlinked.edgeDeviceId,
      false,
    );

    expect(selection.initialCameraId).toBe(first.edgeDeviceId);
    expect(selection.cameras.map((entry) => entry.edgeDeviceId)).not.toContain(
      unlinked.edgeDeviceId,
    );
  });

  it("accepts an unlinked but valid camera in development and keeps the linked ones", () => {
    const selection = selectObservationCameras(
      devices,
      page([]).edgeDeviceId,
      unlinked.edgeDeviceId,
      true,
    );

    expect(selection.initialCameraId).toBe(unlinked.edgeDeviceId);
    expect(selection.cameras.map((entry) => entry.edgeDeviceId)).toEqual([
      first.edgeDeviceId,
      second.edgeDeviceId,
      unlinked.edgeDeviceId,
    ]);
  });

  it("returns no page when the page edge device is missing or is a camera", () => {
    expect(selectObservationCameras([first], page([]).edgeDeviceId)).toEqual({
      page: null,
      cameras: [],
      initialCameraId: null,
    });
    expect(
      selectObservationCameras([first], first.edgeDeviceId).page,
    ).toBeNull();
  });
});

describe("openCameraSources", () => {
  const descriptor = {
    kind: "objectUrl" as const,
    url: "blob:test",
    loop: true,
  };

  it("keeps the other sources open when one fails", async () => {
    const closeFailed = vi.fn();
    const failed: CrowdVideoSource = {
      label: "failed",
      open: vi.fn().mockRejectedValue(new Error("camera unavailable")),
      close: closeFailed,
    };
    const opened: CrowdVideoSource = {
      label: "opened",
      open: vi.fn().mockResolvedValue(descriptor),
      close: vi.fn(),
    };

    const results = await openCameraSources([
      { cameraEdgeId: "bad", createSource: () => failed },
      { cameraEdgeId: "good", createSource: () => opened },
    ]);

    expect(results.map((entry) => entry.cameraEdgeId)).toEqual(["bad", "good"]);
    expect(results[0]).toMatchObject({
      descriptor: null,
      error: expect.any(Error),
    });
    expect(results[1]).toMatchObject({ descriptor, error: null });
    expect(closeFailed).toHaveBeenCalledOnce();
    expect(opened.close).not.toHaveBeenCalled();
  });
});
