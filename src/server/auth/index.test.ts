import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueRegistrationToken } from "../idp";
import {
  afterJoinPath,
  getAccessToken,
  getRegistrationToken,
  requireStaff,
} from ".";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("../idp", () => ({ issueRegistrationToken: vi.fn() }));

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

describe("requireStaff with AUTH_MOCKING", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_MOCKING", "enabled");
    vi.stubEnv("ROOT_DOMAIN", "");
    vi.stubEnv("TENANT_SUBDOMAIN_MOCKING", "enabled");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("lets the mock staff through on a tenant host", async () => {
    vi.mocked(headers).mockResolvedValue(
      new Headers({ host: "test.localhost:3000" }),
    );

    await expect(requireStaff("/management")).resolves.toBeUndefined();
  });
});

describe("joining a tenant through an invitation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("issues a registration token for the mock user from the fake IdP and continues on the management page with AUTH_MOCKING", async () => {
    vi.stubEnv("AUTH_MOCKING", "enabled");
    vi.stubEnv("ROOT_DOMAIN", "");
    vi.stubEnv("AUTH_MOCK_USER_ID", "user-invitee");
    vi.mocked(issueRegistrationToken).mockResolvedValue("registration-token");

    await expect(getRegistrationToken()).resolves.toBe("registration-token");
    expect(issueRegistrationToken).toHaveBeenCalledWith("user-invitee");
    expect(afterJoinPath()).toBe("/management");
  });

  it("refuses to get a registration token without AUTH_MOCKING because the root-domain handoff is not built yet, and would log in again on the tenant host", async () => {
    vi.stubEnv("AUTH_MOCKING", "");

    await expect(getRegistrationToken()).rejects.toThrow("not supported yet");
    expect(issueRegistrationToken).not.toHaveBeenCalled();
    expect(afterJoinPath()).toBe("/auth/login?return=%2Fmanagement");
  });
});
