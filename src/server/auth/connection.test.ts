import { generateKeyPairSync, sign } from "node:crypto";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import {
  type AuthEnv,
  authOptions,
  type RealAuth,
  type SessionLock,
} from "./betterAuth";
import { createConnectionAuth } from "./connection";

vi.mock("server-only", () => ({}));

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
const CAMERA = "2222222222222222";
const OTHER_CAMERA = "3333333333333333";
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

function inProcessLock(): SessionLock {
  const tails = new Map<string, Promise<unknown>>();
  return (sessionId, task) => {
    const run = (tails.get(sessionId) ?? Promise.resolve())
      .catch(() => {})
      .then(task);
    tails.set(sessionId, run);
    return run;
  };
}

function idp() {
  const requests: { form: URLSearchParams; authorization: string | null }[] =
    [];
  let exchanged = 0;
  let refreshed = 0;
  let nonce = "";
  server.use(
    http.post(TOKEN_ENDPOINT, async ({ request }) => {
      const form = new URLSearchParams(await request.text());
      requests.push({
        form,
        authorization: request.headers.get("authorization"),
      });
      const grant = form.get("grant_type");
      if (grant === "refresh_token") {
        refreshed += 1;
        return HttpResponse.json({
          access_token: `connection-tenant-refreshed-${refreshed}`,
          refresh_token: `connection-refresh-${refreshed}`,
          expires_in: 900,
        });
      }
      if (grant === "urn:ietf:params:oauth:grant-type:token-exchange") {
        exchanged += 1;
        return HttpResponse.json({
          access_token: `connection-event-${exchanged}`,
          expires_in: 600,
          issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
          token_type: "Bearer",
        });
      }
      const now = Math.floor(Date.now() / 1000);
      return HttpResponse.json({
        access_token: "connection-tenant-1",
        refresh_token: "connection-refresh-0",
        id_token: signIdToken({
          iss: "https://idp.test",
          aud: "observation-connection",
          sub: "idp-staff",
          nonce,
          iat: now,
          exp: now + 300,
        }),
        token_type: "Bearer",
        expires_in: 900,
      });
    }),
  );
  return {
    requests,
    refreshed: () => refreshed,
    setNonce(value: string | null) {
      nonce = value ?? "";
    },
  };
}

function createTestConnection() {
  const database = memoryAdapter({
    user: [],
    session: [],
    account: [],
    verification: [],
    tenantAccessToken: [],
    eventAccessToken: [],
    pendingLogin: [],
    pendingConnectionAuthorization: [],
    connectionAuthorization: [],
    connectionEventAccess: [],
  }) as BetterAuthOptions["database"];
  const options = authOptions(env);
  const auth = betterAuth({ ...options, database });
  const realAuth = {
    auth: auth as unknown as RealAuth["auth"],
    env,
    lock: inProcessLock(),
  } as RealAuth;
  return {
    auth,
    connection: createConnectionAuth(realAuth, {
      redirectUri: "https://web.test/api/auth/connection/callback",
      requireStaffMatch: true,
    }),
  };
}

type TestConnection = ReturnType<typeof createTestConnection>;

async function start(
  connection: TestConnection["connection"],
  provider?: ReturnType<typeof idp>,
  cameraIds: string[] = [CAMERA],
) {
  const location = await connection.start({
    tenantId: TENANT,
    eventId: EVENT,
    pageEdgeDeviceId: PAGE,
    cameraIds,
    staffSub: "idp-staff",
    returnPath: `/event/${EVENT}/observation`,
  });
  provider?.setNonce(new URL(location).searchParams.get("nonce"));
  return location;
}

async function callback(
  { connection }: TestConnection,
  location: string,
  {
    code = "code-1",
    error,
    viewer = { type: "staff" as const, userId: "idp-staff", tenantId: TENANT },
  }: {
    code?: string;
    error?: string;
    viewer?: Parameters<TestConnection["connection"]["callback"]>[0]["viewer"];
  } = {},
) {
  const state = new URL(location).searchParams.get("state") ?? "";
  return connection.callback({ code, state, error, viewer });
}

