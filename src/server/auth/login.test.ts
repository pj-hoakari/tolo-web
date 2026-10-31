import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { testUtils } from "better-auth/plugins";
import { HttpResponse, http } from "msw";
import { Pool } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { server } from "@/mocks/server";
import {
  type AuthEnv,
  authOptions,
  type RealAuth,
  SESSION_COOKIE,
} from "./betterAuth";
import { createLoginFlow } from "./login";
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
const OTHER_TENANT = "1111111111111111";
const HOST = "acme.tolo.test";
const OTHER_HOST = "other.tolo.test";

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

type Grant = { sub: string; nonce: string; tenantId: string };

function idp() {
  const grants = new Map<string, Grant>();
  const issued = new Map<string, { accessToken: string; idToken: string }>();
  const subjects = new Map<string, string>();
  server.use(
    http.get("https://idp.test/.well-known/openid-configuration", () =>
      HttpResponse.json({
        issuer: "https://idp.test",
        authorization_endpoint: "https://idp.test/oauth2/authorize",
        token_endpoint: "https://idp.test/oauth2/token",
        userinfo_endpoint: "https://idp.test/userinfo",
        jwks_uri: "https://idp.test/oauth2/jwks",
        id_token_signing_alg_values_supported: ["RS256"],
      }),
    ),
    http.get("https://idp.test/oauth2/jwks", () =>
      HttpResponse.json({ keys: [jwk] }),
    ),
    http.post("https://idp.test/oauth2/token", async ({ request }) => {
      const grant = grants.get(
        new URLSearchParams(await request.text()).get("code") ?? "",
      );
      if (!grant) {
        return HttpResponse.json({ error: "invalid_grant" }, { status: 400 });
      }
      const now = Math.floor(Date.now() / 1000);
      const tokens = {
        accessToken: `tenant-access-${grant.sub}-${grant.tenantId}`,
        idToken: signIdToken({
          iss: "https://idp.test",
          aud: "console-ui",
          sub: grant.sub,
          nonce: grant.nonce,
          iat: now,
          exp: now + 300,
        }),
      };
      issued.set(grant.tenantId, tokens);
      subjects.set(tokens.accessToken, grant.sub);
      return HttpResponse.json({
        access_token: tokens.accessToken,
        refresh_token: `refresh-${grant.sub}-${grant.tenantId}`,
        id_token: tokens.idToken,
        token_type: "Bearer",
        expires_in: 900,
      });
    }),
    http.get("https://idp.test/userinfo", ({ request }) =>
      HttpResponse.json({
        sub: subjects.get(
          request.headers.get("authorization")?.replace("Bearer ", "") ?? "",
        ),
      }),
    ),
  );
  return {
    issued,
    authorize(url: URL, sub: string) {
      const code = `code-${grants.size}`;
      const tenantId = url.searchParams.get("resource")?.split("/").at(-1);
      grants.set(code, {
        sub,
        nonce: url.searchParams.get("nonce") ?? "",
        tenantId: tenantId ?? "",
      });
      return code;
    },
  };
}

function cookieJar() {
  const cookies = new Map<string, string>();
  return {
    cookies,
    store(response: Response) {
      for (const cookie of response.headers.getSetCookie()) {
        const [pair, ...attributes] = cookie.split("; ");
        const name = pair.slice(0, pair.indexOf("="));
        const value = pair.slice(name.length + 1);
        if (!value || attributes.includes("Max-Age=0")) cookies.delete(name);
        else cookies.set(name, value);
      }
    },
    header() {
      return [...cookies].map(([name, value]) => `${name}=${value}`).join("; ");
    },
  };
}

async function createTestAuth(
  database: BetterAuthOptions["database"] = memoryAdapter({
    user: [],
    session: [],
    account: [],
    verification: [],
    tenantAccessToken: [],
    eventAccessToken: [],
    pendingLogin: [],
  }),
  databaseHooks?: BetterAuthOptions["databaseHooks"],
) {
  const options = authOptions(env);
  const auth = betterAuth({
    ...options,
    database,
    databaseHooks,
    plugins: [...options.plugins, testUtils()],
  });
  const realAuth = {
    auth: auth as unknown as RealAuth["auth"],
    env,
    lock: (_: string, task: () => Promise<unknown>) => task(),
  } as RealAuth;
  await auth.$context;
  return {
    auth,
    flow: createLoginFlow(realAuth),
    sessionAuth: createSessionAuth(realAuth),
  };
}

