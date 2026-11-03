import { Code, ConnectError } from "@connectrpc/connect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loginFlow, onboardingStore } from "./auth";
import { completeInvitation, completeOnboarding } from "./registration";
import {
  relationRegistrationClient,
  tenantRegistrationClient,
} from "./tenantManagement";

vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ loginFlow: vi.fn(), onboardingStore: vi.fn() }));
vi.mock("./tenantManagement", () => ({
  tenantRegistrationClient: { claimTenantOwnership: vi.fn() },
  relationRegistrationClient: { acceptTenantInvitation: vi.fn() },
}));

const TENANT = "0123456789abcdef";
const pending = {
  id: "registration-1",
  tenantId: TENANT,
  ownershipClaimToken: "claim-token",
  name: "Acme",
  subdomain: "acme",
  displayName: "Owner",
  bindingHash: "hash",
  expiresAt: new Date(Date.now() + 60_000),
};
const bindingExpired = "__Host-tolo.login.l1=; Max-Age=0";

function handOver(registration?: { tenantId: string; token: string }) {
  const takeRegistration = vi.fn(async () => ({
    headers: new Headers({ "set-cookie": bindingExpired }),
    registration,
  }));
  vi.mocked(loginFlow).mockReturnValue({ takeRegistration } as never);
  return takeRegistration;
}

function keep(kept: typeof pending | undefined) {
  const store = { bound: vi.fn(async () => kept), forget: vi.fn() };
  vi.mocked(onboardingStore).mockReturnValue(store as never);
  return store;
}

const request = (url: string, host: string, cookie: string) =>
  new Request(url, { headers: { host, cookie } });

function redirected(response: Response) {
  return {
    status: response.status,
    location: response.headers.get("location"),
    cookies: response.headers.getSetCookie().map((c) => c.split(";")[0]),
  };
}

