import { beforeEach, describe, expect, it, vi } from "vitest";
import { getViewer, requestTenantId } from "@/server/auth";
import { getConnectionAuth } from "@/server/auth/connection";
import { getMachineAuth } from "@/server/auth/machine";
import { delegatedPageCameras } from "@/server/cameraDelegation";
import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({
  getViewer: vi.fn(),
  requestTenantId: vi.fn(),
}));
vi.mock("@/server/auth/connection", () => ({
  getConnectionAuth: vi.fn(),
}));
vi.mock("@/server/auth/machine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth/machine")>()),
  getMachineAuth: vi.fn(),
}));
vi.mock("@/server/cameraDelegation", () => ({
  delegatedPageCameras: vi.fn(),
}));
vi.mock("@/server/auth/eventLifecycle", () => ({
  withEventLifecycle: vi.fn((_eventId: string, task: () => Promise<unknown>) =>
    task(),
  ),
}));
vi.mock("@/server/eventStatus", () => ({
  requireApprovableEvent: vi.fn(),
}));

const TENANT = "0123456789abcdef";
const EVENT = "fedcba9876543210";
const PAGE = "1111111111111111";
const HOST = "acme.localhost:3000";
const RETURN = `/event/${EVENT}/observation/${PAGE}`;

const machine = {
  start: vi.fn(),
};

function req(query: Record<string, string> = {}) {
  const url = new URL(`http://${HOST}/api/auth/machine/start`);
  url.searchParams.set("eventId", EVENT);
  url.searchParams.set("pageEdgeDeviceId", PAGE);
  url.searchParams.set("return", RETURN);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  return new Request(url, { headers: { host: HOST } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requestTenantId).mockResolvedValue(TENANT);
  vi.mocked(getViewer).mockResolvedValue({
    type: "staff",
    userId: "user-1",
    tenantId: TENANT,
    sessionId: "staff-session",
  });
  vi.mocked(delegatedPageCameras).mockResolvedValue(["2222222222222222"]);
  vi.mocked(getConnectionAuth).mockReturnValue({
    hasAuthorization: vi.fn(async () => true),
  } as never);
  vi.mocked(getMachineAuth).mockReturnValue(machine as never);
  machine.start.mockResolvedValue({
    location: "https://idp.test/oauth2/authorize?state=s",
    binding: {
      name: "__Host-tolo.machine.binding",
      value: "binding",
      attributes: {
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 600,
      },
    },
  });
});

describe("machine start route", () => {
  it("sends a staff viewer to the IdP and sets the binding cookie", async () => {
    const response = await GET(req());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://idp.test/oauth2/authorize?state=s",
    );
    expect(response.headers.getSetCookie()).toEqual([
      expect.stringContaining("__Host-tolo.machine.binding=binding"),
    ]);
    expect(machine.start).toHaveBeenCalledWith({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
      staffSub: "user-1",
      host: HOST,
      returnPath: RETURN,
      staffSessionId: "staff-session",
    });
  });

  it("sends a non-staff viewer to login first", async () => {
    vi.mocked(getViewer).mockResolvedValue({ type: "anonymous" });

    const response = await GET(req());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/auth/login?return=");
    expect(machine.start).not.toHaveBeenCalled();
  });

  it("refuses a page that Observation does not return as an observation page", async () => {
    vi.mocked(delegatedPageCameras).mockResolvedValue(null);

    const response = await GET(req());

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain(
      "/auth/error?error=machine_page_not_found",
    );
    expect(machine.start).not.toHaveBeenCalled();
  });

  it("starts the connection authorization when the page has no delegation", async () => {
    vi.mocked(getConnectionAuth).mockReturnValue({
      hasAuthorization: vi.fn(async () => false),
    } as never);

    const response = await GET(req());

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.pathname).toBe("/api/auth/connection/start");
    expect(location.searchParams.get("eventId")).toBe(EVENT);
    expect(location.searchParams.get("pageEdgeDeviceId")).toBe(PAGE);
    expect(location.searchParams.get("return")).toBe(
      `/api/auth/machine/start?eventId=${EVENT}&pageEdgeDeviceId=${PAGE}&return=${encodeURIComponent(RETURN)}`,
    );
    expect(machine.start).not.toHaveBeenCalled();
  });

  it("stops instead of looping when the chained connection authorization fails", async () => {
    vi.mocked(getConnectionAuth).mockReturnValue({
      hasAuthorization: vi.fn(async () => false),
    } as never);

    const response = await GET(req({ cameraConnection: "login_required" }));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain(
      `machineSession=login_required`,
    );
    expect(machine.start).not.toHaveBeenCalled();
  });
});

it("is not found while authentication is mocked", async () => {
  vi.stubEnv("AUTH_MOCKING", "enabled");
  try {
    const response = await GET(req());
    expect(response.status).toBe(404);
    expect(getViewer).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
  }
});

it("returns to the request Host rather than the address the server listens on", async () => {
  const url = new URL(req().url);
  url.host = "0.0.0.0:3000";
  vi.mocked(getConnectionAuth).mockReturnValue({
    hasAuthorization: vi.fn(async () => {
      throw new Error("unavailable");
    }),
  } as never);
  const response = await GET(new Request(url, { headers: { host: HOST } }));
  expect(response.headers.get("location")).toBe(
    `http://${HOST}${RETURN}?machineSession=failed`,
  );
});
