import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { HttpResponse, http } from "msw";
import type { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/mocks/server";
import {
  type AuthEnv,
  advisoryLock,
  advisoryLockMany,
  advisoryLockManyDynamic,
  authOptions,
  type RealAuth,
  type SessionLock,
  type SessionLocks,
  type SessionLocksDynamic,
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
const CONNECTION_LOCK_KEY = `connection:${TENANT}:${EVENT}:${PAGE}`;
const EVENT_LOCK_KEY = `connection-event:${EVENT}`;
const TOKEN_ENDPOINT = "https://idp.test/oauth2/token";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

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

function instrumentedLock() {
  const base = inProcessLock();
  const listeners: {
    predicate: (key: string) => boolean;
    resolve: () => void;
  }[] = [];
  const lock: SessionLock = (key, task) => {
    const index = listeners.findIndex((listener) => listener.predicate(key));
    if (index >= 0) listeners.splice(index, 1)[0].resolve();
    return base(key, task);
  };
  return {
    lock,
    lockMany: inProcessLockMany(lock),
    whenLockCalled: (predicate: (key: string) => boolean = () => true) =>
      new Promise<void>((resolve) => {
        listeners.push({ predicate, resolve });
      }),
  };
}

function idp(subject = "idp-staff") {
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
          sub: subject,
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

function createTestConnection(
  lock: SessionLock = inProcessLock(),
  lockMany: SessionLocks = inProcessLockMany(lock),
  lockManyDynamic: SessionLocksDynamic = (keys, selectMoreKeys, task) =>
    lockMany(keys, async () => lockMany(await selectMoreKeys(), task)),
) {
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
    connectionDelegationState: [],
    browserHostState: [],
  }) as BetterAuthOptions["database"];
  const options = authOptions(env);
  const auth = betterAuth({ ...options, database });
  const realAuth = {
    auth: auth as unknown as RealAuth["auth"],
    env,
    lock,
    lockMany,
    lockManyDynamic,
  } as RealAuth;
  return {
    auth,
    realAuth,
    connection: createConnectionAuth(realAuth, {
      redirectUri: "https://web.test/api/auth/connection/callback",
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
    host: "acme.localhost:3000",
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
  }: {
    code?: string;
    error?: string;
  } = {},
) {
  const state = new URL(location).searchParams.get("state") ?? "";
  return connection.callback({ code, state, error });
}

async function storedAuthorization(auth: TestConnection["auth"]) {
  const { adapter } = await auth.$context;
  return adapter.findOne<Record<string, unknown>>({
    model: "connectionAuthorization",
    where: [{ field: "tenantId", value: TENANT }],
  });
}

async function holdConnectionLock(test: TestConnection) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = test.realAuth.lock(CONNECTION_LOCK_KEY, async () => {
    await gate;
  });
  return {
    async release() {
      release();
      await held;
    },
  };
}

async function holdEventLock(test: TestConnection) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = test.realAuth.lock(EVENT_LOCK_KEY, async () => {
    await gate;
  });
  return {
    async release() {
      release();
      await held;
    },
  };
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

function fakePool(max = Number.POSITIVE_INFINITY) {
  const lockKeys: string[] = [];
  let active = 0;
  let maxActive = 0;
  const waiting: (() => void)[] = [];
  const client = {
    query: async (text: string, values?: unknown[]) => {
      if (text.includes("pg_advisory_xact_lock")) {
        lockKeys.push(String(values?.[0]));
      }
      return { rows: [] };
    },
    release: () => {
      active -= 1;
      waiting.shift()?.();
    },
  };
  return {
    pool: {
      connect: async () => {
        if (active >= max) {
          await new Promise<void>((resolve) => waiting.push(resolve));
        }
        active += 1;
        maxActive = Math.max(maxActive, active);
        return client;
      },
    } as unknown as Pool,
    lockKeys,
    maxActive: () => maxActive,
  };
}

describe("advisory locks", () => {
  it("acquires multiple keys on one connection in sorted order", async () => {
    const fake = fakePool();

    await advisoryLockMany(fake.pool)(["z", "a", "m", "a"], async () => {});

    expect(fake.lockKeys).toEqual(["a", "m", "z"]);
    expect(fake.maxActive()).toBe(1);
  });

  it("selects additional locks under the initial lock on the same connection", async () => {
    const fake = fakePool(1);
    const task = vi.fn(async () => {
      expect(fake.lockKeys).toEqual(["event", "a", "z"]);
      return "done";
    });
    await expect(
      advisoryLockManyDynamic(fake.pool)(
        ["event"],
        async () => {
          expect(fake.lockKeys).toEqual(["event"]);
          return ["z", "event", "a", "a"];
        },
        task,
      ),
    ).resolves.toBe("done");
    expect(task).toHaveBeenCalledOnce();
    expect(fake.maxActive()).toBe(1);
  });

  it.each(["select", "task"])(
    "releases the connection when %s fails",
    async (stage) => {
      const fake = fakePool(1);
      const lock = advisoryLockManyDynamic(fake.pool);
      const error = new Error("failed");
      const task = vi.fn(async () => {
        if (stage === "task") throw error;
      });
      await expect(
        lock(
          ["event"],
          async () => {
            if (stage === "select") throw error;
            return ["connection"];
          },
          task,
        ),
      ).rejects.toBe(error);
      if (stage === "select") expect(task).not.toHaveBeenCalled();
      await expect(
        lock(
          ["event"],
          async () => [],
          async () => "released",
        ),
      ).resolves.toBe("released");
      expect(fake.maxActive()).toBe(1);
    },
  );

  it.each([
    "deleteForCamera",
    "addForCamera",
    "deleteForPage",
    "deleteForEvent",
  ] as const)(
    "%s completes with a single pooled connection",
    async (operation) => {
      const fake = fakePool(1);
      const test = createTestConnection(
        advisoryLock(fake.pool),
        advisoryLockMany(fake.pool),
        advisoryLockManyDynamic(fake.pool),
      );
      const provider = idp();
      await callback(test, await start(test.connection, provider));
      fake.lockKeys.length = 0;

      if (operation === "addForCamera") {
        await test.connection.addForCamera(EVENT, PAGE, OTHER_CAMERA);
        expect(
          JSON.parse(String((await storedAuthorization(test.auth))?.cameraIds)),
        ).toEqual([CAMERA, OTHER_CAMERA]);
      } else {
        if (operation === "deleteForCamera")
          await test.connection.deleteForCamera(EVENT, CAMERA);
        if (operation === "deleteForPage")
          await test.connection.deleteForPage(EVENT, PAGE);
        if (operation === "deleteForEvent")
          await test.connection.deleteForEvent(EVENT);
        expect(await storedAuthorization(test.auth)).toBeNull();
      }
      expect(fake.lockKeys).toEqual([EVENT_LOCK_KEY, CONNECTION_LOCK_KEY]);
      expect(fake.maxActive()).toBe(1);
    },
  );

  it("runs concurrent starts and stops without deadlocking", async () => {
    const fake = fakePool();
    const test = createTestConnection(
      advisoryLock(fake.pool),
      advisoryLockMany(fake.pool),
      advisoryLockManyDynamic(fake.pool),
    );

    await expect(
      Promise.all([
        start(test.connection),
        start(test.connection, undefined, [CAMERA, OTHER_CAMERA]),
        test.connection.deleteForCamera(EVENT, CAMERA),
        test.connection.deleteForEvent(EVENT),
      ]),
    ).resolves.toHaveLength(4);
    expect(fake.maxActive()).toBeLessThanOrEqual(4);
  }, 15_000);
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
      host: "acme.localhost:3000",
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
  it("exchanges the code without a viewer session and returns to the starting tenant", async () => {
    const test = createTestConnection();
    const provider = idp();
    const location = await start(test.connection, provider);
    const redirect = await callback(test, location);

    expect(redirect).toBe(
      `http://acme.localhost:3000/event/${EVENT}/observation?cameraConnection=authorized`,
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
    expect(sha256(provider.requests[0].form.get("code_verifier") ?? "")).toBe(
      new URL(location).searchParams.get("code_challenge"),
    );

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
    const provider = idp("another-staff");
    const location = await start(test.connection, provider);
    const redirect = await callback(test, location);

    expect(redirect).toBe(
      `http://acme.localhost:3000/event/${EVENT}/observation?cameraConnection=failed`,
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
      `http://acme.localhost:3000/event/${EVENT}/observation?cameraConnection=login_required`,
    );
    expect(await storedAuthorization(test.auth)).toBeNull();
  });

  it("rejects an ID token with a different nonce", async () => {
    const test = createTestConnection();
    const provider = idp();
    const location = await start(test.connection, provider);
    provider.setNonce("wrong-nonce");
    expect(await callback(test, location)).toContain("cameraConnection=failed");
    expect(await storedAuthorization(test.auth)).toBeNull();
  });

  it.each([
    { host: "evil.test", returnPath: "/safe" },
    { host: "localhost:3000", returnPath: "/safe" },
    { host: "acme.localhost:3000", returnPath: "//evil.test/" },
    { host: "acme.localhost:3000", returnPath: "/\\evil.test/" },
  ])("rejects an unsafe pending destination: %j", async (destination) => {
    const test = createTestConnection();
    const provider = idp();
    const location = await start(test.connection, provider);
    const { adapter } = await test.auth.$context;
    await adapter.update({
      model: "pendingConnectionAuthorization",
      where: [{ field: "eventId", value: EVENT }],
      update: destination,
    });
    expect(await callback(test, location)).toBe(
      "http://localhost/auth/error?error=connection_state_invalid",
    );
    expect(provider.requests).toHaveLength(0);
    expect(await storedAuthorization(test.auth)).toBeNull();
  });

  it("rejects an unknown state", async () => {
    const test = createTestConnection();
    const redirect = await test.connection.callback({
      code: "code-1",
      state: "unknown",
      error: undefined,
    });
    expect(redirect).toBe(
      "http://localhost/auth/error?error=connection_state_invalid",
    );
  });

  it("rejects a callback when a camera is stopped while the first authorization is pending", async () => {
    const test = createTestConnection();
    const provider = idp();
    const location = await start(test.connection, provider, [
      CAMERA,
      OTHER_CAMERA,
    ]);

    await test.connection.deleteForCamera(EVENT, CAMERA);
    const redirect = await callback(test, location);

    expect(redirect).toBe(
      `http://acme.localhost:3000/event/${EVENT}/observation?cameraConnection=failed`,
    );
    expect(await storedAuthorization(test.auth)).toBeNull();
    const { adapter } = await test.auth.$context;
    expect(
      await adapter.findMany({
        model: "pendingConnectionAuthorization",
      }),
    ).toEqual([]);
  });

  it("does not save a delegation when a stop races the initial pending creation", async () => {
    const test = createTestConnection();
    const provider = idp();
    const { adapter } = await test.auth.$context;
    const originalCreate = adapter.create.bind(adapter);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let paused!: () => void;
    const reached = new Promise<void>((resolve) => {
      paused = resolve;
    });
    adapter.create = (async (args) => {
      if (args.model === "pendingConnectionAuthorization") {
        paused();
        await gate;
      }
      return originalCreate(args);
    }) as typeof adapter.create;

    const started = start(test.connection, provider, [CAMERA]);
    await reached;
    const stopping = test.connection.deleteForCamera(EVENT, CAMERA);
    await new Promise((resolve) => setTimeout(resolve, 10));
    release();
    const location = await started;
    await stopping;

    const redirect = await callback(test, location);

    expect(redirect).toBe(
      `http://acme.localhost:3000/event/${EVENT}/observation?cameraConnection=failed`,
    );
    expect(await storedAuthorization(test.auth)).toBeNull();
    expect(
      await adapter.findMany({ model: "pendingConnectionAuthorization" }),
    ).toEqual([]);
  });

  it("does not save a pending authorization that a deletion overtakes", async () => {
    const instrumented = instrumentedLock();
    const test = createTestConnection(instrumented.lock, instrumented.lockMany);
    const provider = idp();
    const { adapter } = await test.auth.$context;
    const state = "pending-state-before-delete";
    const nonce = "pending-nonce-before-delete";
    provider.setNonce(nonce);

    const holdStarted = instrumented.whenLockCalled(
      (key) => key === EVENT_LOCK_KEY,
    );
    const hold = await holdEventLock(test);
    await holdStarted;

    const deleteQueued = instrumented.whenLockCalled(
      (key) => key === EVENT_LOCK_KEY,
    );
    const deletion = test.connection.deleteForPage(EVENT, PAGE);
    await deleteQueued;

    await adapter.create({
      model: "pendingConnectionAuthorization",
      data: {
        stateHash: sha256(state),
        codeVerifier: "pending-verifier",
        nonce,
        tenantId: TENANT,
        eventId: EVENT,
        pageEdgeDeviceId: PAGE,
        cameraIds: JSON.stringify([CAMERA]),
        staffSub: "idp-staff",
        host: "acme.localhost:3000",
        returnPath: `/event/${EVENT}/observation`,
        redirectUri: "https://web.test/api/auth/connection/callback",
        generation: 0,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    let releaseSave!: () => void;
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    let savePaused!: () => void;
    const saveReached = new Promise<void>((resolve) => {
      savePaused = resolve;
    });
    let pauseSave = true;
    const originalFindOne = adapter.findOne.bind(adapter);
    adapter.findOne = (async (args) => {
      if (pauseSave && args.model === "connectionAuthorization") {
        pauseSave = false;
        savePaused();
        await saveGate;
      }
      return originalFindOne(args);
    }) as typeof adapter.findOne;

    const callbackDone = test.connection.callback({
      code: "code-1",
      state,
      error: undefined,
    });
    const callbackQueued = instrumented.whenLockCalled(
      (key) => key === EVENT_LOCK_KEY,
    );
    const outcome = await Promise.race([
      saveReached.then(() => "save" as const),
      callbackQueued.then(() => "event" as const),
    ]);
    pauseSave = false;
    await hold.release();
    await deletion;
    if (outcome === "save") releaseSave();

    expect(await callbackDone).toBe(
      `http://acme.localhost:3000/event/${EVENT}/observation?cameraConnection=failed`,
    );
    expect(await storedAuthorization(test.auth)).toBeNull();
    expect(
      await adapter.findMany({ model: "pendingConnectionAuthorization" }),
    ).toEqual([]);
    await expect(
      test.connection.withAuthorization(
        {
          tenantId: TENANT,
          eventId: EVENT,
          pageEdgeDeviceId: PAGE,
          cameraEdgeDeviceId: CAMERA,
        },
        async () => "connection-token",
      ),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: { code: "CONNECTION_AUTHORIZATION_REQUIRED" },
    });
  });

  it("keeps a normal start, stop, and callback working", async () => {
    const test = createTestConnection();
    const provider = idp();
    const location = await start(test.connection, provider, [CAMERA]);

    const redirect = await callback(test, location);

    expect(redirect).toBe(
      `http://acme.localhost:3000/event/${EVENT}/observation?cameraConnection=authorized`,
    );
    expect(await storedAuthorization(test.auth)).toMatchObject({
      cameraIds: JSON.stringify([CAMERA]),
    });
    await test.connection.deleteForCamera(EVENT, CAMERA);
    expect(await storedAuthorization(test.auth)).toBeNull();
  });

  it("cancels a pending authorization on a page stop and accepts a fresh start", async () => {
    const test = createTestConnection();
    const provider = idp();
    const pending = await start(test.connection, provider, [CAMERA]);

    await test.connection.deleteForPage(EVENT, PAGE);
    const refused = await callback(test, pending);

    expect(refused).toBe(
      "http://localhost/auth/error?error=connection_state_invalid",
    );
    expect(await storedAuthorization(test.auth)).toBeNull();

    const fresh = await callback(
      test,
      await start(test.connection, provider, [CAMERA]),
    );
    expect(fresh).toBe(
      `http://acme.localhost:3000/event/${EVENT}/observation?cameraConnection=authorized`,
    );
    expect(await storedAuthorization(test.auth)).toMatchObject({
      cameraIds: JSON.stringify([CAMERA]),
    });
  });

  it("rejects a reauthorization callback that would restore a stopped camera", async () => {
    const test = createTestConnection();
    const provider = idp();
    await callback(
      test,
      await start(test.connection, provider, [CAMERA, OTHER_CAMERA]),
    );
    const reauthorization = await start(test.connection, provider, [
      CAMERA,
      OTHER_CAMERA,
    ]);

    await test.connection.deleteForCamera(EVENT, CAMERA);
    const redirect = await callback(test, reauthorization);

    expect(redirect).toBe(
      `http://acme.localhost:3000/event/${EVENT}/observation?cameraConnection=failed`,
    );
    const stored = await storedAuthorization(test.auth);
    expect(stored).toMatchObject({
      cameraIds: JSON.stringify([OTHER_CAMERA]),
    });
  });

  it("accepts a normal reauthorization", async () => {
    const test = createTestConnection();
    const provider = idp();
    await callback(test, await start(test.connection, provider, [CAMERA]));
    const reauthorization = await start(test.connection, provider, [
      CAMERA,
      OTHER_CAMERA,
    ]);

    const redirect = await callback(test, reauthorization);

    expect(redirect).toBe(
      `http://acme.localhost:3000/event/${EVENT}/observation?cameraConnection=authorized`,
    );
    expect(await storedAuthorization(test.auth)).toMatchObject({
      cameraIds: JSON.stringify([CAMERA, OTHER_CAMERA]),
    });
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
      edge_device_id: CAMERA,
    });
  });

  it("keeps unbound and camera-bound event access in separate cache entries", async () => {
    const test = await authorized();
    const unbound = await test.connection.eventAccess({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
    });
    const bound = await test.connection.eventAccess({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
      cameraEdgeDeviceId: CAMERA,
    });

    expect(unbound).toBe("connection-event-1");
    expect(bound).toBe("connection-event-2");
    expect(
      test.provider.requests.filter(
        ({ form }) =>
          form.get("grant_type") ===
          "urn:ietf:params:oauth:grant-type:token-exchange",
      ),
    ).toHaveLength(2);
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
    ).resolves.toBe("connection-event-2");
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

  it("refuses a connection request after the camera was stopped", async () => {
    const test = await authorized();
    await test.connection.deleteForCamera(EVENT, CAMERA);
    let ran = false;

    await expect(
      test.connection.withAuthorization(
        {
          tenantId: TENANT,
          eventId: EVENT,
          pageEdgeDeviceId: PAGE,
          cameraEdgeDeviceId: CAMERA,
        },
        async () => {
          ran = true;
          return "connection-token";
        },
      ),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      data: { code: "CONNECTION_AUTHORIZATION_REQUIRED" },
    });
    expect(ran).toBe(false);
  });

  it("serializes a connection request with a stop so no request starts after the stop", async () => {
    const instrumented = instrumentedLock();
    const test = createTestConnection(instrumented.lock, instrumented.lockMany);
    const provider = idp();
    await callback(test, await start(test.connection, provider));

    const holdStarted = instrumented.whenLockCalled();
    const hold = await holdConnectionLock(test);
    await holdStarted;

    const deleteStarted = instrumented.whenLockCalled(
      (key) => key === CONNECTION_LOCK_KEY,
    );
    const deletion = test.connection.deleteForCamera(EVENT, CAMERA);
    await deleteStarted;

    let ran = false;
    const requestStarted = instrumented.whenLockCalled();
    const request = test.connection
      .withAuthorization(
        {
          tenantId: TENANT,
          eventId: EVENT,
          pageEdgeDeviceId: PAGE,
          cameraEdgeDeviceId: CAMERA,
        },
        async () => {
          ran = true;
          return "connection-token";
        },
      )
      .then(
        (token) => ({ ok: true as const, token }),
        (error: unknown) => ({ ok: false as const, error }),
      );
    await requestStarted;

    await hold.release();
    await deletion;
    const result = await request;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({
        code: "PRECONDITION_FAILED",
        data: { code: "CONNECTION_AUTHORIZATION_REQUIRED" },
      });
    }
    expect(ran).toBe(false);
    expect(await storedAuthorization(test.auth)).toBeNull();
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
    ).resolves.toBe("connection-event-2");
    expect(test.provider.refreshed()).toBe(0);
  });

  it("rejects a camera removed while its connection request is waiting", async () => {
    const instrumented = instrumentedLock();
    const test = createTestConnection(instrumented.lock, instrumented.lockMany);
    const provider = idp();
    await callback(
      test,
      await start(test.connection, provider, [CAMERA, OTHER_CAMERA]),
    );
    await test.connection.eventAccess({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
    });

    const holdStarted = instrumented.whenLockCalled();
    const hold = await holdConnectionLock(test);
    await holdStarted;

    const deleteStarted = instrumented.whenLockCalled(
      (key) => key === CONNECTION_LOCK_KEY,
    );
    const deletion = test.connection.deleteForCamera(EVENT, CAMERA);
    await deleteStarted;

    const accessStarted = instrumented.whenLockCalled(
      (key) => key === EVENT_LOCK_KEY,
    );
    const access = test.connection.eventAccess({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
      cameraEdgeDeviceId: CAMERA,
    });
    const settled = access.then(
      (token) => ({ ok: true as const, token }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    await accessStarted;
    await hold.release();
    await deletion;

    const result = await settled;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({
        code: "PRECONDITION_FAILED",
        data: { code: "CAMERA_NOT_DELEGATED" },
      });
    }
    expect(await storedCameraIds(test)).toEqual([OTHER_CAMERA]);
  });

  it("connects a camera added while its connection request is waiting", async () => {
    const instrumented = instrumentedLock();
    const test = createTestConnection(instrumented.lock, instrumented.lockMany);
    const provider = idp();
    await callback(test, await start(test.connection, provider, [CAMERA]));

    const holdStarted = instrumented.whenLockCalled();
    const hold = await holdConnectionLock(test);
    await holdStarted;

    const addStarted = instrumented.whenLockCalled();
    const addition = test.connection.addForCamera(EVENT, PAGE, OTHER_CAMERA);
    await addStarted;

    const accessStarted = instrumented.whenLockCalled(
      (key) => key === EVENT_LOCK_KEY,
    );
    const access = test.connection.eventAccess({
      tenantId: TENANT,
      eventId: EVENT,
      pageEdgeDeviceId: PAGE,
      cameraEdgeDeviceId: OTHER_CAMERA,
    });
    const settled = access.then(
      (token) => ({ ok: true as const, token }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    await accessStarted;
    await hold.release();
    await addition;

    const result = await settled;
    expect(result.ok).toBe(true);
    expect(await storedCameraIds(test)).toEqual([CAMERA, OTHER_CAMERA]);
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
