import { encodeBasicCredentials } from "better-auth/oauth2";
import { z } from "zod";
import type { AccessTokenRequest, Viewer } from ".";
import type { RealAuth } from "./betterAuth";
import { idpDiscovery } from "./discovery";

const ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1000;
const EXPIRY_MARGIN_MS = 5_000;
const TENANT_ACCESS_TOKEN = "tenantAccessToken";
const EVENT_ACCESS_TOKEN = "eventAccessToken";
const EVENT_SCOPES = [
  "events.read",
  "events.manage",
  "events.operate",
  "events.report",
];

const tokenExchangeResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});
const refreshResponse = tokenExchangeResponse.extend({
  refresh_token: z.string(),
  id_token: z.string().optional(),
});

type TenantAccessToken = {
  id: string;
  sessionId: string;
  subject: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
};

type EventAccessToken = {
  id: string;
  sessionId: string;
  eventId: string;
  accessToken: string;
  expiresAt: Date;
};

type ClientCredentials = {
  clientId: string;
  clientSecret: string;
};

const scopeClaim = z.object({ scope: z.string() });

export function tokenScopes(accessToken: string): Set<string> {
  const payload = accessToken.split(".")[1] ?? "";
  const { scope } = scopeClaim.parse(
    JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
  );
  return new Set(scope.split(" "));
}

function eventScopes(tenantAccessToken: string): string {
  const granted = tokenScopes(tenantAccessToken);
  const scopes = EVENT_SCOPES.filter((name) => granted.has(name));
  if (scopes.length === 0) {
    throw new Error("the session's tenant_access carries no event scope");
  }
  return scopes.join(" ");
}

type SessionLogin = {
  sessionId: string;
  subject: string;
  tenantId: string;
  kind: "staff" | "machine";
  eventId?: string | null;
  edgeDeviceId?: string | null;
};

function oauthError(body: string): unknown {
  try {
    return JSON.parse(body).error;
  } catch {
    return undefined;
  }
}