beforeEach(() => {
  vi.stubEnv("ROOT_DOMAIN", "tolo.test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("completing the onboarding on the root domain", () => {
  const claimRequest = () =>
    request(
      "https://tolo.test/onboarding/claim?code=c",
      "tolo.test",
      "__Host-tolo.onboarding=binding",
    );

  it("claims the kept provisional tenant with the handed-over registration token, forgets it, and logs in on the new tenant host", async () => {
    handOver({ tenantId: TENANT, token: "registration-token" });
    const store = keep(pending);
    const claim = vi
      .mocked(tenantRegistrationClient.claimTenantOwnership)
      .mockResolvedValue({ tenant: { subdomain: "acme" } } as never);

    const response = await completeOnboarding(claimRequest());

    expect(store.bound).toHaveBeenCalledWith("binding");
    expect(claim).toHaveBeenCalledWith(
      {
        tenantId: TENANT,
        ownershipClaimToken: "claim-token",
        subdomain: "acme",
        displayName: "Owner",
      },
      { headers: { Authorization: "Bearer registration-token" } },
    );
    expect(store.forget).toHaveBeenCalledWith("registration-1");
    expect(redirected(response)).toEqual({
      status: 302,
      location: "https://acme.tolo.test/auth/login?return=%2Fmanagement",
      cookies: ["__Host-tolo.login.l1=", "__Host-tolo.onboarding="],
    });
  });

  it("forgets the provisional tenant on any other failure, so that the next submission starts a new one", async () => {
    handOver({ tenantId: TENANT, token: "registration-token" });
    const store = keep(pending);
    vi.mocked(tenantRegistrationClient.claimTenantOwnership).mockRejectedValue(
      new ConnectError("refused", Code.PermissionDenied),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await completeOnboarding(claimRequest());

    expect(store.forget).toHaveBeenCalledWith("registration-1");
    expect(redirected(response)).toEqual({
      status: 302,
      location: "/onboarding?error=failed",
      cookies: ["__Host-tolo.login.l1=", "__Host-tolo.onboarding="],
    });
  });

  it.each([
    ["a taken subdomain", Code.AlreadyExists, "subdomainTaken"],
    ["an invalid subdomain or display name", Code.InvalidArgument, "invalid"],
  ])(
    "keeps the provisional tenant on %s and sends the owner back to the form to retry the claim",
    async (_, code, error) => {
      handOver({ tenantId: TENANT, token: "registration-token" });
      const store = keep(pending);
      vi.mocked(
        tenantRegistrationClient.claimTenantOwnership,
      ).mockRejectedValue(new ConnectError("refused", code));
      vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await completeOnboarding(claimRequest());

      expect(store.forget).not.toHaveBeenCalled();
      expect(redirected(response)).toEqual({
        status: 302,
        location: `/onboarding?error=${error}`,
        cookies: ["__Host-tolo.login.l1="],
      });
    },
  );

  it.each([
    ["no registration token is handed over", undefined, pending],
    [
      "the token was authorized for another tenant",
      { tenantId: "1111111111111111", token: "t" },
      pending,
    ],
    [
      "this browser keeps no provisional tenant",
      { tenantId: TENANT, token: "t" },
      undefined,
    ],
  ])("refuses to claim when %s", async (_, registration, kept) => {
    handOver(registration);
    keep(kept);

    const response = await completeOnboarding(claimRequest());

    expect(
      tenantRegistrationClient.claimTenantOwnership,
    ).not.toHaveBeenCalled();
    expect(redirected(response).location).toBe(
      "https://tolo.test/auth/error?host=tolo.test&error=invalid_handoff",
    );
  });
});

describe("completing an invitation on the tenant host", () => {
  const handoffRequest = (cookie = "__Host-tolo.invitation=invitation-token") =>
    request(
      "https://acme.tolo.test/invitation/handoff?code=c",
      "acme.tolo.test",
      cookie,
    );

  it("accepts the kept invitation with the handed-over registration token, forgets it, and logs in on the same host", async () => {
    handOver({ tenantId: TENANT, token: "registration-token" });
    const accept = vi
      .mocked(relationRegistrationClient.acceptTenantInvitation)
      .mockResolvedValue({} as never);

    const response = await completeInvitation(handoffRequest(), TENANT);

    expect(accept).toHaveBeenCalledWith(
      { tenantId: TENANT, invitationToken: "invitation-token" },
      { headers: { Authorization: "Bearer registration-token" } },
    );
    expect(redirected(response)).toEqual({
      status: 302,
      location: "/auth/login?return=%2Fmanagement",
      cookies: ["__Host-tolo.login.l1=", "__Host-tolo.invitation="],
    });
  });

  it.each([
    ["an unusable invitation", Code.Unauthenticated, "unusable"],
    ["an existing membership", Code.FailedPrecondition, "cannotJoin"],
    ["a missing tenant", Code.NotFound, "notFound"],
    ["any other failure", Code.Unavailable, "failed"],
  ])(
    "keeps the invitation on %s and shows why on the invitation page",
    async (_, code, error) => {
      handOver({ tenantId: TENANT, token: "registration-token" });
      vi.mocked(
        relationRegistrationClient.acceptTenantInvitation,
      ).mockRejectedValue(new ConnectError("refused", code));
      vi.spyOn(console, "error").mockImplementation(() => {});

      const response = await completeInvitation(handoffRequest(), TENANT);

      expect(redirected(response)).toEqual({
        status: 302,
        location: `/invitation/accept?error=${error}`,
        cookies: ["__Host-tolo.login.l1="],
      });
    },
  );

  it("sends the browser back to the invitation page when no invitation is kept", async () => {
    handOver({ tenantId: TENANT, token: "registration-token" });

    const response = await completeInvitation(handoffRequest(""), TENANT);

    expect(
      relationRegistrationClient.acceptTenantInvitation,
    ).not.toHaveBeenCalled();
    expect(redirected(response).location).toBe("/invitation/accept");
  });

  it.each([
    ["no registration token is handed over", undefined],
    [
      "the token was authorized for another tenant",
      { tenantId: "1111111111111111", token: "t" },
    ],
  ])("refuses to accept when %s", async (_, registration) => {
    handOver(registration);

    const response = await completeInvitation(handoffRequest(), TENANT);

    expect(
      relationRegistrationClient.acceptTenantInvitation,
    ).not.toHaveBeenCalled();
    expect(redirected(response).location).toBe(
      "https://tolo.test/auth/error?host=acme.tolo.test&error=invalid_handoff",
    );
  });
});
