import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getAccessToken } from "@/server/auth";
import { canReadTenantMembers } from "./headerAccess";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({ getAccessToken: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("AUTH_MOCKING", "disabled");
  vi.mocked(getAccessToken).mockReset();
});

afterEach(() => vi.unstubAllEnvs());

it.each([
  ["tenant.read", true],
  ["events.read tenant.write", false],
])(
  "uses tenant scopes %s for the member management link",
  async (scope, allowed) => {
    const payload = Buffer.from(JSON.stringify({ scope })).toString(
      "base64url",
    );
    vi.mocked(getAccessToken).mockResolvedValue(`header.${payload}.signature`);
    await expect(canReadTenantMembers()).resolves.toBe(allowed);
    expect(getAccessToken).toHaveBeenCalledWith({ type: "tenant_access" });
  },
);

it("hides member management when the token cannot be obtained", async () => {
  vi.mocked(getAccessToken).mockRejectedValue(new Error("no access"));
  await expect(canReadTenantMembers()).resolves.toBe(false);
});
