import { readFile } from "node:fs/promises";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { testUtils } from "better-auth/plugins";
import { delay, HttpResponse, http } from "msw";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { server } from "@/mocks/server";
import {
  type AccountLock,
  type AuthEnv,
  advisoryLock,
  authOptions,
  PROVIDER_ID,
  type RealAuth,
  SESSION_COOKIE,
} from "./betterAuth";
import { createSessionAuth } from "./session";

const env: AuthEnv = {
  databaseUrl: "postgres://unused",
  secret: "a-test-secret-that-is-long-enough-for-better-auth",
  issuer: "https://idp.test",
  clientId: "console-ui",
  clientSecret: "console-secret",
  resourceHost: "api.tolo.test",
};
const TENANT = "0123456789abcdef";
const EVENT = "fedcba9876543210";
const TOKEN_ENDPOINT = "https://idp.test/oauth2/token";
const MINUTE = 60 * 1000;

function jwt(claims: Record<string, unknown>): string {
  return `e30.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
}

function inProcessLock(): AccountLock {
  const tails = new Map<string, Promise<unknown>>();
  return (accountId, task) => {
    const run = (tails.get(accountId) ?? Promise.resolve())
      .catch(() => {})
      .then(task);
    tails.set(accountId, run);
    return run;
  };
}

function createTestAuth(
  database: BetterAuthOptions["database"] = memoryAdapter({
    user: [],
    session: [],
    account: [],
    verification: [],
    eventAccessToken: [],
  }),
  lock: AccountLock = inProcessLock(),
) {
  const options = authOptions(env);
  const auth = betterAuth({
    ...options,
    baseURL: "http://test.localhost:3000",
    database,
    plugins: [...options.plugins, testUtils()],
  });
  return {
    auth,
    sessionAuth: createSessionAuth({
      auth: auth as unknown as RealAuth["auth"],
      env,
      lock,
    }),
  };
}

type TestAuth = ReturnType<typeof createTestAuth>["auth"];

async function signIn(
  auth: TestAuth,
  {
    tenantId = TENANT,
    account,
  }: {
    tenantId?: string;
    account?: { accessToken: string; refreshToken: string; expiresAt: Date };
  } = {},
) {
  const ctx = await auth.$context;
  const user = await ctx.test.saveUser(ctx.test.createUser());
  const login = await ctx.test.login({
    userId: user.id,
    session: { tenantId, kind: "staff" },
  });
  if (account) {
    await ctx.internalAdapter.createAccount({
      userId: user.id,
      providerId: PROVIDER_ID,
      accountId: "idp-subject",
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
      accessTokenExpiresAt: account.expiresAt,
    });
  }
  return login;
}

function idpTokenEndpoint() {
  const requests: { form: URLSearchParams; authorization: string | null }[] =
    [];
  const usedRefreshTokens = new Set<string>();
  server.use(
    http.post(TOKEN_ENDPOINT, async ({ request }) => {
      const form = new URLSearchParams(await request.text());
      requests.push({
        form,
        authorization: request.headers.get("authorization"),
      });
      await delay(20);
      if (form.get("grant_type") === "refresh_token") {
        const refreshToken = form.get("refresh_token") ?? "";
        if (usedRefreshTokens.has(refreshToken)) {
          return HttpResponse.json({ error: "invalid_grant" }, { status: 400 });
        }
        usedRefreshTokens.add(refreshToken);
        return HttpResponse.json({
          access_token: jwt({ tenant_id: TENANT, generation: 2 }),
          refresh_token: "refresh-2",
          token_type: "Bearer",
          expires_in: 900,
        });
      }
      return HttpResponse.json({
        access_token: `event-token-${requests.length}`,
        issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
        token_type: "Bearer",
        expires_in: 600,
      });
    }),
  );
  return requests;
}

beforeEach(() => {
  server.use(
    http.get("https://idp.test/.well-known/openid-configuration", () =>
      HttpResponse.json({
        issuer: "https://idp.test",
        authorization_endpoint: "https://idp.test/oauth2/authorize",
        token_endpoint: TOKEN_ENDPOINT,
        jwks_uri: "https://idp.test/oauth2/jwks",
        id_token_signing_alg_values_supported: ["RS256"],
      }),
    ),
  );
});

describe("tenant_access", () => {
  it("returns an unexpired token without contacting the IdP", async () => {
    const { auth, sessionAuth } = createTestAuth();
    const idp = idpTokenEndpoint();
    const accessToken = jwt({ tenant_id: TENANT, generation: 1 });
    const { headers } = await signIn(auth, {
      account: {
        accessToken,
        refreshToken: "refresh-1",
        expiresAt: new Date(Date.now() + 10 * MINUTE),
      },
    });

    await expect(
      sessionAuth.accessToken(headers, TENANT, { type: "tenant_access" }),
    ).resolves.toBe(accessToken);
    expect(idp).toHaveLength(0);
  });

  it("refreshes an expired token once for concurrent requests and gives both the new token", async () => {
    const { auth, sessionAuth } = createTestAuth();
    const idp = idpTokenEndpoint();
    const { headers } = await signIn(auth, {
      account: {
        accessToken: jwt({ tenant_id: TENANT, generation: 1 }),
        refreshToken: "refresh-1",
        expiresAt: new Date(Date.now() - MINUTE),
      },
    });

    const tokens = await Promise.all([
      sessionAuth.accessToken(headers, TENANT, { type: "tenant_access" }),
      sessionAuth.accessToken(headers, TENANT, { type: "tenant_access" }),
    ]);

    const refreshed = jwt({ tenant_id: TENANT, generation: 2 });
    expect(tokens).toEqual([refreshed, refreshed]);
    expect(idp.map(({ form }) => form.get("refresh_token"))).toEqual([
      "refresh-1",
    ]);
  });

  it("refuses when the session has no IdP account", async () => {
    const { auth, sessionAuth } = createTestAuth();
    const { headers } = await signIn(auth);

    await expect(
      sessionAuth.accessToken(headers, TENANT, { type: "tenant_access" }),
    ).rejects.toThrow("no staff session");
  });

  it("refuses a stored token issued for another tenant", async () => {
    const { auth, sessionAuth } = createTestAuth();
    const { headers } = await signIn(auth, {
      account: {
        accessToken: jwt({ tenant_id: "1111111111111111" }),
        refreshToken: "refresh-1",
        expiresAt: new Date(Date.now() + 10 * MINUTE),
      },
    });

    await expect(
      sessionAuth.accessToken(headers, TENANT, { type: "tenant_access" }),
    ).rejects.toThrow("not for this host's tenant");
  });
});

describe("event_access", () => {
  it("exchanges the session's tenant_access for the event and reuses the stored token", async () => {
    const { auth, sessionAuth } = createTestAuth();
    const idp = idpTokenEndpoint();
    const tenantAccess = jwt({ tenant_id: TENANT });
    const { headers } = await signIn(auth, {
      account: {
        accessToken: tenantAccess,
        refreshToken: "refresh-1",
        expiresAt: new Date(Date.now() + 10 * MINUTE),
      },
    });
    const request = {
      type: "event_access",
      eventId: EVENT,
      client: "console",
    } as const;

    const first = await sessionAuth.accessToken(headers, TENANT, request);
    const second = await sessionAuth.accessToken(headers, TENANT, request);

    expect(first).toBe("event-token-1");
    expect(second).toBe(first);
    expect(idp).toHaveLength(1);
    expect(idp[0].authorization).toBe(
      `Basic ${Buffer.from("console-ui:console-secret").toString("base64")}`,
    );
    expect(Object.fromEntries(idp[0].form)).toEqual({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: tenantAccess,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      resource: `https://api.tolo.test/tenants/${TENANT}/events/${EVENT}`,
      audience: "backend-api",
    });
  });

  it("refuses the edge client until machine sessions exist", async () => {
    const { auth, sessionAuth } = createTestAuth();
    const { headers } = await signIn(auth);

    await expect(
      sessionAuth.accessToken(headers, TENANT, {
        type: "event_access",
        eventId: EVENT,
        client: "edge",
      }),
    ).rejects.toThrow("not supported yet");
  });
});

