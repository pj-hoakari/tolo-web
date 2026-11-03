import { redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireStaff } from ".";

const state = vi.hoisted(() => ({
  viewer: {
    type: "machine" as const,
    userId: "user-1",
    tenantId: "0123456789abcdef",
    eventId: "fedcba9876543210",
    edgeDeviceId: "1111111111111111",
  } as
    | {
        type: "machine";
        userId: string;
        tenantId: string;
        eventId: string;
        edgeDeviceId: string;
      }
    | { type: "staff"; userId: string; tenantId: string }
    | { type: "anonymous" },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT");
    (error as Error & { url?: string }).url = url;
    throw error;
  }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ host: "test.localhost:3000" })),
}));
vi.mock("./betterAuth", () => ({
  getRealAuth: vi.fn(() => ({
    auth: {},
    env: {},
    lock: (_: string, task: () => Promise<unknown>) => task(),
  })),
}));
vi.mock("./session", () => ({
  createSessionAuth: vi.fn(() => ({
    viewer: vi.fn(async () => state.viewer),
    accessToken: vi.fn(),
  })),
}));

beforeEach(() => {
  vi.stubEnv("ROOT_DOMAIN", "localhost");
  vi.stubEnv("TENANT_SUBDOMAIN_MOCKING", "enabled");
  vi.mocked(redirect).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireStaff", () => {
  it("sends a machine session to the forbidden error page instead of the staff login", async () => {
    state.viewer = {
      type: "machine",
      userId: "user-1",
      tenantId: "0123456789abcdef",
      eventId: "fedcba9876543210",
      edgeDeviceId: "1111111111111111",
    };

    await expect(requireStaff("/management")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(
      "http://localhost/auth/error?error=machine_session_forbidden",
    );
  });

  it("lets a staff session through", async () => {
    state.viewer = {
      type: "staff",
      userId: "user-1",
      tenantId: "0123456789abcdef",
    };

    await expect(requireStaff("/management")).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("still sends an anonymous viewer to the staff login", async () => {
    state.viewer = { type: "anonymous" };

    await expect(requireStaff("/management")).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith(
      `/auth/login?return=${encodeURIComponent("/management")}`,
    );
  });
});
