import { http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { orpc } from "@/lib/orpc";
import { server } from "@/mocks/server";
import { POST } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/auth")>()),
  getViewer: async () => ({ type: "anonymous" }),
}));

const call = (headers: Record<string, string>) =>
  POST(
    new Request("http://test.localhost:3000/rpc/guest/openGuestPage", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify({ json: {} }),
    }),
  );

describe("/rpc", () => {
  it("rejects a request without the CSRF header", async () => {
    const response = await call({});

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      json: { code: "CSRF_TOKEN_MISMATCH" },
    });
  });

  it("passes a request with the CSRF header on to the procedure", async () => {
    const response = await call({ "x-csrf-token": "orpc" });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      json: { code: "BAD_REQUEST" },
    });
  });

  it("is reached through the client link with the CSRF header", async () => {
    server.use(http.post("*/rpc/*", ({ request }) => POST(request)));

    await expect(
      orpc.guest.openGuestPage(
        {} as Parameters<typeof orpc.guest.openGuestPage>[0],
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
