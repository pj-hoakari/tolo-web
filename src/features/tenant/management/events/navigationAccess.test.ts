import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccessToken, getViewer } from "@/server/auth";
import { getEventNavigationAccess } from "./navigationAccess";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({
  getViewer: vi.fn(),
  getAccessToken: vi.fn(),
}));

const tenantId = "0123456789abcdef";
const eventId = "fedcba9876543210";
const noAccess = {
  canEditGuideMap: false,
  canViewObservationDevices: false,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_MOCKING", "disabled");
  vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "disabled");
  vi.mocked(getViewer).mockResolvedValue({
    type: "staff",
    userId: "staff",
    tenantId,
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("event navigation access", () => {
  it.each([
    ["events.read events.manage", true, true],
    ["events.read events.operate", false, true],
    ["events.manage", false, false],
    ["events.report", false, false],
  ])("maps scopes %s to menu visibility", async (scope, edit, view) => {
    const payload = Buffer.from(JSON.stringify({ scope })).toString(
      "base64url",
    );
    vi.mocked(getAccessToken).mockResolvedValue(`header.${payload}.signature`);

    await expect(getEventNavigationAccess(eventId)).resolves.toEqual({
      canEditGuideMap: edit,
      canViewObservationDevices: view,
    });
    expect(getAccessToken).toHaveBeenCalledWith({
      type: "event_access",
      eventId,
      client: "console",
    });
  });

  it.each([
    { type: "anonymous" },
    {
      type: "machine",
      userId: "machine",
      tenantId,
      eventId,
      edgeDeviceId: "edge",
    },
  ] as const)(
    "withholds protected items for $type sessions",
    async (viewer) => {
      vi.mocked(getViewer).mockResolvedValue(viewer);

      await expect(getEventNavigationAccess(eventId)).resolves.toEqual(
        noAccess,
      );
      expect(getAccessToken).not.toHaveBeenCalled();
    },
  );

  it("withholds protected items when event access cannot be granted", async () => {
    vi.mocked(getAccessToken).mockRejectedValue(new Error("access denied"));
    await expect(getEventNavigationAccess(eventId)).resolves.toEqual(noAccess);
  });

  it("rejects an invalid event ID before requesting a token", async () => {
    await expect(getEventNavigationAccess("invalid")).resolves.toEqual(
      noAccess,
    );
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("supports a mock fixture without exchanging a token", async () => {
    vi.stubEnv("ROOT_DOMAIN", "localhost");
    vi.stubEnv("AUTH_MOCKING", "enabled");
    vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "enabled");

    await expect(getEventNavigationAccess("test")).resolves.toEqual({
      canEditGuideMap: true,
      canViewObservationDevices: true,
    });
    expect(getAccessToken).not.toHaveBeenCalled();
  });
});
