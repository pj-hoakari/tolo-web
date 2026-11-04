import { generateKeyPairSync, sign } from "node:crypto";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { testUtils } from "better-auth/plugins";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";

vi.mock("server-only", () => ({}));

import {
  type AuthEnv,
  authOptions,
  type RealAuth,
  SESSION_COOKIE,
  type SessionLock,
  type SessionLocks,
} from "./betterAuth";
import { BROWSER_COOKIE } from "./browser";
import { createMachineAuth, machineResultPath } from "./machine";
import {
  MACHINE_BINDING_COOKIE,
  PENDING_MACHINE_AUTHORIZATION,
  PENDING_MACHINE_HANDOFF,
} from "./machineSession";
import { createSessionAuth } from "./session";

const env: AuthEnv = {
  databaseUrl: "postgres://unused",
  secret: "a-test-secret-that-is-long-enough-for-better-auth",
  issuer: "https://idp.test",
  clientId: "console-ui",
  clientSecret: "console-secret",
  resourceHost: "api.tolo.test",
  connectionClientId: "observation-connection",
  connectionClientSecret: "connection-secret",
  machineClientId: "edge-page",
  machineClientSecret: "machine-secret",
};
const TENANT = "0123456789abcdef";
const EVENT = "fedcba9876543210";
const PAGE = "1111111111111111";
const HOST = "acme.tolo.test";
const RETURN_PATH = `/event/${EVENT}/observation/${PAGE}`;
const TOKEN_ENDPOINT = "https://idp.test/oauth2/token";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256" };