type TestAuth = Awaited<ReturnType<typeof createTestAuth>>;

function onHost(url: string, host: string, cookie: string) {
  return new Request(url, { headers: { host, cookie } });
}

async function authorizeAtIdp(
  { flow }: TestAuth,
  provider: ReturnType<typeof idp>,
  {
    tenantId = TENANT,
    host = HOST,
    returnPath = "/management",
    sub = "user-1",
    tenantJar = cookieJar(),
  } = {},
) {
  const rootJar = cookieJar();
  const started = await flow.start(
    onHost(
      `https://${host}/auth/login?return=${encodeURIComponent(returnPath)}`,
      host,
      tenantJar.header(),
    ),
    tenantId,
  );
  tenantJar.store(started);
  const begun = await flow.begin(
    onHost(started.headers.get("location") ?? "", "tolo.test", ""),
  );
  rootJar.store(begun);
  const authorizeUrl = new URL(begun.headers.get("location") ?? "");
  const code = provider.authorize(authorizeUrl, sub);
  return { started, begun, authorizeUrl, code, rootJar, tenantJar };
}

async function callback(
  { auth }: TestAuth,
  { code, authorizeUrl, rootJar }: Awaited<ReturnType<typeof authorizeAtIdp>>,
) {
  const state = authorizeUrl.searchParams.get("state");
  return auth.handler(
    onHost(
      `https://tolo.test/api/auth/callback/tolo-idp?code=${code}&state=${state}`,
      "tolo.test",
      rootJar.header(),
    ),
  );
}

async function logInUntilHandoff(
  testAuth: TestAuth,
  provider: ReturnType<typeof idp>,
  options: Parameters<typeof authorizeAtIdp>[2] = {},
) {
  const authorized = await authorizeAtIdp(testAuth, provider, options);
  const completed = await callback(testAuth, authorized);
  return {
    ...authorized,
    completed,
    handoffUrl: completed.headers.get("location") ?? "",
  };
}

async function handOff(
  { flow }: TestAuth,
  url: string,
  jar: ReturnType<typeof cookieJar>,
  host = HOST,
) {
  const response = await flow.handoff(onHost(url, host, jar.header()));
  jar.store(response);
  return response;
}

function loginErrorPage(response: Response) {
  const location = new URL(response.headers.get("location") ?? "");
  return {
    status: response.status,
    page: `${location.origin}${location.pathname}`,
    ...Object.fromEntries(location.searchParams),
  };
}

function sessionHeaders(jar: ReturnType<typeof cookieJar>) {
  return new Headers({ cookie: jar.header() });
}

