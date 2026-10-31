import { HttpResponse, http } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import { issueRegistrationToken } from "./idp";

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