function signIdToken(claims: Record<string, unknown>): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode({ alg: "RS256", kid: "k1", typ: "JWT" })}.${encode(claims)}`;
  return `${input}.${sign("RSA-SHA256", Buffer.from(input), privateKey).toString("base64url")}`;
}

type Grant = { sub: string; nonce: string };

function idp() {
  const grants = new Map<string, Grant>();
  const exchanges: URLSearchParams[] = [];
  const refreshes: URLSearchParams[] = [];
  server.use(
    http.get("https://idp.test/.well-known/openid-configuration", () =>
      HttpResponse.json({
        issuer: "https://idp.test",
        authorization_endpoint: "https://idp.test/oauth2/authorize",
        token_endpoint: TOKEN_ENDPOINT,
        jwks_uri: "https://idp.test/oauth2/jwks",
        end_session_endpoint: "https://idp.test/connect/logout",
        id_token_signing_alg_values_supported: ["RS256"],
      }),
    ),
    http.get("https://idp.test/oauth2/jwks", () =>
      HttpResponse.json({ keys: [jwk] }),
    ),
    http.post(TOKEN_ENDPOINT, async ({ request }) => {
      const form = new URLSearchParams(await request.text());
      if (form.get("grant_type") === "refresh_token") {
        refreshes.push(form);
        return HttpResponse.json({
          access_token: "machine-tenant-refreshed",
          refresh_token: "machine-refresh-next",
          id_token: "machine-id-next",
          token_type: "Bearer",
          expires_in: 900,
        });
      }
      if (
        form.get("grant_type") ===
        "urn:ietf:params:oauth:grant-type:token-exchange"
      ) {
        exchanges.push(form);
        return HttpResponse.json({
          access_token: "machine-event-access",
          issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
          token_type: "Bearer",
          expires_in: 600,
        });
      }
      const grant = grants.get(form.get("code") ?? "");
      if (!grant) {
        return HttpResponse.json({ error: "invalid_grant" }, { status: 400 });
      }
      const now = Math.floor(Date.now() / 1000);
      return HttpResponse.json({
        access_token: "machine-tenant-access",
        refresh_token: "machine-refresh",
        id_token: signIdToken({
          iss: "https://idp.test",
          aud: "edge-page",
          sub: grant.sub,
          nonce: grant.nonce,
          iat: now,
          exp: now + 300,
        }),
        token_type: "Bearer",
        expires_in: 900,
      });
    }),
  );
  return {
    exchanges,
    refreshes,
    authorize(url: URL, sub: string) {
      const code = `code-${grants.size}`;
      grants.set(code, { sub, nonce: url.searchParams.get("nonce") ?? "" });
      return code;
    },
  };
}

function inProcessLock(): SessionLock {
  const tails = new Map<string, Promise<unknown>>();
  return (key, task) => {
    const run = (tails.get(key) ?? Promise.resolve())
      .catch(() => {})
      .then(task);
    tails.set(key, run);
    return run;
  };
}

function inProcessLockMany(lock: SessionLock): SessionLocks {
  return async <T>(keys: string[], task: () => Promise<T>): Promise<T> => {
    const sorted = [...new Set(keys)].sort();
    const run = async (index: number): Promise<T> =>
      index === sorted.length
        ? task()
        : lock(sorted[index], () => run(index + 1));
    return run(0);
  };
}

function createTestAuth(
  database: BetterAuthOptions["database"] = memoryAdapter({
    user: [],
    session: [],
    account: [],
    verification: [],
    tenantAccessToken: [],
    eventAccessToken: [],
    pendingLogin: [],
    pendingMachineAuthorization: [],
    pendingMachineHandoff: [],
    browserHostState: [],
  }),
) {
  const options = authOptions(env);
  const auth = betterAuth({
    ...options,
    database,
    plugins: [...options.plugins, testUtils()],
  });
  const lock = inProcessLock();
  const realAuth = {
    auth: auth as unknown as RealAuth["auth"],
    env,
    lock,
    lockMany: inProcessLockMany(lock),
  } as RealAuth;
  return {
    auth,
    machine: createMachineAuth(realAuth, {
      redirectUri: "https://tolo.test/api/auth/machine/callback",
    }),
    sessionAuth: createSessionAuth(realAuth),
  };
}

type TestAuth = ReturnType<typeof createTestAuth>;

async function createUser(auth: TestAuth["auth"], email: string) {
  const ctx = await auth.$context;
  return ctx.test.saveUser(ctx.test.createUser({ email }));
}

function onHost(_url: string, host: string, cookie = "") {
  return new Headers({ host, cookie });
}

function cookiesFrom(response: Response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
}

async function startMachine(
  test: TestAuth,
  staffSub = "user-1",
  provider = idp(),
) {
  const started = await test.machine.start({
    tenantId: TENANT,
    eventId: EVENT,
    pageEdgeDeviceId: PAGE,
    staffSub,
    host: HOST,
    returnPath: RETURN_PATH,
  });
  const authorizeUrl = new URL(started.location);
  const code = provider.authorize(authorizeUrl, staffSub);
  return { started, authorizeUrl, code, provider };
}

function machineCookies(started: Awaited<ReturnType<typeof startMachine>>) {
  const cookies = [
    `${MACHINE_BINDING_COOKIE}=${started.started.binding.value}`,
  ];
  if (started.started.browser) {
    cookies.push(`${BROWSER_COOKIE}=${started.started.browser.value}`);
  }
  return cookies.join("; ");
}

async function handoff(test: TestAuth, location: string, cookie: string) {
  const url = new URL(location);
  return test.auth.api.completeMachineSession({
    body: { code: url.searchParams.get("code") ?? "", host: url.host },
    headers: onHost(location, url.host, cookie),
    asResponse: true,
  });
}

beforeEach(() => {
  process.env.ROOT_DOMAIN = "tolo.test";
});

afterEach(() => {
  process.env.ROOT_DOMAIN = undefined;
});

describe("machine start", () => {
  it("asks the IdP for an edge-page code with PKCE, a nonce, tenant resource, and events.report", async () => {
    const test = createTestAuth();

    const { started, authorizeUrl } = await startMachine(test);

    expect(`${authorizeUrl.origin}${authorizeUrl.pathname}`).toBe(
      "https://idp.test/oauth2/authorize",
    );
    expect(Object.fromEntries(authorizeUrl.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "edge-page",
      redirect_uri: "https://tolo.test/api/auth/machine/callback",
      scope: "openid events.report",
      resource: `https://api.tolo.test/tenants/${TENANT}`,
      audience: "backend-api",
      prompt: "login",
      code_challenge_method: "S256",
    });
    expect(authorizeUrl.searchParams.get("state")).toBeTruthy();
    expect(authorizeUrl.searchParams.get("nonce")).toBeTruthy();
    expect(authorizeUrl.searchParams.get("code_challenge")).not.toBe(
      authorizeUrl.searchParams.get("code_verifier"),
    );
    expect(started.binding.name).toBe(MACHINE_BINDING_COOKIE);
    expect(started.browser).toMatchObject({
      name: BROWSER_COOKIE,
      attributes: {
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        maxAge: 31_536_000,
      },
    });
    const ctx = await test.auth.$context;
    expect(
      await ctx.adapter.findMany({
        model: PENDING_MACHINE_AUTHORIZATION,
      }),
    ).toHaveLength(1);
  });
});

