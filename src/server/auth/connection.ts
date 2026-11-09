import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import {
  encodeBasicCredentials,
  verifyJwsAccessToken,
} from "better-auth/oauth2";
import { z } from "zod";
import { rootOrigin, tenantOrigin } from "@/lib/control/tenant";
import { getRealAuth, type RealAuth } from "./betterAuth";
import { idpDiscovery } from "./discovery";
import { sameHostPath } from "./login";

const PENDING_CONNECTION = "pendingConnectionAuthorization";
const CONNECTION_AUTHORIZATION = "connectionAuthorization";
const CONNECTION_EVENT_ACCESS = "connectionEventAccess";
const CONNECTION_DELEGATION_STATE = "connectionDelegationState";

const PENDING_TTL_MS = 10 * 60 * 1000;
const DEFAULT_AUTHORIZATION_TTL_MS = 24 * 60 * 60 * 1000;
const EXPIRY_MARGIN_MS = 30 * 1000;

export const CONNECTION_ERROR_CODES = {
  authorizationRequired: "CONNECTION_AUTHORIZATION_REQUIRED",
  cameraNotDelegated: "CAMERA_NOT_DELEGATED",
  notConfigured: "CONNECTION_NOT_CONFIGURED",
  refreshFailed: "CONNECTION_REFRESH_FAILED",
  eventAccessFailed: "CONNECTION_EVENT_ACCESS_FAILED",
} as const;

export type ConnectionErrorCode =
  (typeof CONNECTION_ERROR_CODES)[keyof typeof CONNECTION_ERROR_CODES];

export interface ConnectionAuthorizationInput {
  tenantId: string;
  eventId: string;
  pageEdgeDeviceId: string;
  cameraIds: string[];
  staffSub: string;
  host: string;
  returnPath: string;
}

export interface ConnectionCallbackInput {
  code: string | undefined;
  state: string | undefined;
  error: string | undefined;
}

export interface ConnectionAuthorization {
  id: string;
  connectionKey: string;
  tenantId: string;
  eventId: string;
  pageEdgeDeviceId: string;
  cameraIds: string;
  staffSub: string;
  accessToken: string;
  refreshToken: string;
  idToken?: string | null;
  accessTokenExpiresAt: Date;
  createdAt: Date;
  expiresAt: Date;
}

type PendingConnection = {
  id: string;
  stateHash: string;
  codeVerifier: string;
  nonce: string;
  tenantId: string;
  eventId: string;
  pageEdgeDeviceId: string;
  cameraIds: string;
  staffSub: string;
  host: string;
  returnPath: string;
  redirectUri: string;
  generation: number;
  expiresAt: Date;
};

export interface ConnectionDelegationState {
  id: string;
  connectionKey: string;
  generation: number;
  deletedAt?: Date | null;
  updatedAt: Date;
}

type ConnectionEventAccess = {
  id: string;
  connectionAuthorizationId: string;
  cacheKey: string;
  eventId: string;
  accessToken: string;
  expiresAt: Date;
};

type ConnectionEnvironment = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  resourceHost: string;
  redirectUri: string;
};

type Options = {
  redirectUri?: string;
  authorizationTtlMs?: number;
};

const tokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  id_token: z.string().optional(),
  expires_in: z.number(),
});
const exchangeResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
const randomToken = () => randomBytes(32).toString("base64url");

function connectionKey(
  tenantId: string,
  eventId: string,
  pageEdgeDeviceId: string,
): string {
  return `${tenantId}:${eventId}:${pageEdgeDeviceId}`;
}

function connectionLockKey(key: string): string {
  return `connection:${key}`;
}

function connectionEventLockKey(eventId: string): string {
  return `connection-event:${eventId}`;
}

type ConnectionTarget = {
  tenantId: string;
  eventId: string;
  pageEdgeDeviceId: string;
};