export function createSessionAuth({ auth, env, lock }: RealAuth) {
  const discovery = idpDiscovery(env.issuer);
  const staffClient = {
    clientId: env.clientId,
    clientSecret: env.clientSecret,
  };
  const machineClient = {
    clientId: env.machineClientId,
    clientSecret: env.machineClientSecret,
  };

  async function postToTokenEndpoint(
    client: ClientCredentials,
    params: Record<string, string>,
  ) {
    return fetch((await discovery()).token_endpoint, {
      method: "POST",
      headers: {
        authorization: encodeBasicCredentials(
          client.clientId,
          client.clientSecret,
        ),
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams(params),
    });
  }

  async function storedTenantAccess(sessionId: string) {
    const { adapter } = await auth.$context;
    return adapter.findOne<TenantAccessToken>({
      model: TENANT_ACCESS_TOKEN,
      where: [{ field: "sessionId", value: sessionId }],
    });
  }

  async function sessionLogin(
    headers: Headers,
    tenantId: string | undefined,
  ): Promise<SessionLogin | null> {
    if (!tenantId) return null;
    const current = await auth.api.getSession({ headers });
    if (
      !current ||
      current.session.tenantId !== tenantId ||
      Date.now() - current.session.createdAt.getTime() >= ABSOLUTE_LIFETIME_MS
    ) {
      return null;
    }
    const kind = current.session.kind === "machine" ? "machine" : "staff";
    const stored = await storedTenantAccess(current.session.id);
    if (!stored) return null;
    return {
      sessionId: current.session.id,
      subject: stored.subject,
      tenantId,
      kind,
      eventId: current.session.eventId,
      edgeDeviceId: current.session.edgeDeviceId,
    };
  }

  async function tenantAccess(sessionId: string, client: ClientCredentials) {
    const stored = await storedTenantAccess(sessionId);
    if (!stored) throw new Error("no session tokens for this host");
    if (stored.accessTokenExpiresAt.getTime() - Date.now() > EXPIRY_MARGIN_MS) {
      return stored.accessToken;
    }
    const { adapter } = await auth.$context;
    const where = [{ field: "sessionId", value: sessionId }];
    const response = await postToTokenEndpoint(client, {
      grant_type: "refresh_token",
      refresh_token: stored.refreshToken,
    });
    if (!response.ok) {
      const failure = await response.text();
      if (oauthError(failure) === "invalid_grant") {
        await adapter.delete({ model: TENANT_ACCESS_TOKEN, where });
        throw new Error(
          "the IdP rejected this session's refresh token; sign in again",
        );
      }
      throw new Error(
        `refreshing tenant_access failed with ${response.status}: ${failure}`,
      );
    }
    const { access_token, refresh_token, expires_in, id_token } =
      refreshResponse.parse(await response.json());
    await adapter.update({
      model: TENANT_ACCESS_TOKEN,
      where,
      update: {
        accessToken: access_token,
        refreshToken: refresh_token,
        accessTokenExpiresAt: new Date(Date.now() + expires_in * 1000),
        ...(id_token && { idToken: id_token }),
      },
    });
    return access_token;
  }

  async function eventAccess(
    login: SessionLogin,
    eventId: string,
    client: ClientCredentials,
  ) {
    const machine = login.kind === "machine";
    if (machine && (!login.edgeDeviceId || login.eventId !== eventId)) {
      throw new Error(
        "machine sessions can only request event_access for their own event",
      );
    }
    const { adapter } = await auth.$context;
    const where = [
      { field: "sessionId", value: login.sessionId },
      { field: "eventId", value: eventId },
    ];
    const stored = await adapter.findOne<EventAccessToken>({
      model: EVENT_ACCESS_TOKEN,
      where,
    });
    if (stored && stored.expiresAt.getTime() - Date.now() > EXPIRY_MARGIN_MS) {
      return stored.accessToken;
    }
    const subjectToken = await tenantAccess(login.sessionId, client);
    const params: Record<string, string> = {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: subjectToken,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      resource: `https://${env.resourceHost}/tenants/${login.tenantId}/events/${encodeURIComponent(eventId)}`,
      audience: "backend-api",
    };
    if (machine) {
      params.scope = "events.report";
      params.edge_device_id = login.edgeDeviceId as string;
    } else {
      params.scope = eventScopes(subjectToken);
    }
    const response = await postToTokenEndpoint(client, params);
    if (!response.ok) {
      throw new Error(
        `token exchange for event ${eventId} failed with ${response.status}: ${await response.text()}`,
      );
    }
    const { access_token, expires_in } = tokenExchangeResponse.parse(
      await response.json(),
    );
    const update = {
      accessToken: access_token,
      expiresAt: new Date(Date.now() + expires_in * 1000),
    };
    if (stored) {
      await adapter.update({ model: EVENT_ACCESS_TOKEN, where, update });
    } else {
      await adapter.create({
        model: EVENT_ACCESS_TOKEN,
        data: { sessionId: login.sessionId, eventId, ...update },
      });
    }
    return access_token;
  }

  return {
    async viewer(
      headers: Headers,
      tenantId: string | undefined,
    ): Promise<Viewer> {
      const login = await sessionLogin(headers, tenantId);
      if (!login) return { type: "anonymous" };
      if (login.kind === "machine") {
        if (
          typeof login.eventId !== "string" ||
          typeof login.edgeDeviceId !== "string"
        ) {
          return { type: "anonymous" };
        }
        return {
          type: "machine",
          userId: login.subject,
          tenantId: login.tenantId,
          eventId: login.eventId,
          edgeDeviceId: login.edgeDeviceId,
        };
      }
      return {
        type: "staff",
        userId: login.subject,
        tenantId: login.tenantId,
      };
    },

    async accessToken(
      headers: Headers,
      tenantId: string | undefined,
      request: AccessTokenRequest,
    ): Promise<string> {
      const login = await sessionLogin(headers, tenantId);
      if (!login) throw new Error("no session for this host");
      if (request.type === "tenant_access") {
        return lock(login.sessionId, () =>
          tenantAccess(
            login.sessionId,
            login.kind === "machine" ? machineClient : staffClient,
          ),
        );
      }
      if (login.kind === "machine") {
        if (request.client === "console") {
          throw new Error(
            "console event_access is not available for machine sessions",
          );
        }
        return lock(login.sessionId, () =>
          eventAccess(login, request.eventId, machineClient),
        );
      }
      if (request.client === "edge") {
        throw new Error(
          "event_access for the edge client is only available to machine sessions",
        );
      }
      return lock(login.sessionId, () =>
        eventAccess(login, request.eventId, staffClient),
      );
    },
  };
}
