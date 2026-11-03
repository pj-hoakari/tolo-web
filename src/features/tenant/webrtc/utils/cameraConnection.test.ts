import { ORPCError } from "@orpc/client";
import { describe, expect, it, vi } from "vitest";
import {
  cameraConnectionError,
  cameraConnectionPath,
  clearCameraConnectionAutoStart,
  startCameraConnectionAuthorization,
} from "./cameraConnection";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("cameraConnectionError", () => {
  it("extracts the reauthorization details without touching tokens", () => {
    const error = new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: "CONNECTION_AUTHORIZATION_REQUIRED",
        viewerType: "staff",
        eventId: "event-1",
        pageEdgeDeviceId: "page-1",
        cameraEdgeDeviceId: "camera-1",
        accessToken: "must-not-leak",
      },
    });

    expect(cameraConnectionError(error)).toEqual({
      code: "CONNECTION_AUTHORIZATION_REQUIRED",
      viewerType: "staff",
      eventId: "event-1",
      pageEdgeDeviceId: "page-1",
      cameraEdgeDeviceId: "camera-1",
    });
  });

  it("keeps a camera that is not linked to the page out of the auto flow", () => {
    const error = new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: "CAMERA_NOT_DELEGATED",
        viewerType: "machine",
        cameraEdgeDeviceId: "camera-1",
      },
    });

    expect(cameraConnectionError(error)).toMatchObject({
      code: "CAMERA_NOT_DELEGATED",
      viewerType: "machine",
      eventId: null,
      pageEdgeDeviceId: null,
      cameraEdgeDeviceId: "camera-1",
    });
  });

  it("ignores errors that are not connection authorization errors", () => {
    expect(
      cameraConnectionError(
        new ORPCError("NOT_FOUND", { data: { code: "OTHER" } }),
      ),
    ).toBeNull();
    expect(cameraConnectionError(new Error("boom"))).toBeNull();
  });
});

describe("camera connection auto start", () => {
  it("navigates to the connection start URL once and keeps the return path", () => {
    const storage = memoryStorage();
    const navigate = vi.fn();
    const input = {
      eventId: "event-1",
      pageEdgeDeviceId: "page-1",
      returnPath: "/event/event-1/observation/page-1?camera=camera-1",
      storage,
      navigate,
    };

    expect(startCameraConnectionAuthorization(input)).toBe(true);
    expect(navigate).toHaveBeenCalledWith(
      cameraConnectionPath({
        eventId: input.eventId,
        pageEdgeDeviceId: input.pageEdgeDeviceId,
        returnPath: input.returnPath,
      }),
    );

    expect(startCameraConnectionAuthorization(input)).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("allows another automatic start after the guard is cleared", () => {
    const storage = memoryStorage();
    const navigate = vi.fn();
    const input = {
      eventId: "event-1",
      pageEdgeDeviceId: "page-1",
      returnPath: "/event/event-1/observation/page-1",
      storage,
      navigate,
    };

    expect(startCameraConnectionAuthorization(input)).toBe(true);
    clearCameraConnectionAutoStart({
      eventId: input.eventId,
      pageEdgeDeviceId: input.pageEdgeDeviceId,
      storage,
    });
    expect(startCameraConnectionAuthorization(input)).toBe(true);
    expect(navigate).toHaveBeenCalledTimes(2);
  });
});
