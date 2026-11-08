// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type CameraConnectionAuthorizationError,
  startCameraConnectionAuthorization,
} from "@/features/tenant/webrtc/utils/cameraConnection";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { CameraConnectionAuthorizationNotice } from "./CameraConnectionAuthorizationNotice";

vi.mock(
  "@/features/tenant/webrtc/utils/cameraConnection",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/tenant/webrtc/utils/cameraConnection")
      >();
    return {
      ...actual,
      startCameraConnectionAuthorization: vi.fn(),
    };
  },
);

const start = vi.mocked(startCameraConnectionAuthorization);

const error = (
  viewerType: "staff" | "machine",
): CameraConnectionAuthorizationError => ({
  code: "CONNECTION_AUTHORIZATION_REQUIRED",
  viewerType,
  eventId: "event-1",
  pageEdgeDeviceId: "page-1",
  cameraEdgeDeviceId: "camera-1",
});

const renderNotice = (
  value: CameraConnectionAuthorizationError | null,
  props = { eventId: "fallback-event", pageEdgeDeviceId: "fallback-page" },
) =>
  render(
    <IntlTestProvider>
      <CameraConnectionAuthorizationNotice
        error={value}
        eventId={props.eventId}
        pageEdgeDeviceId={props.pageEdgeDeviceId}
      />
    </IntlTestProvider>,
  );

beforeEach(() => {
  start.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("CameraConnectionAuthorizationNotice", () => {
  it("starts the authorization once for a staff session", () => {
    start.mockReturnValue(true);
    const value = error("staff");
    const { rerender } = renderNotice(value);

    expect(start).toHaveBeenCalledOnce();
    expect(start.mock.calls[0][0]).toMatchObject({
      eventId: "event-1",
      pageEdgeDeviceId: "page-1",
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "カメラ接続の認可が必要なため、認可画面へ移動します。",
    );

    rerender(
      <IntlTestProvider>
        <CameraConnectionAuthorizationNotice
          error={value}
          eventId="fallback-event"
          pageEdgeDeviceId="fallback-page"
        />
      </IntlTestProvider>,
    );
    expect(start).toHaveBeenCalledOnce();
  });

  it("shows the management UI instruction for a machine session without navigating", () => {
    renderNotice(error("machine"));

    expect(start).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain(
      "スタッフが管理画面の「観測ページの接続を許可」から再認可してください。",
    );
  });

  it("shows the management UI instruction when the one-shot guard blocks the start", () => {
    start.mockReturnValue(false);
    renderNotice(error("staff"));

    expect(start).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert").textContent).toContain(
      "スタッフが管理画面の「観測ページの接続を許可」から再認可してください。",
    );
  });
});