describe("machine callback and handoff", () => {
  it("exchanges the code, binds the session to the page, and replaces the staff session", async () => {
    const provider = idp();
    const test = createTestAuth();
    const user = await createUser(test.auth, "user-1@tolo-idp.local");
    const ctx = await test.auth.$context;
    const staff = await ctx.test.login({
      userId: user.id,
      session: { tenantId: TENANT, kind: "staff" },
    });
    await ctx.adapter.create({
      model: "tenantAccessToken",
      data: {
        sessionId: staff.session.id,
        subject: "user-1",
        accessToken: "staff-tenant",
        refreshToken: "staff-refresh",
        accessTokenExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const started = await startMachine(test, "user-1", provider);

    const callback = await test.machine.callback({
      code: started.code,
      state: started.authorizeUrl.searchParams.get("state") ?? undefined,
      error: undefined,
    });

    expect(callback.location).toMatch(
      new RegExp(`^https://${HOST}/api/auth/machine/handoff\\?code=`),
    );
    expect(callback.location).not.toContain("machine-tenant-access");
    expect(
      await ctx.adapter.findMany({ model: PENDING_MACHINE_AUTHORIZATION }),
    ).toHaveLength(0);
    const handoffs = await ctx.adapter.findMany<{ id: string }>({
      model: PENDING_MACHINE_HANDOFF,
    });
    expect(handoffs).toHaveLength(1);

    const staffCookie = staff.headers.get("cookie") ?? "";
    const handedOff = await handoff(
      test,
      callback.location,
      `${staffCookie}; ${machineCookies(started)}`,
    );

    expect(handedOff.status).toBe(302);
    const logout = new URL(handedOff.headers.get("location") ?? "");
    expect(`${logout.origin}${logout.pathname}`).toBe(
      "https://idp.test/connect/logout",
    );
    expect(logout.searchParams.get("post_logout_redirect_uri")).toBe(
      "https://tolo.test/auth/logged-out",
    );
    expect(logout.searchParams.get("id_token_hint")).toBeTruthy();
    const state = JSON.parse(
      Buffer.from(logout.searchParams.get("state") ?? "", "base64url").toString(
        "utf8",
      ),
    );
    expect(state).toEqual({ host: HOST, returnPath: RETURN_PATH });
    const handoffCookies = cookiesFrom(handedOff);
    const sessionCookie = handoffCookies.find((cookie) =>
      cookie.startsWith(`${SESSION_COOKIE}=`),
    );
    expect(sessionCookie).toBeTruthy();

    await expect(
      test.sessionAuth.viewer(onHost("https://x", HOST, staffCookie), TENANT),
    ).resolves.toEqual({ type: "anonymous" });
    const machineHeaders = onHost("https://x", HOST, sessionCookie ?? "");
    await expect(
      test.sessionAuth.viewer(machineHeaders, TENANT),
    ).resolves.toEqual({
      type: "machine",
      userId: "user-1",
      tenantId: TENANT,
      eventId: EVENT,
      edgeDeviceId: PAGE,
    });
    await expect(
      test.sessionAuth.accessToken(machineHeaders, TENANT, {
        type: "tenant_access",
      }),
    ).resolves.toBe("machine-tenant-access");
    await expect(
      test.sessionAuth.accessToken(machineHeaders, TENANT, {
        type: "event_access",
        eventId: EVENT,
        client: "edge",
      }),
    ).resolves.toBe("machine-event-access");
    expect(provider.exchanges).toHaveLength(1);
    expect(Object.fromEntries(provider.exchanges[0])).toMatchObject({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: "machine-tenant-access",
      resource: `https://api.tolo.test/tenants/${TENANT}/events/${EVENT}`,
      audience: "backend-api",
      scope: "events.report",
      edge_device_id: PAGE,
    });
    expect(
      await ctx.adapter.findMany({ model: PENDING_MACHINE_HANDOFF }),
    ).toHaveLength(0);
  });

  it("keeps machine sessions for different browsers", async () => {
    const provider = idp();
    const test = createTestAuth();
    await createUser(test.auth, "user-1@tolo-idp.local");

    const first = await startMachine(test, "user-1", provider);
    const firstCallback = await test.machine.callback({
      code: first.code,
      state: first.authorizeUrl.searchParams.get("state") ?? undefined,
      error: undefined,
    });
    const firstHandoff = await handoff(
      test,
      firstCallback.location,
      machineCookies(first),
    );
    expect(firstHandoff.status).toBe(302);

    const second = await startMachine(test, "user-1", provider);
    const secondCallback = await test.machine.callback({
      code: second.code,
      state: second.authorizeUrl.searchParams.get("state") ?? undefined,
      error: undefined,
    });
    const secondHandoff = await handoff(
      test,
      secondCallback.location,
      machineCookies(second),
    );
    expect(secondHandoff.status).toBe(302);

    const ctx = await test.auth.$context;
    const sessions = await ctx.adapter.findMany<{ kind: string }>({
      model: "session",
    });
    expect(
      sessions.filter((session) => session.kind === "machine"),
    ).toHaveLength(2);
    const firstSession = cookiesFrom(firstHandoff).find((cookie) =>
      cookie.startsWith(`${SESSION_COOKIE}=`),
    );
    const secondSession = cookiesFrom(secondHandoff).find((cookie) =>
      cookie.startsWith(`${SESSION_COOKIE}=`),
    );
    await expect(
      test.sessionAuth.viewer(
        onHost("https://x", HOST, firstSession ?? ""),
        TENANT,
      ),
    ).resolves.toMatchObject({ type: "machine" });
    await expect(
      test.sessionAuth.viewer(
        onHost("https://x", HOST, secondSession ?? ""),
        TENANT,
      ),
    ).resolves.toMatchObject({ type: "machine" });
  });

  it("rejects an ID token whose nonce or subject does not match the pending authorization", async () => {
    const provider = idp();
    const test = createTestAuth();
    await createUser(test.auth, "user-1@tolo-idp.local");
    await createUser(test.auth, "user-2@tolo-idp.local");
    const started = await startMachine(test, "user-1", provider);

    const wrongSubject = await test.machine.callback({
      code: provider.authorize(started.authorizeUrl, "user-2"),
      state: started.authorizeUrl.searchParams.get("state") ?? undefined,
      error: undefined,
    });

    expect(wrongSubject.location).toBe(
      machineResultPath(RETURN_PATH, "failed"),
    );
  });

  it("sends a login_required result back to the observation page", async () => {
    const test = createTestAuth();
    const started = await startMachine(test);

    const callback = await test.machine.callback({
      code: undefined,
      state: started.authorizeUrl.searchParams.get("state") ?? undefined,
      error: "login_required",
    });

    expect(callback.location).toBe(
      machineResultPath(RETURN_PATH, "login_required"),
    );
  });

  it("refuses a handoff without the binding cookie", async () => {
    const provider = idp();
    const test = createTestAuth();
    await createUser(test.auth, "user-1@tolo-idp.local");
    const started = await startMachine(test, "user-1", provider);
    const callback = await test.machine.callback({
      code: started.code,
      state: started.authorizeUrl.searchParams.get("state") ?? undefined,
      error: undefined,
    });

    const handedOff = await handoff(test, callback.location, "");

    expect(handedOff.status).toBe(302);
    expect(handedOff.headers.get("location")).toContain(
      "/auth/error?error=machine_handoff_invalid",
    );
  });
});
