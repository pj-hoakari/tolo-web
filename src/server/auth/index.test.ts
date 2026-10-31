import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccessToken } from ".";

vi.mock("server-only", () => ({}));

describe("getAccessToken with AUTH_MOCKING", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_MOCKING", "enabled");
    vi.stubEnv("ROOT_DOMAIN", "");
    vi.stubEnv("TENANT_ACCESS_TOKEN", "tenant-token");
    vi.stubEnv("GRAPH_ACCESS_TOKEN", "graph-token");
    vi.stubEnv("OBSERVATION_ACCESS_TOKEN", "observation-token");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns the fixed token for each kind of access", async () => {
    expect(await getAccessToken({ type: "tenant_access" })).toBe(
      "tenant-token",
    );
    expect(
      await getAccessToken({
        type: "event_access",
        eventId: "e1",
        client: "console",
      }),
    ).toBe("graph-token");
    expect(
      await getAccessToken({
        type: "event_access",
        eventId: "e1",
        client: "edge",
      }),
    ).toBe("observation-token");
  });

  it("refuses when the token is not set", async () => {
    vi.stubEnv("TENANT_ACCESS_TOKEN", "");

    await expect(getAccessToken({ type: "tenant_access" })).rejects.toThrow(
      "TENANT_ACCESS_TOKEN",
    );
  });

  it("refuses on a root domain that does not allow mocking", async () => {
    vi.stubEnv("ROOT_DOMAIN", "example.com");

    await expect(getAccessToken({ type: "tenant_access" })).rejects.toThrow();
  });

  it("requires the real authentication settings when AUTH_MOCKING is not enabled", async () => {
    vi.stubEnv("AUTH_MOCKING", "");
    vi.stubEnv("AUTH_DATABASE_URL", "");

    await expect(getAccessToken({ type: "tenant_access" })).rejects.toThrow(
      "AUTH_DATABASE_URL",
    );
  });
});