async function storedAuthorization(auth: TestConnection["auth"]) {
  const { adapter } = await auth.$context;
  return adapter.findOne<Record<string, unknown>>({
    model: "connectionAuthorization",
    where: [{ field: "tenantId", value: TENANT }],
  });
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
    http.get("https://idp.test/oauth2/jwks", () =>
      HttpResponse.json({ keys: [jwk] }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("connection authorization start", () => {
  it("stores a hashed state and PKCE verifier and redirects to the connection client", async () => {
    const test = createTestConnection();
    const provider = idp();
    const location = await start(test.connection, provider);
    const url = new URL(location);

    expect(url.origin).toBe("https://idp.test");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "observation-connection",
      redirect_uri: "https://web.test/api/auth/connection/callback",
      scope: "openid events.read",
      resource: `https://api.tolo.test/tenants/${TENANT}`,
      audience: "backend-api",
      prompt: "none",
      code_challenge_method: "S256",
    });
    expect(url.searchParams.get("code_challenge")).toMatch(
      /^[A-Za-z0-9_-]{43}$/,
    );
    expect(url.searchParams.get("nonce")).toBeTruthy();
    expect(url.searchParams.get("state")).toBeTruthy();

    const { adapter } = await test.auth.$context;
    const pending = await adapter.findOne<Record<string, unknown>>({
      model: "pendingConnectionAuthorization",
      where: [{ field: "eventId", value: EVENT }],
    });
    expect(pending).toMatchObject({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
      cameraIds: JSON.stringify([CAMERA]),
      staffSub: "idp-staff",
      returnPath: `/event/${EVENT}/observation`,
      redirectUri: "https://web.test/api/auth/connection/callback",
    });
    expect(pending?.stateHash).not.toBe(url.searchParams.get("state"));
  });

  it("replaces an earlier pending authorization for the same page", async () => {
    const test = createTestConnection();
    const provider = idp();
    await start(test.connection, provider);
    await start(test.connection, provider);
    const { adapter } = await test.auth.$context;
    const pending = await adapter.findMany({
      model: "pendingConnectionAuthorization",
      where: [{ field: "eventId", value: EVENT }],
    });
    expect(pending).toHaveLength(1);
  });
});

describe("connection authorization callback", () => {
  it("exchanges the code with the connection client and stores the delegation", async () => {
    const test = createTestConnection();
    const provider = idp();
    const location = await start(test.connection, provider);
    const redirect = await callback(test, location);

    expect(redirect).toBe(
      `/event/${EVENT}/observation?cameraConnection=authorized`,
    );
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0].authorization).toBe(
      `Basic ${Buffer.from("observation-connection:connection-secret").toString("base64")}`,
    );
    expect(Object.fromEntries(provider.requests[0].form)).toMatchObject({
      grant_type: "authorization_code",
      code: "code-1",
      redirect_uri: "https://web.test/api/auth/connection/callback",
    });
    expect(provider.requests[0].form.get("code_verifier")).toBeTruthy();

    expect(await storedAuthorization(test.auth)).toMatchObject({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
      cameraIds: JSON.stringify([CAMERA]),
      staffSub: "idp-staff",
      accessToken: "connection-tenant-1",
      refreshToken: "connection-refresh-0",
    });
    const { adapter } = await test.auth.$context;
    expect(
      await adapter.findOne({
        model: "pendingConnectionAuthorization",
        where: [{ field: "eventId", value: EVENT }],
      }),
    ).toBeNull();
  });

  it("refuses a callback whose subject does not match the delegated staff", async () => {
    const test = createTestConnection();
    const provider = idp();
    const location = await start(test.connection, provider);
    const redirect = await callback(test, location, {
      viewer: {
        type: "staff",
        userId: "another-staff",
        tenantId: TENANT,
      },
    });

    expect(redirect).toBe(
      `/event/${EVENT}/observation?cameraConnection=failed`,
    );
    expect(await storedAuthorization(test.auth)).toBeNull();
  });

  it("returns login_required to the return path without falling back to the console token", async () => {
    const test = createTestConnection();
    const provider = idp();
    const location = await start(test.connection, provider);
    const redirect = await callback(test, location, {
      error: "login_required",
    });

    expect(redirect).toBe(
      `/event/${EVENT}/observation?cameraConnection=login_required`,
    );
    expect(await storedAuthorization(test.auth)).toBeNull();
  });

  it("rejects an unknown state", async () => {
    const test = createTestConnection();
    const redirect = await test.connection.callback({
      code: "code-1",
      state: "unknown",
      error: undefined,
      viewer: { type: "staff", userId: "idp-staff", tenantId: TENANT },
    });
    expect(redirect).toBe(
      "http://localhost/auth/error?error=connection_state_invalid",
    );
  });
});

