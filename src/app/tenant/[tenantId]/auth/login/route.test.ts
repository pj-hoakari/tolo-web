import { beforeEach, describe, expect, it, vi } from "vitest";
import { getViewer, loginFlow } from "@/server/auth";
import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({
  getViewer: vi.fn(),
  loginFlow: vi.fn(),
}));
vi.mock("@/server/auth/mocking", () => ({
  authMockingEnabled: vi.fn(() => false),
}));

const TENANT = "0123456789abcdef";
const start = vi.fn(
  async () =>
    new Response(null, {
      status: 302,
      headers: { location: "https://idp.test/oauth2/authorize" },
    }),
);

function request() {
  return new Request("https://acme.localhost/auth/login?return=%2Fmanagement");
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loginFlow).mockReturnValue({
    start,
  } as unknown as ReturnType<typeof loginFlow>);
});

describe("tenant staff login route", () => {
  it("rejects a machine session without starting a staff login", async () => {
    vi.mocked(getViewer).mockResolvedValue({
      type: "machine",
      userId: "user-1",
      tenantId: TENANT,
      eventId: "fedcba9876543210",
      edgeDeviceId: "1111111111111111",
    });

    const response = await GET(request(), {
      params: Promise.resolve({ tenantId: TENANT }),
    });

    expect(response.status).toBe(403);
    expect(start).not.toHaveBeenCalled();
  });

  it("starts a staff login for an anonymous viewer", async () => {
    vi.mocked(getViewer).mockResolvedValue({ type: "anonymous" });

    const response = await GET(request(), {
      params: Promise.resolve({ tenantId: TENANT }),
    });

    expect(response.status).toBe(302);
    expect(start).toHaveBeenCalledWith(expect.any(Request), TENANT);
  });
});
