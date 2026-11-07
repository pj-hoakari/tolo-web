// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getViewer } from "@/server/auth";
import TenantObservation from "./page";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({ getViewer: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock("@/components/locale-select", () => ({ LocaleSelect: () => null }));
vi.mock("@/components/pwa/pwa-install", () => ({ PwaInstall: () => null }));
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/features/auth/LogoutButton", () => ({ LogoutButton: () => null }));
vi.mock("@/features/tenant/observation/components/ScreenWakeControl", () => ({
  ScreenWakeControl: () => null,
}));
vi.mock("@/features/tenant/observation/components/ScreenWakeProvider", () => ({
  ScreenWakeProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/features/tenant/observation/components/ObservationSoftLock", () => ({
  ObservationSoftLock: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock("@/features/tenant/observation/components/CrowdDetection", () => ({
  CrowdDetection: ({ canReport }: { canReport: boolean }) => (
    <output>{String(canReport)}</output>
  ),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

it.each([
  { type: "staff" as const, mocking: "disabled", canReport: false },
  { type: "machine" as const, mocking: "disabled", canReport: true },
  { type: "staff" as const, mocking: "enabled", canReport: true },
])(
  "sets reporting permissions for $type with API mocking $mocking",
  async ({ type, mocking, canReport }) => {
    vi.stubEnv("NEXT_PUBLIC_API_MOCKING", mocking);
    vi.mocked(getViewer).mockResolvedValue({
      type,
      userId: "staff",
      tenantId: "tenant",
      eventId: "event",
      edgeDeviceId: "edge",
    });
    render(
      await TenantObservation({
        params: Promise.resolve({
          tenantId: "tenant",
          eventId: "event",
          edgeDeviceId: "edge",
        }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByRole("status").textContent).toBe(String(canReport));
    if (type === "staff") {
      const link = screen.getByRole("link", {
        name: "controls.observeOnThisDevice",
      });
      const url = new URL(
        link.getAttribute("href") ?? "",
        "http://acme.localhost",
      );
      expect(url.pathname).toBe("/api/auth/machine/start");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        eventId: "event",
        pageEdgeDeviceId: "edge",
        return: "/event/event/observation/edge",
      });
    } else {
      expect(
        screen.queryByRole("link", { name: "controls.observeOnThisDevice" }),
      ).toBeNull();
    }
  },
);

it("shows only the retry action when machine authorization fails", async () => {
  vi.mocked(getViewer).mockResolvedValue({
    type: "staff",
    userId: "staff",
    tenantId: "tenant",
  });
  render(
    await TenantObservation({
      params: Promise.resolve({
        tenantId: "tenant",
        eventId: "event",
        edgeDeviceId: "edge",
      }),
      searchParams: Promise.resolve({ machineSession: "failed" }),
    }),
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "machineSessionFailed",
  );
  expect(
    screen.getByRole("link", { name: "machineSessionRetry" }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("link", { name: "controls.observeOnThisDevice" }),
  ).toBeNull();
});