beforeEach(() => {
  vi.stubEnv("ROOT_DOMAIN", "tolo.test");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("login handoff", () => {
  it("hands the IdP's tokens over to a staff session on the tenant host that started the login", async () => {
    const provider = idp();
    const testAuth = await createTestAuth();
    const login = await logInUntilHandoff(testAuth, provider, {
      returnPath: "/event/e1/management?tab=graph&view=all",
    });

    const handedOff = await handOff(
      testAuth,
      login.handoffUrl,
      login.tenantJar,
    );

    expect(handedOff.status).toBe(200);
    expect(handedOff.headers.get("referrer-policy")).toBe("no-referrer");
    expect(handedOff.headers.get("cache-control")).toBe("no-store");
    expect(await handedOff.text()).toContain(
      'content="0;url=/event/e1/management?tab=graph&amp;view=all"',
    );
    const sessionCookie = handedOff.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
    expect(sessionCookie?.split("; ")).toEqual(
      expect.arrayContaining([
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Strict",
      ]),
    );
    expect(sessionCookie).not.toMatch(/Max-Age|Expires|Domain/i);
    expect(
      [...login.tenantJar.cookies.keys()].filter((name) =>
        name.startsWith("__Host-tolo.login."),
      ),
    ).toEqual([]);

    const headers = sessionHeaders(login.tenantJar);
    await expect(testAuth.sessionAuth.viewer(headers, TENANT)).resolves.toEqual(
      {
        type: "staff",
        userId: "user-1",
        tenantId: TENANT,
      },
    );
    await expect(
      testAuth.sessionAuth.accessToken(headers, TENANT, {
        type: "tenant_access",
      }),
    ).resolves.toBe(`tenant-access-user-1-${TENANT}`);
    const ctx = await testAuth.auth.$context;
    expect(
      await ctx.adapter.findOne<{ idToken: string }>({
        model: "tenantAccessToken",
        where: [{ field: "subject", value: "user-1" }],
      }),
    ).toMatchObject({ idToken: provider.issued.get(TENANT)?.idToken });
  });

  it("starts with a short-lived lax binding cookie on the tenant host and asks the IdP for the tenant", async () => {
    const provider = idp();
    const testAuth = await createTestAuth();
    const { started, authorizeUrl } = await authorizeAtIdp(testAuth, provider);

    expect(started.status).toBe(302);
    expect(started.headers.get("location")).toMatch(
      /^https:\/\/tolo\.test\/auth\/begin\?login=/,
    );
    const [bindingCookie] = started.headers.getSetCookie();
    expect(bindingCookie).toMatch(/^__Host-tolo\.login\.[^=]+=[^;]+;/);
    expect(bindingCookie.split("; ")).toEqual(
      expect.arrayContaining([
        "Max-Age=600",
        "Path=/",
        "HttpOnly",
        "Secure",
        "SameSite=Lax",
      ]),
    );
    expect(bindingCookie).not.toMatch(/Domain/i);
    expect(Object.fromEntries(authorizeUrl.searchParams)).toMatchObject({
      client_id: "console-ui",
      redirect_uri: "https://tolo.test/api/auth/callback/tolo-idp",
      response_type: "code",
      scope:
        "openid tenant.read tenant.write events.read events.manage events.operate events.report",
      resource: `https://api.tolo.test/tenants/${TENANT}`,
      audience: "backend-api",
      code_challenge_method: "S256",
    });
  });

  it("keeps no session and no external tokens on the root domain after the callback", async () => {
    const provider = idp();
    const testAuth = await createTestAuth();
    const { completed, handoffUrl } = await logInUntilHandoff(
      testAuth,
      provider,
    );

    expect(completed.status).toBe(302);
    expect(handoffUrl).toMatch(
      /^https:\/\/acme\.tolo\.test\/auth\/handoff\?code=/,
    );
    expect(completed.headers.get("referrer-policy")).toBe("no-referrer");
    expect(
      completed.headers
        .getSetCookie()
        .filter((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`)),
    ).toEqual([expect.stringMatching(new RegExp(`^${SESSION_COOKIE}=;`))]);
    const ctx = await testAuth.auth.$context;
    expect(await ctx.adapter.findMany({ model: "session" })).toEqual([]);
    expect(await ctx.adapter.findMany({ model: "account" })).toEqual([
      expect.objectContaining({
        accountId: "user-1",
        accessToken: null,
        refreshToken: null,
        idToken: null,
      }),
    ]);
  });

  it("keeps each login's own tokens when one user finishes logins to two tenants at once", async () => {
    const provider = idp();
    let armed = false;
    let accountWrites = 0;
    let sessionsCreated = 0;
    let secondWrote = () => {};
    const secondWritten = new Promise<void>((resolve) => {
      secondWrote = resolve;
    });
    const testAuth = await createTestAuth(undefined, {
      account: {
        update: {
          after: async () => {
            if (armed && ++accountWrites === 2) secondWrote();
          },
        },
      },
      session: {
        create: {
          before: async () => {
            if (armed && ++sessionsCreated === 1) await secondWritten;
          },
        },
      },
    });
    const earlier = await logInUntilHandoff(testAuth, provider);
    await handOff(testAuth, earlier.handoffUrl, earlier.tenantJar);
    armed = true;
    const first = await authorizeAtIdp(testAuth, provider);
    const second = await authorizeAtIdp(testAuth, provider, {
      tenantId: OTHER_TENANT,
      host: OTHER_HOST,
    });

    const [toFirst, toSecond] = await Promise.all([
      callback(testAuth, first),
      callback(testAuth, second),
    ]);
    await handOff(
      testAuth,
      toFirst.headers.get("location") ?? "",
      first.tenantJar,
    );
    await handOff(
      testAuth,
      toSecond.headers.get("location") ?? "",
      second.tenantJar,
      OTHER_HOST,
    );

    await expect(
      testAuth.sessionAuth.accessToken(
        sessionHeaders(first.tenantJar),
        TENANT,
        {
          type: "tenant_access",
        },
      ),
    ).resolves.toBe(`tenant-access-user-1-${TENANT}`);
    await expect(
      testAuth.sessionAuth.accessToken(
        sessionHeaders(second.tenantJar),
        OTHER_TENANT,
        { type: "tenant_access" },
      ),
    ).resolves.toBe(`tenant-access-user-1-${OTHER_TENANT}`);
  });

  it("replaces the session this host already had", async () => {
    const provider = idp();
    const testAuth = await createTestAuth();
    const first = await logInUntilHandoff(testAuth, provider);
    await handOff(testAuth, first.handoffUrl, first.tenantJar);
    const earlier = sessionHeaders(first.tenantJar);

    const again = await logInUntilHandoff(testAuth, provider, {
      tenantJar: first.tenantJar,
    });
    await handOff(testAuth, again.handoffUrl, again.tenantJar);

    await expect(testAuth.sessionAuth.viewer(earlier, TENANT)).resolves.toEqual(
      {
        type: "anonymous",
      },
    );
    await expect(
      testAuth.sessionAuth.viewer(sessionHeaders(again.tenantJar), TENANT),
    ).resolves.toMatchObject({ type: "staff" });
    const ctx = await testAuth.auth.$context;
    expect(await ctx.adapter.findMany({ model: "session" })).toHaveLength(1);
  });

  it("accepts a code only once", async () => {
    const provider = idp();
    const testAuth = await createTestAuth();
    const login = await logInUntilHandoff(testAuth, provider);
    const replayJar = cookieJar();
    for (const [name, value] of login.tenantJar.cookies) {
      replayJar.cookies.set(name, value);
    }

    expect(
      (await handOff(testAuth, login.handoffUrl, login.tenantJar)).status,
    ).toBe(200);
    const replayed = await handOff(testAuth, login.handoffUrl, replayJar);

    expect(loginErrorPage(replayed)).toEqual({
      status: 302,
      page: "https://tolo.test/auth/error",
      host: HOST,
      error: "invalid_handoff",
    });
    expect(replayed.headers.get("referrer-policy")).toBe("no-referrer");
    const ctx = await testAuth.auth.$context;
    expect(await ctx.adapter.findMany({ model: "session" })).toHaveLength(1);
  });

  it("rejects a code a minute after it was issued", async () => {
    const provider = idp();
    const testAuth = await createTestAuth();
    const login = await logInUntilHandoff(testAuth, provider);
    vi.useFakeTimers({ now: Date.now() + 61_000, toFake: ["Date"] });

    const handedOff = await handOff(
      testAuth,
      login.handoffUrl,
      login.tenantJar,
    );

    expect(loginErrorPage(handedOff)).toMatchObject({
      page: "https://tolo.test/auth/error",
      error: "invalid_handoff",
    });
    await expect(
      testAuth.sessionAuth.viewer(sessionHeaders(login.tenantJar), TENANT),
    ).resolves.toEqual({ type: "anonymous" });
  });

  it("rejects a code on a host other than the one that started the login, and burns it", async () => {
    const provider = idp();
    const testAuth = await createTestAuth();
    const login = await logInUntilHandoff(testAuth, provider);
    const onOtherHost = new URL(login.handoffUrl);
    onOtherHost.host = OTHER_HOST;

    expect(
      loginErrorPage(
        await handOff(testAuth, onOtherHost.href, login.tenantJar, OTHER_HOST),
      ),
    ).toMatchObject({ host: OTHER_HOST, error: "invalid_handoff" });
    expect(
      loginErrorPage(
        await handOff(testAuth, login.handoffUrl, login.tenantJar),
      ),
    ).toMatchObject({ host: HOST, error: "invalid_handoff" });
  });

  it.each([
    ["a different binding cookie", (value: string) => `${value}x`],
    ["no binding cookie", () => undefined],
  ])("rejects a code presented with %s", async (_, tamper) => {
    const provider = idp();
    const testAuth = await createTestAuth();
    const login = await logInUntilHandoff(testAuth, provider);
    for (const [name, value] of login.tenantJar.cookies) {
      const tampered = tamper(value);
      if (tampered) login.tenantJar.cookies.set(name, tampered);
      else login.tenantJar.cookies.delete(name);
    }

    const handedOff = await handOff(
      testAuth,
      login.handoffUrl,
      login.tenantJar,
    );

    expect(loginErrorPage(handedOff)).toMatchObject({
      error: "invalid_handoff",
    });
    const ctx = await testAuth.auth.$context;
    expect(await ctx.adapter.findMany({ model: "session" })).toEqual([]);
  });

  it.each([
    "//evil.example/",
    "https://evil.example/",
    "/\\evil.example/",
    "/a/..//evil.example/",
    "management",
  ])("refuses to start a login that returns to %s", async (returnPath) => {
    idp();
    const testAuth = await createTestAuth();

    const started = await testAuth.flow.start(
      onHost(
        `https://${HOST}/auth/login?return=${encodeURIComponent(returnPath)}`,
        HOST,
        "",
      ),
      TENANT,
    );

    expect(loginErrorPage(started)).toEqual({
      status: 302,
      page: "https://tolo.test/auth/error",
      host: HOST,
      error: "invalid_return",
    });
    expect(started.headers.getSetCookie()).toEqual([]);
  });

  it("refuses to begin a login it did not start", async () => {
    idp();
    const testAuth = await createTestAuth();

    const begun = await testAuth.flow.begin(
      onHost("https://tolo.test/auth/begin?login=unknown", "tolo.test", ""),
    );

    expect(loginErrorPage(begun)).toEqual({
      status: 302,
      page: "https://tolo.test/auth/error",
      error: "login_expired",
    });
  });

  it("sends a callback that arrives after its login expired to the error page with the tenant host", async () => {
    const provider = idp();
    const testAuth = await createTestAuth();
    const authorized = await authorizeAtIdp(testAuth, provider);
    const ctx = await testAuth.auth.$context;
    await ctx.adapter.update({
      model: "pendingLogin",
      where: [{ field: "host", value: HOST }],
      update: { expiresAt: new Date(Date.now() - 1000) },
    });

    const completed = await callback(testAuth, authorized);

    expect(loginErrorPage(completed)).toEqual({
      status: 302,
      page: "https://tolo.test/auth/error",
      host: HOST,
      error: "login_expired",
    });
    expect(await ctx.adapter.findMany({ model: "session" })).toEqual([]);
  });

  it("sends an error the IdP returns to the callback to the error page with the tenant host", async () => {
    const provider = idp();
    const testAuth = await createTestAuth();
    const { authorizeUrl, rootJar } = await authorizeAtIdp(testAuth, provider);

    const answered = await testAuth.auth.handler(
      onHost(
        `https://tolo.test/api/auth/callback/tolo-idp?error=access_denied&state=${authorizeUrl.searchParams.get("state")}`,
        "tolo.test",
        rootJar.header(),
      ),
    );

    expect(loginErrorPage(answered)).toEqual({
      status: 302,
      page: "https://tolo.test/auth/error",
      host: HOST,
      error: "access_denied",
    });
  });

  it("sends a callback without a state to the error page", async () => {
    idp();
    const testAuth = await createTestAuth();

    const answered = await testAuth.auth.handler(
      onHost(
        "https://tolo.test/api/auth/callback/tolo-idp?code=x",
        "tolo.test",
        "",
      ),
    );

    expect(loginErrorPage(answered)).toMatchObject({
      status: 302,
      page: "https://tolo.test/auth/error",
    });
  });
});

describe("login page", () => {
  it("posts the credentials to the IdP's login API and resumes the authorization with the challenge", async () => {
    idp();
    const testAuth = await createTestAuth();

    await expect(testAuth.flow.challengeLogin("challenge-1")).resolves.toEqual({
      endpoint: "https://idp.test/api/login",
      challenge: "challenge-1",
      resumeUrl: "https://idp.test/oauth2/authorize?challenge=challenge-1",
    });
  });
});

describe.skipIf(!process.env.AUTH_TEST_DATABASE_URL)("on PostgreSQL", () => {
  const schema = `login_test_${process.pid}_${Date.now()}`;
  const pools: Pool[] = [];
  const pool = () => {
    const created = new Pool({
      connectionString: process.env.AUTH_TEST_DATABASE_URL,
      options: `-c search_path=${schema}`,
    });
    pools.push(created);
    return created;
  };

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

  it("hands a login over once", async () => {
    const provider = idp();
    const testAuth = await createTestAuth(pool());
    const login = await logInUntilHandoff(testAuth, provider);
    const replayJar = cookieJar();
    for (const [name, value] of login.tenantJar.cookies) {
      replayJar.cookies.set(name, value);
    }

    const [handedOff, replayed] = await Promise.all([
      handOff(testAuth, login.handoffUrl, login.tenantJar),
      handOff(testAuth, login.handoffUrl, replayJar),
    ]);

    expect([handedOff.status, replayed.status].sort()).toEqual([200, 302]);
    const ctx = await testAuth.auth.$context;
    expect(await ctx.adapter.findMany({ model: "session" })).toHaveLength(1);
    expect(await ctx.adapter.findMany({ model: "account" })).toEqual([
      expect.objectContaining({ accessToken: null, refreshToken: null }),
    ]);
  });
});
