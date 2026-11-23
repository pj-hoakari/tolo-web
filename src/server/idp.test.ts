import { HttpResponse, http } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { issueEdgeAccessToken, issueRegistrationToken } from "./idp";

vi.mock("server-only", () => ({}));

afterEach(() => vi.unstubAllEnvs());

it("asks the fake IdP for a registration token for joining a tenant", async () => {
  vi.stubEnv("FAKEIDP_URL", "http://fakeidp.test");
  let requested: unknown;
  server.use(
    http.post("http://fakeidp.test/token", async ({ request }) => {
      requested = await request.json();
      return HttpResponse.json({ access_token: "registration-token" });
    }),
  );

  await expect(issueRegistrationToken("owner@example.com")).resolves.toBe(
    "registration-token",
  );
  expect(requested).toEqual({
    token_use: "registration",
    sub: "owner@example.com",
    client_id: "console-ui",
    scope: "tenant.join",
  });
});

it("asks the fake IdP for an edge token that names the page's edge device", async () => {
  vi.stubEnv("FAKEIDP_URL", "http://fakeidp.test");
  let requested: unknown;
  server.use(
    http.post("http://fakeidp.test/token", async ({ request }) => {
      requested = await request.json();
      return HttpResponse.json({ access_token: "edge-token" });
    }),
  );

  await expect(
    issueEdgeAccessToken({ tenantId: "t1", eventId: "e1", edgeDeviceId: "d1" }),
  ).resolves.toBe("edge-token");
  expect(requested).toEqual({
    token_use: "event_access",
    sub: "dev-edge",
    client_id: "edge-page",
    tenant_id: "t1",
    event_id: "e1",
    edge_device_id: "d1",
    scope: "events.read events.report",
  });
});