describe("viewer", () => {
  const account = {
    accessToken: jwt({ tenant_id: TENANT }),
    refreshToken: "refresh-1",
    expiresAt: new Date(Date.now() + 10 * MINUTE),
  };

  it("is the IdP subject on the session's own tenant host", async () => {
    const { auth, sessionAuth } = createTestAuth();
    const { headers } = await signIn(auth, { account });

    await expect(sessionAuth.viewer(headers, TENANT)).resolves.toEqual({
      type: "staff",
      userId: "idp-subject",
      tenantId: TENANT,
    });
  });

  it("is anonymous on another tenant's host", async () => {
    const { auth, sessionAuth } = createTestAuth();
    const { headers } = await signIn(auth, {
      tenantId: "1111111111111111",
      account,
    });

    await expect(sessionAuth.viewer(headers, TENANT)).resolves.toEqual({
      type: "anonymous",
    });
  });

  it("is anonymous 12 hours after login even while the session is in use", async () => {
    const { auth, sessionAuth } = createTestAuth();
    const { headers, token } = await signIn(auth, { account });
    const ctx = await auth.$context;
    await ctx.internalAdapter.updateSession(token, {
      createdAt: new Date(Date.now() - 12 * 60 * MINUTE),
    });

    await expect(sessionAuth.viewer(headers, TENANT)).resolves.toEqual({
      type: "anonymous",
    });
  });
});

