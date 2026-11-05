import { beforeEach, expect, it, vi } from "vitest";
import { getViewer, requestTenantId } from "@/server/auth";
import { getConnectionAuth } from "@/server/auth/connection";
import { delegatedPageCameras } from "@/server/cameraDelegation";
import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({
  getViewer: vi.fn(),
  requestTenantId: vi.fn(),
}));
vi.mock("@/server/auth/connection", async (original) => ({
  ...(await original<typeof import("@/server/auth/connection")>()),
  getConnectionAuth: vi.fn(),
}));
vi.mock("@/server/cameraDelegation", () => ({ delegatedPageCameras: vi.fn() }));
const start = vi.fn();
const eventId = "fedcba9876543210";
const pageEdgeDeviceId = "1111111111111111";
const returnPath = `/event/${eventId}/observation/${pageEdgeDeviceId}`;
function request(path = returnPath) {
  const query = new URLSearchParams({
    eventId,
    pageEdgeDeviceId,
    return: path,
  });
  return new Request(
    `http://localhost:3000/api/auth/connection/start?${query}`,
    {
      headers: { host: "acme.localhost:3000" },
    },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requestTenantId).mockResolvedValue("tenant");
  vi.mocked(getViewer).mockResolvedValue({
    type: "staff",
    userId: "staff",
    tenantId: "tenant",
  });
  vi.mocked(delegatedPageCameras).mockResolvedValue(["camera"]);
  vi.mocked(getConnectionAuth).mockReturnValue({ start } as never);
  start.mockResolvedValue("https://idp.test/authorize");
});
it("passes the request Host and validated return path to pending authorization", async () => {
  const response = await GET(request());
  expect(response.headers.get("location")).toBe("https://idp.test/authorize");
  expect(start).toHaveBeenCalledWith({
    tenantId: "tenant",
    eventId,
    pageEdgeDeviceId,
    cameraIds: ["camera"],
    staffSub: "staff",
    host: "acme.localhost:3000",
    returnPath,
  });
});
it.each(["https://evil.test/", "//evil.test/", "/\\evil.test/"])(
  "rejects unsafe return path %s",
  async (path) => {
    expect((await GET(request(path))).headers.get("location")).toContain(
      "connection_request_invalid",
    );
    expect(start).not.toHaveBeenCalled();
  },
);
it("requires a staff session at the start", async () => {
  vi.mocked(getViewer).mockResolvedValue({ type: "anonymous" });
  expect((await GET(request())).headers.get("location")).toContain(
    "/auth/login?",
  );
  expect(start).not.toHaveBeenCalled();
});
