import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import {
  encodeBasicCredentials,
  verifyJwsAccessToken,
} from "better-auth/oauth2";
import { z } from "zod";
import { rootOrigin } from "@/lib/control/tenant";
import { getRealAuth, type RealAuth } from "./betterAuth";
import { idpDiscovery } from "./discovery";

const PENDING_CONNECTION = "pendingConnectionAuthorization";
const CONNECTION_AUTHORIZATION = "connectionAuthorization";
const CONNECTION_EVENT_ACCESS = "connectionEventAccess";

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
  returnPath: string;
}

export interface ConnectionCallbackInput {
  code: string | undefined;
  state: string | undefined;
  error: string | undefined;
  viewer:
    | { type: "anonymous" }
    | { type: "staff"; userId: string; tenantId: string }
    | {
        type: "machine";
        userId: string;
        tenantId: string;
        eventId: string;
        edgeDeviceId: string;
      };
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
  returnPath: string;
  redirectUri: string;
  expiresAt: Date;
};

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
  requireStaffMatch?: boolean;
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
  const requireStaffMatch =
    options.requireStaffMatch ?? process.env.AUTH_MOCKING !== "enabled";
  const authorizationTtlMs =
    options.authorizationTtlMs ??
    (Number(process.env.AUTH_CONNECTION_TTL_SECONDS) > 0
      ? Number(process.env.AUTH_CONNECTION_TTL_SECONDS) * 1000
      : DEFAULT_AUTHORIZATION_TTL_MS);

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

  async function deleteAuthorization(id: string) {
    const store = await adapter();
    await store.deleteMany({
      model: CONNECTION_EVENT_ACCESS,
      where: [{ field: "connectionAuthorizationId", value: id }],
    });
    await store.delete({
      model: CONNECTION_AUTHORIZATION,
      where: [{ field: "id", value: id }],
    });
  }

  async function saveAuthorization(
    pending: PendingConnection,
    tokens: z.infer<typeof tokenResponse>,
    staffSub: string,
  ) {
    const store = await adapter();
    const key = connectionKey(
      pending.tenantId,
      pending.eventId,
      pending.pageEdgeDeviceId,
    );
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
      accessTokenExpiresAt: new Date(now.getTime() + tokens.expires_in * 1000),
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
      return existing.id;
    }
    const created = await store.create<
      Omit<ConnectionAuthorization, "id">,
      ConnectionAuthorization
    >({
      model: CONNECTION_AUTHORIZATION,
      data: values,
    });
    return created.id;
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
  ): Promise<string> {
    const store = await adapter();
    const response = await postToTokenEndpoint(env, {
      grant_type: "refresh_token",
      refresh_token: authorization.refreshToken,
    });
    if (!response.ok) {
      const failure = await response.text();
      if (oauthError(failure) === "invalid_grant") {
        await deleteAuthorization(authorization.id);
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
  ) {
    if (
      authorization.accessTokenExpiresAt.getTime() - Date.now() >
      EXPIRY_MARGIN_MS
    ) {
      return authorization.accessToken;
    }
    return refreshTenantAccess(authorization, env);
  }

  async function eventAccess(
    authorization: ConnectionAuthorization,
    env: ConnectionEnvironment,
  ) {
    const store = await adapter();
    const cacheKey = `${authorization.id}:${authorization.eventId}`;
    const cached = await store.findOne<ConnectionEventAccess>({
      model: CONNECTION_EVENT_ACCESS,
      where: [{ field: "cacheKey", value: cacheKey }],
    });
    if (cached && cached.expiresAt.getTime() - Date.now() > EXPIRY_MARGIN_MS) {
      return cached.accessToken;
    }
    const response = await postToTokenEndpoint(env, {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: await tenantAccess(authorization, env),
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      resource: `https://${env.resourceHost}/tenants/${authorization.tenantId}/events/${encodeURIComponent(authorization.eventId)}`,
      audience: "backend-api",
      scope: "events.read",
    });
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

  return {
    /**
     * state と PKCE verifier を作り、接続用 client の prompt=none 認可へ
     * リダイレクトする URL を返す。
     */
    async start(input: ConnectionAuthorizationInput): Promise<string> {
      const env = environment();
      const store = await adapter();
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
      for (const row of previous ?? []) await deletePending(row.id);

      const state = randomToken();
      const nonce = randomToken();
      const verifier = randomToken();
      const challenge = createHash("sha256")
        .update(verifier)
        .digest("base64url");
      await store.create({
        model: PENDING_CONNECTION,
        data: {
          stateHash: sha256(state),
          codeVerifier: verifier,
          nonce,
          tenantId: input.tenantId,
          eventId: input.eventId,
          pageEdgeDeviceId: input.pageEdgeDeviceId,
          cameraIds: JSON.stringify([...new Set(input.cameraIds)]),
          staffSub: input.staffSub,
          returnPath: input.returnPath,
          redirectUri: env.redirectUri,
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
      url.searchParams.set("state", state);
      url.searchParams.set("nonce", nonce);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");
      return url.href;
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
      const finish = async (
        result: "authorized" | "login_required" | "failed",
      ) => {
        await deletePending(pending.id);
        return connectionResultPath(pending.returnPath, result);
      };
      if (input.error) {
        return finish(
          input.error === "login_required" ? "login_required" : "failed",
        );
      }
      if (!input.code) return finish("failed");
      if (
        input.viewer.type !== "staff" ||
        input.viewer.tenantId !== pending.tenantId
      ) {
        return finish("login_required");
      }

      const response = await postToTokenEndpoint(env, {
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: pending.redirectUri,
        code_verifier: pending.codeVerifier,
      });
      if (!response.ok) {
        await response.text();
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
        return finish("failed");
      }
      if (
        requireStaffMatch &&
        (subject !== pending.staffSub || input.viewer.userId !== subject)
      ) {
        return finish("failed");
      }
      await saveAuthorization(pending, tokens, subject);
      return finish("authorized");
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
      const env = environment();
      const store = await adapter();
      const key = connectionKey(tenantId, eventId, pageEdgeDeviceId);
      const authorization = await store.findOne<ConnectionAuthorization>({
        model: CONNECTION_AUTHORIZATION,
        where: [{ field: "connectionKey", value: key }],
      });
      if (!authorization || authorization.expiresAt <= new Date()) {
        if (authorization) await deleteAuthorization(authorization.id);
        throw connectionError(
          CONNECTION_ERROR_CODES.authorizationRequired,
          "no camera connection authorization; authorize the camera connection",
        );
      }
      return realAuth.lock(`connection:${authorization.id}`, async () => {
        const current = await store.findOne<ConnectionAuthorization>({
          model: CONNECTION_AUTHORIZATION,
          where: [{ field: "id", value: authorization.id }],
        });
        if (!current || current.expiresAt <= new Date()) {
          if (current) await deleteAuthorization(current.id);
          throw connectionError(
            CONNECTION_ERROR_CODES.authorizationRequired,
            "no camera connection authorization; authorize the camera connection",
          );
        }
        if (
          cameraEdgeDeviceId &&
          !parseCameraIds(current.cameraIds).includes(cameraEdgeDeviceId)
        ) {
          throw connectionError(
            CONNECTION_ERROR_CODES.cameraNotDelegated,
            "the camera is not part of this page's connection delegation",
          );
        }
        return eventAccess(current, env);
      });
    },

    async deleteForCamera(eventId: string, cameraEdgeDeviceId: string) {
      const { adapter: db } = await realAuth.auth.$context;
      const rows = await db.findMany<ConnectionAuthorization>({
        model: CONNECTION_AUTHORIZATION,
        where: [{ field: "eventId", value: eventId }],
      });
      for (const row of rows ?? []) {
        if (!parseCameraIds(row.cameraIds).includes(cameraEdgeDeviceId)) {
          continue;
        }
        await realAuth.lock(`connection:${row.id}`, async () => {
          const current = await db.findOne<ConnectionAuthorization>({
            model: CONNECTION_AUTHORIZATION,
            where: [{ field: "id", value: row.id }],
          });
          if (!current) return;
          const cameraIds = parseCameraIds(current.cameraIds);
          if (!cameraIds.includes(cameraEdgeDeviceId)) return;
          const remaining = cameraIds.filter((id) => id !== cameraEdgeDeviceId);
          if (remaining.length === 0) {
            await deleteAuthorization(current.id);
            return;
          }
          await db.update({
            model: CONNECTION_AUTHORIZATION,
            where: [{ field: "id", value: current.id }],
            update: { cameraIds: JSON.stringify(remaining) },
          });
        });
      }
    },

    async addForCamera(
      eventId: string,
      pageEdgeDeviceId: string,
      cameraEdgeDeviceId: string,
    ) {
      const { adapter: db } = await realAuth.auth.$context;
      const rows = await db.findMany<ConnectionAuthorization>({
        model: CONNECTION_AUTHORIZATION,
        where: [
          { field: "eventId", value: eventId },
          { field: "pageEdgeDeviceId", value: pageEdgeDeviceId },
        ],
      });
      for (const row of rows ?? []) {
        if (parseCameraIds(row.cameraIds).includes(cameraEdgeDeviceId)) {
          continue;
        }
        await realAuth.lock(`connection:${row.id}`, async () => {
          const current = await db.findOne<ConnectionAuthorization>({
            model: CONNECTION_AUTHORIZATION,
            where: [{ field: "id", value: row.id }],
          });
          if (!current) return;
          const cameraIds = parseCameraIds(current.cameraIds);
          if (cameraIds.includes(cameraEdgeDeviceId)) return;
          await db.update({
            model: CONNECTION_AUTHORIZATION,
            where: [{ field: "id", value: current.id }],
            update: {
              cameraIds: JSON.stringify([...cameraIds, cameraEdgeDeviceId]),
            },
          });
        });
      }
    },

    async deleteForPage(eventId: string, pageEdgeDeviceId: string) {
      const { adapter: db } = await realAuth.auth.$context;
      const pending = await db.findMany<PendingConnection>({
        model: PENDING_CONNECTION,
        where: [
          { field: "eventId", value: eventId },
          { field: "pageEdgeDeviceId", value: pageEdgeDeviceId },
        ],
      });
      for (const row of pending ?? []) {
        await db.delete({
          model: PENDING_CONNECTION,
          where: [{ field: "id", value: row.id }],
        });
      }
      const rows = await db.findMany<ConnectionAuthorization>({
        model: CONNECTION_AUTHORIZATION,
        where: [{ field: "eventId", value: eventId }],
      });
      for (const row of rows ?? []) {
        if (row.pageEdgeDeviceId === pageEdgeDeviceId) {
          await deleteAuthorization(row.id);
        }
      }
    },

    async deleteForEvent(eventId: string) {
      const { adapter: db } = await realAuth.auth.$context;
      const pending = await db.findMany<PendingConnection>({
        model: PENDING_CONNECTION,
        where: [{ field: "eventId", value: eventId }],
      });
      for (const row of pending ?? []) {
        await db.delete({
          model: PENDING_CONNECTION,
          where: [{ field: "id", value: row.id }],
        });
      }
      const rows = await db.findMany<ConnectionAuthorization>({
        model: CONNECTION_AUTHORIZATION,
        where: [{ field: "eventId", value: eventId }],
      });
      for (const row of rows ?? []) await deleteAuthorization(row.id);
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