describe("session cookie", () => {
  it("is a host-only strict cookie without Max-Age", async () => {
    const { auth } = createTestAuth();
    const { headers } = await signIn(auth);

    const response = await auth.handler(
      new Request("http://test.localhost:3000/api/auth/get-session", {
        headers,
      }),
    );

    const cookie = response.headers
      .getSetCookie()
      .find((value) => value.startsWith(`${SESSION_COOKIE}=`));
    expect(cookie).toBeDefined();
    const attributes = cookie?.split("; ").slice(1);
    expect(attributes).toEqual(
      expect.arrayContaining([
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
      ]),
    );
    expect(cookie).not.toMatch(/Max-Age|Expires|Domain/i);
  });
});

describe.skipIf(!process.env.AUTH_TEST_DATABASE_URL)("on PostgreSQL", () => {
  const schema = `auth_test_${process.pid}_${Date.now()}`;
  const pools: Pool[] = [];
  const pool = () => {
    const created = new Pool({
      connectionString: process.env.AUTH_TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    pools.push(created);
    return created;
  };
  const instance = () => createTestAuth(pool(), advisoryLock(pool()));

  beforeAll(async () => {
    const migrator = pool();
    await migrator.query(`CREATE SCHEMA ${schema}`);
    await migrator.query(
      await readFile(new URL("../../../db/auth.sql", import.meta.url), "utf8"),
    );
  });

  afterAll(async () => {
    await pools[0]?.query(`DROP SCHEMA ${schema} CASCADE`);
    await Promise.all(pools.map((created) => created.end()));
  });

  it("refreshes once when two instances request an expired token at the same time", async () => {
    const first = instance();
    const second = instance();
    const idp = idpTokenEndpoint();
    const { headers } = await signIn(first.auth, {
      account: {
        accessToken: jwt({ tenant_id: TENANT, generation: 1 }),
        refreshToken: "refresh-1",
        expiresAt: new Date(Date.now() - MINUTE),
      },
    });

    const tokens = await Promise.all([
      first.sessionAuth.accessToken(headers, TENANT, { type: "tenant_access" }),
      second.sessionAuth.accessToken(headers, TENANT, {
        type: "tenant_access",
      }),
    ]);

    const refreshed = jwt({ tenant_id: TENANT, generation: 2 });
    expect(tokens).toEqual([refreshed, refreshed]);
    expect(idp.map(({ form }) => form.get("refresh_token"))).toEqual([
      "refresh-1",
    ]);
  });

  it("keeps event_access in the database for the next instance", async () => {
    const first = instance();
    const second = instance();
    const idp = idpTokenEndpoint();
    const { headers } = await signIn(first.auth, {
      account: {
        accessToken: jwt({ tenant_id: TENANT }),
        refreshToken: "refresh-1",
        expiresAt: new Date(Date.now() + 10 * MINUTE),
      },
    });
    const request = {
      type: "event_access",
      eventId: EVENT,
      client: "console",
    } as const;

    const issued = await first.sessionAuth.accessToken(
      headers,
      TENANT,
      request,
    );

    await expect(
      second.sessionAuth.accessToken(headers, TENANT, request),
    ).resolves.toBe(issued);
    expect(idp).toHaveLength(1);
  });
});