function parseCameraIds(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function oauthError(body: string): unknown {
  try {
    return JSON.parse(body).error;
  } catch {
    return undefined;
  }
}

function connectionError(
  code: ConnectionErrorCode,
  message: string,
  orpcCode: "PRECONDITION_FAILED" | "BAD_GATEWAY" = "PRECONDITION_FAILED",
): ORPCError<string, { code: ConnectionErrorCode }> {
  return new ORPCError(orpcCode, { message, data: { code } });
}

export function connectionResultPath(
  returnPath: string,
  result: "authorized" | "login_required" | "failed",
): string {
  const url = new URL(returnPath, "http://host.invalid");
  url.searchParams.set("cameraConnection", result);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function createConnectionAuth(
  realAuth: RealAuth,
  options: Options = {},
) {
  const discovery = idpDiscovery(realAuth.env.issuer);
  const authorizationTtlMs =
    options.authorizationTtlMs ??
    (Number(process.env.AUTH_CONNECTION_TTL_SECONDS) > 0
      ? Number(process.env.AUTH_CONNECTION_TTL_SECONDS) * 1000
      : DEFAULT_AUTHORIZATION_TTL_MS);
  // The local auth mock uses a synthetic staff subject, while the real IdP
  // login still returns the seeded user. Keep the real subject match strict.
  const requireStaffMatch = process.env.AUTH_MOCKING !== "enabled";

  function environment(redirectUri?: string): ConnectionEnvironment {
    const { issuer, connectionClientId, connectionClientSecret, resourceHost } =
      realAuth.env;
    const resolvedRedirectUri =
      redirectUri ||
      options.redirectUri ||
      process.env.AUTH_CONNECTION_REDIRECT_URI ||
      "http://localhost:3000/api/auth/connection/callback";
    if (
      !issuer ||
      !connectionClientId ||
      !connectionClientSecret ||
      !resourceHost
    ) {
      throw connectionError(
        CONNECTION_ERROR_CODES.notConfigured,
        "the observation connection client is not configured",
      );
    }
    return {
      issuer,
      clientId: connectionClientId,
      clientSecret: connectionClientSecret,
      resourceHost,
      redirectUri: resolvedRedirectUri,
    };
  }

  async function adapter() {
    return (await realAuth.auth.$context).adapter;
  }

  type Store = Awaited<ReturnType<typeof adapter>>;

  async function findState(store: Store, key: string) {
    return store.findOne<ConnectionDelegationState>({
      model: CONNECTION_DELEGATION_STATE,
      where: [{ field: "connectionKey", value: key }],
    });
  }

  async function ensureState(store: Store, key: string) {
    const existing = await findState(store, key);
    if (existing) return existing;
    return store.create<
      Omit<ConnectionDelegationState, "id">,
      ConnectionDelegationState
    >({
      model: CONNECTION_DELEGATION_STATE,
      data: { connectionKey: key, generation: 0, updatedAt: new Date() },
    });
  }

  async function advanceState(
    store: Store,
    key: string,
    { deletedAt }: { deletedAt?: Date | null } = {},
  ) {
    const state = await ensureState(store, key);
    await store.update({
      model: CONNECTION_DELEGATION_STATE,
      where: [{ field: "id", value: state.id }],
      update: {
        generation: Number(state.generation) + 1,
        updatedAt: new Date(),
        ...(deletedAt !== undefined && { deletedAt }),
      },
    });
  }

  async function deleteAuthorizationRows(store: Store, id: string) {
    await store.deleteMany({
      model: CONNECTION_EVENT_ACCESS,
      where: [{ field: "connectionAuthorizationId", value: id }],
    });
    await store.delete({
      model: CONNECTION_AUTHORIZATION,
      where: [{ field: "id", value: id }],
    });
  }

  async function pendingByState(state: string) {
    const store = await adapter();
    return store.findOne<PendingConnection>({
      model: PENDING_CONNECTION,
      where: [{ field: "stateHash", value: sha256(state) }],
    });
  }

  async function deletePending(id: string) {
    const store = await adapter();
    await store.delete({
      model: PENDING_CONNECTION,
      where: [{ field: "id", value: id }],
    });
  }

  async function saveAuthorizationIfCurrent(
    pending: PendingConnection,
    tokens: z.infer<typeof tokenResponse>,
    staffSub: string,
  ): Promise<boolean> {
    const store = await adapter();
    const key = connectionKey(
      pending.tenantId,
      pending.eventId,
      pending.pageEdgeDeviceId,
    );
    return realAuth.lockMany(
      [connectionEventLockKey(pending.eventId), connectionLockKey(key)],
      async () => {
        const state = await ensureState(store, key);
        if (Number(state.generation) !== Number(pending.generation)) {
          return false;
        }
        const now = new Date();
        const values = {
          connectionKey: key,
          tenantId: pending.tenantId,
          eventId: pending.eventId,
          pageEdgeDeviceId: pending.pageEdgeDeviceId,
          cameraIds: pending.cameraIds,
          staffSub,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          idToken: tokens.id_token ?? null,
          accessTokenExpiresAt: new Date(
            now.getTime() + tokens.expires_in * 1000,
          ),
          createdAt: now,
          expiresAt: new Date(now.getTime() + authorizationTtlMs),
        };
        const existing = await store.findOne<ConnectionAuthorization>({
          model: CONNECTION_AUTHORIZATION,
          where: [{ field: "connectionKey", value: key }],
        });
        if (existing) {
          await store.deleteMany({
            model: CONNECTION_EVENT_ACCESS,
            where: [{ field: "connectionAuthorizationId", value: existing.id }],
          });
          await store.update({
            model: CONNECTION_AUTHORIZATION,
            where: [{ field: "id", value: existing.id }],
            update: values,
          });
        } else {
          await store.create<
            Omit<ConnectionAuthorization, "id">,
            ConnectionAuthorization
          >({
            model: CONNECTION_AUTHORIZATION,
            data: values,
          });
        }
        await advanceState(store, key, { deletedAt: null });
        return true;
      },
    );
  }

  async function postToTokenEndpoint(
    env: ConnectionEnvironment,
    params: Record<string, string>,
  ) {
    return fetch((await discovery()).token_endpoint, {
      method: "POST",
      headers: {
        authorization: encodeBasicCredentials(env.clientId, env.clientSecret),
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams(params),
    });
  }

  async function verifyIdToken(
    env: ConnectionEnvironment,
    idToken: string,
    nonce: string,
  ) {
    const metadata = await discovery();
    if (!metadata.jwks_uri) {
      throw new Error("the IdP publishes no jwks_uri");
    }
    const claims = await verifyJwsAccessToken(idToken, {
      jwksFetch: metadata.jwks_uri,
      verifyOptions: {
        issuer: env.issuer,
        audience: env.clientId,
      },
    });
    if (typeof claims.sub !== "string" || !claims.sub) {
      throw new Error("the ID token has no sub");
    }
    if (claims.nonce !== nonce) {
      throw new Error("the ID token nonce does not match");
    }
    return claims.sub;
  }

  async function refreshTenantAccess(
    authorization: ConnectionAuthorization,
    env: ConnectionEnvironment,
    key: string,
  ): Promise<string> {
    const store = await adapter();
    const response = await postToTokenEndpoint(env, {
      grant_type: "refresh_token",
      refresh_token: authorization.refreshToken,
    });
    if (!response.ok) {
      const failure = await response.text();
      if (oauthError(failure) === "invalid_grant") {
        await deleteAuthorizationRows(store, authorization.id);
        await advanceState(store, key, { deletedAt: new Date() });
        throw connectionError(
          CONNECTION_ERROR_CODES.authorizationRequired,
          "the connection authorization was rejected; authorize the camera connection again",
        );
      }
      throw connectionError(
        CONNECTION_ERROR_CODES.refreshFailed,
        `refreshing the connection tenant_access failed with ${response.status}`,
        "BAD_GATEWAY",
      );
    }
    const tokens = tokenResponse.parse(await response.json());
    await store.update({
      model: CONNECTION_AUTHORIZATION,
      where: [{ field: "id", value: authorization.id }],
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        ...(tokens.id_token && { idToken: tokens.id_token }),
      },
    });
    return tokens.access_token;
  }

  async function tenantAccess(
    authorization: ConnectionAuthorization,
    env: ConnectionEnvironment,
    key: string,
  ) {
    if (
      authorization.accessTokenExpiresAt.getTime() - Date.now() >
      EXPIRY_MARGIN_MS
    ) {
      return authorization.accessToken;
    }
    return refreshTenantAccess(authorization, env, key);
  }

  async function exchangeEventAccess(
    authorization: ConnectionAuthorization,
    env: ConnectionEnvironment,
    key: string,
    cameraEdgeDeviceId?: string,
  ) {
    const store = await adapter();
    const cacheKey = `${authorization.id}:${authorization.eventId}:${cameraEdgeDeviceId ?? ""}`;
    const cached = await store.findOne<ConnectionEventAccess>({
      model: CONNECTION_EVENT_ACCESS,
      where: [{ field: "cacheKey", value: cacheKey }],
    });
    if (cached && cached.expiresAt.getTime() - Date.now() > EXPIRY_MARGIN_MS) {
      return cached.accessToken;
    }
    const params: Record<string, string> = {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: await tenantAccess(authorization, env, key),
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      resource: `https://${env.resourceHost}/tenants/${authorization.tenantId}/events/${encodeURIComponent(authorization.eventId)}`,
      audience: "backend-api",
      scope: "events.read",
    };
    if (cameraEdgeDeviceId) params.edge_device_id = cameraEdgeDeviceId;
    const response = await postToTokenEndpoint(env, params);
    if (!response.ok) {
      throw connectionError(
        CONNECTION_ERROR_CODES.eventAccessFailed,
        `the connection token exchange failed with ${response.status}`,
        "BAD_GATEWAY",
      );
    }
    const { access_token, expires_in } = exchangeResponse.parse(
      await response.json(),
    );
    const values = {
      connectionAuthorizationId: authorization.id,
      cacheKey,
      eventId: authorization.eventId,
      accessToken: access_token,
      expiresAt: new Date(Date.now() + expires_in * 1000),
    };
    if (cached) {
      await store.update({
        model: CONNECTION_EVENT_ACCESS,
        where: [{ field: "id", value: cached.id }],
        update: values,
      });
    } else {
      await store.create({
        model: CONNECTION_EVENT_ACCESS,
        data: values,
      });
    }
    return access_token;
  }

  async function withCurrentAuthorization<T>(
    key: string,
    eventId: string,
    cameraEdgeDeviceId: string | undefined,
    task: (
      authorization: ConnectionAuthorization,
      env: ConnectionEnvironment,
    ) => Promise<T>,
  ): Promise<T> {
    const env = environment();
    return realAuth.lockMany(
      [connectionEventLockKey(eventId), connectionLockKey(key)],
      async () => {
        const store = await adapter();
        const authorization = await store.findOne<ConnectionAuthorization>({
          model: CONNECTION_AUTHORIZATION,
          where: [{ field: "connectionKey", value: key }],
        });
        if (!authorization || authorization.expiresAt <= new Date()) {
          if (authorization) {
            await deleteAuthorizationRows(store, authorization.id);
            await advanceState(store, key, { deletedAt: new Date() });
          }
          throw connectionError(
            CONNECTION_ERROR_CODES.authorizationRequired,
            "no camera connection authorization; authorize the camera connection",
          );
        }
        if (
          cameraEdgeDeviceId &&
          !parseCameraIds(authorization.cameraIds).includes(cameraEdgeDeviceId)
        ) {
          throw connectionError(
            CONNECTION_ERROR_CODES.cameraNotDelegated,
            "the camera is not part of this page's connection delegation",
          );
        }
        return task(authorization, env);
      },
    );
  }

  return {
    /**
     * state と PKCE verifier を作り、接続用 client の prompt=none 認可へ
     * リダイレクトする URL を返す。
     */
    async start(input: ConnectionAuthorizationInput): Promise<string> {
      const env = environment();
      if (!tenantOrigin(input.host) || !sameHostPath(input.returnPath)) {
        throw new Error("invalid connection return destination");
      }
      const key = connectionKey(
        input.tenantId,
        input.eventId,
        input.pageEdgeDeviceId,
      );
      return realAuth.lockMany(
        [connectionEventLockKey(input.eventId), connectionLockKey(key)],
        async () => {
          const store = await adapter();
          const state = await ensureState(store, key);
          await store.deleteMany({
            model: PENDING_CONNECTION,
            where: [{ field: "expiresAt", operator: "lt", value: new Date() }],
          });
          const previous = await store.findMany<PendingConnection>({
            model: PENDING_CONNECTION,
            where: [
              { field: "eventId", value: input.eventId },
              { field: "pageEdgeDeviceId", value: input.pageEdgeDeviceId },
            ],
          });
          for (const row of previous ?? []) {
            await store.delete({
              model: PENDING_CONNECTION,
              where: [{ field: "id", value: row.id }],
            });
          }

          const stateValue = randomToken();
          const nonce = randomToken();
          const verifier = randomToken();
          const challenge = createHash("sha256")
            .update(verifier)
            .digest("base64url");
          await store.create({
            model: PENDING_CONNECTION,
            data: {
              stateHash: sha256(stateValue),
              codeVerifier: verifier,
              nonce,
              tenantId: input.tenantId,
              eventId: input.eventId,
              pageEdgeDeviceId: input.pageEdgeDeviceId,
              cameraIds: JSON.stringify([...new Set(input.cameraIds)]),
              staffSub: input.staffSub,
              host: input.host,
              returnPath: input.returnPath,
              redirectUri: env.redirectUri,
              generation: Number(state.generation),
              expiresAt: new Date(Date.now() + PENDING_TTL_MS),
            },
          });

          const url = new URL((await discovery()).authorization_endpoint);
          url.searchParams.set("response_type", "code");
          url.searchParams.set("client_id", env.clientId);
          url.searchParams.set("redirect_uri", env.redirectUri);
          url.searchParams.set("scope", "openid events.read");
          url.searchParams.set(
            "resource",
            `https://${env.resourceHost}/tenants/${input.tenantId}`,
          );
          url.searchParams.set("audience", "backend-api");
          url.searchParams.set("prompt", "none");
          url.searchParams.set("state", stateValue);
          url.searchParams.set("nonce", nonce);
          url.searchParams.set("code_challenge", challenge);
          url.searchParams.set("code_challenge_method", "S256");
          return url.href;
        },
      );
    },

    /**
     * 認可 code を接続用 client で交換し、委任とトークンを保存する。
     * 成功・login_required・失敗のいずれもブラウザを戻り先へリダイレクトする。
     */
    async callback(input: ConnectionCallbackInput): Promise<string> {
      const env = environment();
      const pending = input.state ? await pendingByState(input.state) : null;
      if (!pending || pending.expiresAt <= new Date()) {
        if (pending) await deletePending(pending.id);
        return `${rootOrigin()}/auth/error?error=connection_state_invalid`;
      }
      const origin = tenantOrigin(pending.host);
      const returnPath = sameHostPath(pending.returnPath);
      if (!origin || !returnPath) {
        await deletePending(pending.id);
        return `${rootOrigin()}/auth/error?error=connection_state_invalid`;
      }
      const finish = async (
        result: "authorized" | "login_required" | "failed",
      ) => {
        await deletePending(pending.id);
        return new URL(connectionResultPath(returnPath, result), origin).href;
      };
      if (input.error) {
        return finish(
          input.error === "login_required" ? "login_required" : "failed",
        );
      }
      if (!input.code) return finish("failed");

      const response = await postToTokenEndpoint(env, {
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: pending.redirectUri,
        code_verifier: pending.codeVerifier,
      });
      if (!response.ok) {
        await response.text();
        console.error("connection token exchange failed", response.status);
        return finish("failed");
      }
      let tokens: z.infer<typeof tokenResponse>;
      try {
        tokens = tokenResponse.parse(await response.json());
      } catch {
        return finish("failed");
      }
      if (!tokens.id_token) return finish("failed");
      let subject: string;
      try {
        subject = await verifyIdToken(env, tokens.id_token, pending.nonce);
      } catch {
        console.error("connection id token verification failed");
        return finish("failed");
      }
      if (requireStaffMatch && subject !== pending.staffSub) {
        return finish("failed");
      }
      const saved = await saveAuthorizationIfCurrent(pending, tokens, subject);
      return finish(saved ? "authorized" : "failed");
    },

    async hasAuthorization({
      tenantId,
      eventId,
      pageEdgeDeviceId,
    }: {
      tenantId: string;
      eventId: string;
      pageEdgeDeviceId: string;
    }): Promise<boolean> {
      const store = await adapter();
      const authorization = await store.findOne<ConnectionAuthorization>({
        model: CONNECTION_AUTHORIZATION,
        where: [
          {
            field: "connectionKey",
            value: connectionKey(tenantId, eventId, pageEdgeDeviceId),
          },
        ],
      });
      return !!authorization && authorization.expiresAt > new Date();
    },

    /**
     * 保存済みの委任に含まれるカメラだけを返す。委任がない、または期限切れなら
     * null。トークンは返さない。
     */
    async delegatedCameraIds({
      tenantId,
      eventId,
      pageEdgeDeviceId,
    }: {
      tenantId: string;
      eventId: string;
      pageEdgeDeviceId: string;
    }): Promise<string[] | null> {
      const store = await adapter();
      const authorization = await store.findOne<ConnectionAuthorization>({
        model: CONNECTION_AUTHORIZATION,
        where: [
          {
            field: "connectionKey",
            value: connectionKey(tenantId, eventId, pageEdgeDeviceId),
          },
        ],
      });
      if (!authorization || authorization.expiresAt <= new Date()) {
        return null;
      }
      return parseCameraIds(authorization.cameraIds);
    },

    /**
     * 委任の保存済み tenant_access を必要なら Refresh し、events.read の
     * event_access へ交換して返す。ブラウザへは返さない。
     */
    async eventAccess({
      tenantId,
      eventId,
      pageEdgeDeviceId,
      cameraEdgeDeviceId,
    }: {
      tenantId: string;
      eventId: string;
      pageEdgeDeviceId: string;
      cameraEdgeDeviceId?: string;
    }): Promise<string> {
      const key = connectionKey(tenantId, eventId, pageEdgeDeviceId);
      return withCurrentAuthorization(
        key,
        eventId,
        cameraEdgeDeviceId,
        (authorization, env) =>
          exchangeEventAccess(authorization, env, key, cameraEdgeDeviceId),
      );
    },

    /**
     * 委任の現在の状態をロックしたまま event_access を渡す。呼び出し側は
     * RequestConnection と IssueFirestoreToken をこの中で行い、停止や登録解除が
     * 途中に割り込まないようにする。
     */
    async withAuthorization<T>(
      {
        tenantId,
        eventId,
        pageEdgeDeviceId,
        cameraEdgeDeviceId,
      }: {
        tenantId: string;
        eventId: string;
        pageEdgeDeviceId: string;
        cameraEdgeDeviceId?: string;
      },
      task: (eventAccessToken: string) => Promise<T>,
    ): Promise<T> {
      const key = connectionKey(tenantId, eventId, pageEdgeDeviceId);
      return withCurrentAuthorization(
        key,
        eventId,
        cameraEdgeDeviceId,
        async (authorization, env) =>
          task(
            await exchangeEventAccess(
              authorization,
              env,
              key,
              cameraEdgeDeviceId,
            ),
          ),
      );
    },

    async deleteForCamera(eventId: string, cameraEdgeDeviceId: string) {
      const collectTargets = async () => {
        const { adapter: db } = await realAuth.auth.$context;
        const pending = await db.findMany<PendingConnection>({
          model: PENDING_CONNECTION,
          where: [{ field: "eventId", value: eventId }],
        });
        const rows = await db.findMany<ConnectionAuthorization>({
          model: CONNECTION_AUTHORIZATION,
          where: [{ field: "eventId", value: eventId }],
        });
        const targets = new Map<string, ConnectionTarget>();
        for (const row of pending ?? []) {
          if (!parseCameraIds(row.cameraIds).includes(cameraEdgeDeviceId)) {
            continue;
          }
          targets.set(
            connectionKey(row.tenantId, row.eventId, row.pageEdgeDeviceId),
            {
              tenantId: row.tenantId,
              eventId: row.eventId,
              pageEdgeDeviceId: row.pageEdgeDeviceId,
            },
          );
        }
        for (const row of rows ?? []) {
          if (parseCameraIds(row.cameraIds).includes(cameraEdgeDeviceId)) {
            targets.set(row.connectionKey, {
              tenantId: row.tenantId,
              eventId: row.eventId,
              pageEdgeDeviceId: row.pageEdgeDeviceId,
            });
          }
        }
        return targets;
      };
      return realAuth.lockManyDynamic(
        [connectionEventLockKey(eventId)],
        async () => [...(await collectTargets()).keys()].map(connectionLockKey),
        async () => {
          const targets = await collectTargets();
          for (const key of targets.keys()) {
            const store = await adapter();
            let deletedAuthorization = false;
            const current = await store.findOne<ConnectionAuthorization>({
              model: CONNECTION_AUTHORIZATION,
              where: [{ field: "connectionKey", value: key }],
            });
            if (current) {
              const cameraIds = parseCameraIds(current.cameraIds);
              if (cameraIds.includes(cameraEdgeDeviceId)) {
                const remaining = cameraIds.filter(
                  (id) => id !== cameraEdgeDeviceId,
                );
                if (remaining.length === 0) {
                  await deleteAuthorizationRows(store, current.id);
                  deletedAuthorization = true;
                } else {
                  await store.update({
                    model: CONNECTION_AUTHORIZATION,
                    where: [{ field: "id", value: current.id }],
                    update: { cameraIds: JSON.stringify(remaining) },
                  });
                }
              }
            }
            await advanceState(
              store,
              key,
              deletedAuthorization ? { deletedAt: new Date() } : {},
            );
          }
        },
      );
    },

    async addForCamera(
      eventId: string,
      pageEdgeDeviceId: string,
      cameraEdgeDeviceId: string,
    ) {
      const collectTargets = async () => {
        const { adapter: db } = await realAuth.auth.$context;
        const rows = await db.findMany<ConnectionAuthorization>({
          model: CONNECTION_AUTHORIZATION,
          where: [
            { field: "eventId", value: eventId },
            { field: "pageEdgeDeviceId", value: pageEdgeDeviceId },
          ],
        });
        return (rows ?? []).filter(
          (row) => !parseCameraIds(row.cameraIds).includes(cameraEdgeDeviceId),
        );
      };
      return realAuth.lockManyDynamic(
        [connectionEventLockKey(eventId)],
        async () =>
          (await collectTargets()).map((row) =>
            connectionLockKey(row.connectionKey),
          ),
        async () => {
          const rows = await collectTargets();
          for (const row of rows) {
            const key = row.connectionKey;
            const store = await adapter();
            const current = await store.findOne<ConnectionAuthorization>({
              model: CONNECTION_AUTHORIZATION,
              where: [{ field: "connectionKey", value: key }],
            });
            if (!current) continue;
            const cameraIds = parseCameraIds(current.cameraIds);
            if (cameraIds.includes(cameraEdgeDeviceId)) continue;
            await store.update({
              model: CONNECTION_AUTHORIZATION,
              where: [{ field: "id", value: current.id }],
              update: {
                cameraIds: JSON.stringify([...cameraIds, cameraEdgeDeviceId]),
              },
            });
            await advanceState(store, key);
          }
        },
      );
    },

    async deleteForPage(eventId: string, pageEdgeDeviceId: string) {
      const collectTargets = async () => {
        const { adapter: db } = await realAuth.auth.$context;
        const pending = await db.findMany<PendingConnection>({
          model: PENDING_CONNECTION,
          where: [
            { field: "eventId", value: eventId },
            { field: "pageEdgeDeviceId", value: pageEdgeDeviceId },
          ],
        });
        const rows = await db.findMany<ConnectionAuthorization>({
          model: CONNECTION_AUTHORIZATION,
          where: [{ field: "eventId", value: eventId }],
        });
        const targets = new Map<string, ConnectionTarget>();
        for (const row of pending ?? []) {
          targets.set(
            connectionKey(row.tenantId, row.eventId, row.pageEdgeDeviceId),
            {
              tenantId: row.tenantId,
              eventId: row.eventId,
              pageEdgeDeviceId: row.pageEdgeDeviceId,
            },
          );
        }
        for (const row of rows ?? []) {
          if (row.pageEdgeDeviceId !== pageEdgeDeviceId) continue;
          targets.set(row.connectionKey, {
            tenantId: row.tenantId,
            eventId: row.eventId,
            pageEdgeDeviceId: row.pageEdgeDeviceId,
          });
        }
        return targets;
      };
      return realAuth.lockManyDynamic(
        [connectionEventLockKey(eventId)],
        async () => [...(await collectTargets()).keys()].map(connectionLockKey),
        async () => {
          const targets = await collectTargets();
          for (const [key, target] of targets) {
            const store = await adapter();
            const stale = await store.findMany<PendingConnection>({
              model: PENDING_CONNECTION,
              where: [
                { field: "tenantId", value: target.tenantId },
                { field: "eventId", value: target.eventId },
                { field: "pageEdgeDeviceId", value: target.pageEdgeDeviceId },
              ],
            });
            for (const row of stale ?? []) {
              await store.delete({
                model: PENDING_CONNECTION,
                where: [{ field: "id", value: row.id }],
              });
            }
            const current = await store.findOne<ConnectionAuthorization>({
              model: CONNECTION_AUTHORIZATION,
              where: [{ field: "connectionKey", value: key }],
            });
            if (current) await deleteAuthorizationRows(store, current.id);
            await advanceState(store, key, { deletedAt: new Date() });
          }
        },
      );
    },

    async deleteForEvent(eventId: string) {
      const collectTargets = async () => {
        const { adapter: db } = await realAuth.auth.$context;
        const pending = await db.findMany<PendingConnection>({
          model: PENDING_CONNECTION,
          where: [{ field: "eventId", value: eventId }],
        });
        const rows = await db.findMany<ConnectionAuthorization>({
          model: CONNECTION_AUTHORIZATION,
          where: [{ field: "eventId", value: eventId }],
        });
        const targets = new Map<string, ConnectionTarget>();
        for (const row of pending ?? []) {
          targets.set(
            connectionKey(row.tenantId, row.eventId, row.pageEdgeDeviceId),
            {
              tenantId: row.tenantId,
              eventId: row.eventId,
              pageEdgeDeviceId: row.pageEdgeDeviceId,
            },
          );
        }
        for (const row of rows ?? []) {
          targets.set(row.connectionKey, {
            tenantId: row.tenantId,
            eventId: row.eventId,
            pageEdgeDeviceId: row.pageEdgeDeviceId,
          });
        }
        return targets;
      };
      return realAuth.lockManyDynamic(
        [connectionEventLockKey(eventId)],
        async () => [...(await collectTargets()).keys()].map(connectionLockKey),
        async () => {
          const targets = await collectTargets();
          for (const [key, target] of targets) {
            const store = await adapter();
            const stale = await store.findMany<PendingConnection>({
              model: PENDING_CONNECTION,
              where: [
                { field: "tenantId", value: target.tenantId },
                { field: "eventId", value: target.eventId },
                { field: "pageEdgeDeviceId", value: target.pageEdgeDeviceId },
              ],
            });
            for (const row of stale ?? []) {
              await store.delete({
                model: PENDING_CONNECTION,
                where: [{ field: "id", value: row.id }],
              });
            }
            const current = await store.findOne<ConnectionAuthorization>({
              model: CONNECTION_AUTHORIZATION,
              where: [{ field: "connectionKey", value: key }],
            });
            if (current) await deleteAuthorizationRows(store, current.id);
            await advanceState(store, key, { deletedAt: new Date() });
          }
        },
      );
    },
  };
}

async function existingConnectionStore(): Promise<RealAuth | undefined> {
  if (!process.env.AUTH_DATABASE_URL) return undefined;
  try {
    return getRealAuth();
  } catch {
    return undefined;
  }
}

let connectionAuth: ReturnType<typeof createConnectionAuth> | undefined;

export function getConnectionAuth(): ReturnType<typeof createConnectionAuth> {
  connectionAuth ??= createConnectionAuth(getRealAuth());
  return connectionAuth;
}

export async function connectionEventAccess(
  tenantId: string,
  eventId: string,
  pageEdgeDeviceId: string,
  cameraEdgeDeviceId?: string,
): Promise<string> {
  return getConnectionAuth().eventAccess({
    tenantId,
    eventId,
    pageEdgeDeviceId,
    cameraEdgeDeviceId,
  });
}

/**
 * 保存済みの接続委任に含まれるカメラ ID を返す。接続用のデータストアが
 * 設定されていなければ undefined、委任がなければ null。
 */
export async function connectionDelegationCameraIds(
  tenantId: string,
  eventId: string,
  pageEdgeDeviceId: string,
): Promise<string[] | null | undefined> {
  const store = await existingConnectionStore();
  if (!store) return undefined;
  return createConnectionAuth(store).delegatedCameraIds({
    tenantId,
    eventId,
    pageEdgeDeviceId,
  });
}

export async function withCameraConnectionAuthorization<T>(
  tenantId: string,
  eventId: string,
  pageEdgeDeviceId: string,
  cameraEdgeDeviceId: string,
  task: (eventAccessToken: string) => Promise<T>,
): Promise<T> {
  return getConnectionAuth().withAuthorization(
    { tenantId, eventId, pageEdgeDeviceId, cameraEdgeDeviceId },
    task,
  );
}

export async function deleteConnectionDelegationsForCamera(
  eventId: string,
  cameraEdgeDeviceId: string,
): Promise<void> {
  const store = await existingConnectionStore();
  if (!store) return;
  await createConnectionAuth(store).deleteForCamera(
    eventId,
    cameraEdgeDeviceId,
  );
}

export async function addCameraToConnectionDelegation(
  eventId: string,
  pageEdgeDeviceId: string,
  cameraEdgeDeviceId: string,
): Promise<void> {
  const store = await existingConnectionStore();
  if (!store) return;
  await createConnectionAuth(store).addForCamera(
    eventId,
    pageEdgeDeviceId,
    cameraEdgeDeviceId,
  );
}

export async function deleteConnectionDelegationsForPage(
  eventId: string,
  pageEdgeDeviceId: string,
): Promise<void> {
  const store = await existingConnectionStore();
  if (!store) return;
  await createConnectionAuth(store).deleteForPage(eventId, pageEdgeDeviceId);
}

export async function deleteConnectionDelegationsForEvent(
  eventId: string,
): Promise<void> {
  const store = await existingConnectionStore();
  if (!store) return;
  await createConnectionAuth(store).deleteForEvent(eventId);
}
