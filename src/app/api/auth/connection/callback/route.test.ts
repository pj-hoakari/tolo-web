import { expect, it, vi } from "vitest";
import { getConnectionAuth } from "@/server/auth/connection";
import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/connection", () => ({ getConnectionAuth: vi.fn() }));
it("returns from the root callback to the absolute tenant URL without reading a viewer session", async () => {
  const location =
    "http://acme.localhost:3000/event/test/observation?cameraConnection=authorized";
  const callback = vi.fn(async () => location);
  vi.mocked(getConnectionAuth).mockReturnValue({ callback } as never);
  const response = await GET(
    new Request(
      "http://localhost:3000/api/auth/connection/callback?code=c&state=s",
    ),
  );
  expect(callback).toHaveBeenCalledWith({
    code: "c",
    state: "s",
    error: undefined,
  });
  expect(response.headers.get("location")).toBe(location);
});