describe("connection event_access", () => {
  async function authorized() {
    const test = createTestConnection();
    const provider = idp();
    await callback(test, await start(test.connection, provider));
    return { ...test, provider };
  }

  it("exchanges the tenant_access for events.read and caches the event_access", async () => {
    const test = await authorized();
    const first = await test.connection.eventAccess({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
      cameraEdgeDeviceId: CAMERA,
    });
    const second = await test.connection.eventAccess({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
      cameraEdgeDeviceId: CAMERA,
    });

    expect(first).toBe("connection-event-1");
    expect(second).toBe(first);
    expect(
      test.provider.requests.filter(
        ({ form }) =>
          form.get("grant_type") ===
          "urn:ietf:params:oauth:grant-type:token-exchange",
      ),
    ).toHaveLength(1);
    const exchange = test.provider.requests.at(-1)?.form;
    expect(Object.fromEntries(exchange ?? [])).toMatchObject({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: "connection-tenant-1",
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      resource: `https://api.tolo.test/tenants/${TENANT}/events/${EVENT}`,
      audience: "backend-api",
      scope: "events.read",
    });
  });

  it("rejects a camera that is not in the stored delegation without exchanging", async () => {
    const test = await authorized();
    const before = test.provider.requests.length;

    await expect(
      test.connection.eventAccess({
        tenantId: TENANT,
        eventId: EVENT,
        pageEdgeDeviceId: PAGE,
        cameraEdgeDeviceId: OTHER_CAMERA,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: { code: "CAMERA_NOT_DELEGATED" },
    });
    expect(test.provider.requests).toHaveLength(before);
  });

  it("refreshes an expired tenant_access once and exchanges the refreshed token", async () => {
    const test = await authorized();
    const { adapter } = await test.auth.$context;
    await adapter.update({
      model: "connectionAuthorization",
      where: [{ field: "eventId", value: EVENT }],
      update: { accessTokenExpiresAt: new Date(Date.now() - 60_000) },
    });

    const token = await test.connection.eventAccess({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
      cameraEdgeDeviceId: CAMERA,
    });

    expect(token).toBe("connection-event-1");
    expect(test.provider.refreshed()).toBe(1);
    expect(test.provider.requests.at(-1)?.form.get("subject_token")).toBe(
      "connection-tenant-refreshed-1",
    );
    expect(await storedAuthorization(test.auth)).toMatchObject({
      accessToken: "connection-tenant-refreshed-1",
      refreshToken: "connection-refresh-1",
    });
  });

  it("deletes the authorization and asks for reauthorization when the refresh is rejected", async () => {
    const test = await authorized();
    const { adapter } = await test.auth.$context;
    await adapter.update({
      model: "connectionAuthorization",
      where: [{ field: "eventId", value: EVENT }],
      update: { accessTokenExpiresAt: new Date(Date.now() - 60_000) },
    });
    server.use(
      http.post(TOKEN_ENDPOINT, () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 400 }),
      ),
    );

    await expect(
      test.connection.eventAccess({
        tenantId: TENANT,
        eventId: EVENT,
        pageEdgeDeviceId: PAGE,
        cameraEdgeDeviceId: CAMERA,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: { code: "CONNECTION_AUTHORIZATION_REQUIRED" },
    });
    expect(await storedAuthorization(test.auth)).toBeNull();
  });

  it("asks for reauthorization when no authorization exists", async () => {
    const test = createTestConnection();
    idp();
    await expect(
      test.connection.eventAccess({
        tenantId: TENANT,
        eventId: EVENT,
        pageEdgeDeviceId: PAGE,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: { code: "CONNECTION_AUTHORIZATION_REQUIRED" },
    });
  });
});

describe("connection delegation cleanup", () => {
  async function authorized(cameraIds: string[] = [CAMERA]) {
    const test = createTestConnection();
    const provider = idp();
    await callback(test, await start(test.connection, provider, cameraIds));
    const { adapter } = await test.auth.$context;
    await test.connection.eventAccess({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
    });
    return { ...test, adapter, provider };
  }

  async function storedCameraIds(test: TestConnection) {
    const stored = await storedAuthorization(test.auth);
    return stored ? JSON.parse(stored.cameraIds as string) : null;
  }

  it("removes only the unregistered camera and keeps the authorization and cached event access", async () => {
    const test = await authorized([CAMERA, OTHER_CAMERA]);
    await test.connection.deleteForCamera(EVENT, CAMERA);

    expect(await storedCameraIds(test)).toEqual([OTHER_CAMERA]);
    expect(
      await test.adapter.findMany({
        model: "connectionEventAccess",
        where: [{ field: "eventId", value: EVENT }],
      }),
    ).toHaveLength(1);
    await expect(
      test.connection.eventAccess({
        tenantId: TENANT,
        eventId: EVENT,
        pageEdgeDeviceId: PAGE,
        cameraEdgeDeviceId: OTHER_CAMERA,
      }),
    ).resolves.toBe("connection-event-1");
  });

  it("deletes the authorization and cached event access when the last camera is removed", async () => {
    const test = await authorized();
    await test.connection.deleteForCamera(EVENT, CAMERA);

    expect(await storedAuthorization(test.auth)).toBeNull();
    expect(
      await test.adapter.findMany({
        model: "connectionEventAccess",
        where: [{ field: "eventId", value: EVENT }],
      }),
    ).toHaveLength(0);
  });

  it("keeps the authorization when an unrelated camera is unregistered", async () => {
    const test = await authorized();
    await test.connection.deleteForCamera(EVENT, OTHER_CAMERA);
    expect(await storedCameraIds(test)).toEqual([CAMERA]);
  });

  it("adds a camera to an existing delegation without reauthorization", async () => {
    const test = await authorized();
    await test.connection.addForCamera(EVENT, PAGE, OTHER_CAMERA);

    expect(await storedCameraIds(test)).toEqual([CAMERA, OTHER_CAMERA]);
    await expect(
      test.connection.eventAccess({
        tenantId: TENANT,
        eventId: EVENT,
        pageEdgeDeviceId: PAGE,
        cameraEdgeDeviceId: OTHER_CAMERA,
      }),
    ).resolves.toBe("connection-event-1");
    expect(test.provider.refreshed()).toBe(0);
  });

  it("does nothing when no authorization exists to add a camera to", async () => {
    const test = createTestConnection();
    idp();
    await expect(
      test.connection.addForCamera(EVENT, PAGE, OTHER_CAMERA),
    ).resolves.toBeUndefined();
    expect(await storedAuthorization(test.auth)).toBeNull();
  });

  it("deletes every authorization for the event", async () => {
    const test = await authorized();
    await test.connection.deleteForEvent(EVENT);
    expect(await storedAuthorization(test.auth)).toBeNull();
  });
});
