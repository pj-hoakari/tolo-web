import { encodeBasicCredentials } from "better-auth/oauth2";
import { z } from "zod";
import type { AccessTokenRequest, Viewer } from ".";
import type { RealAuth } from "./betterAuth";
import { idpDiscovery } from "./discovery";

const ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1000;
const EXPIRY_MARGIN_MS = 5_000;
const TENANT_ACCESS_TOKEN = "tenantAccessToken";
const EVENT_ACCESS_TOKEN = "eventAccessToken";

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

function oauthError(body: string): unknown {
  try {
    return JSON.parse(body).error;
  } catch {
    return undefined;
  }
}

export function createSessionAuth({ auth, env, lock }: RealAuth) {
  const discovery = idpDiscovery(env.issuer);

  async function postToTokenEndpoint(params: Record<string, string>) {
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

  async function storedTenantAccess(sessionId: string) {
    const { adapter } = await auth.$context;
    return adapter.findOne<TenantAccessToken>({
      model: TENANT_ACCESS_TOKEN,
      where: [{ field: "sessionId", value: sessionId }],
    });
  }

  async function staffLogin(headers: Headers, tenantId: string | undefined) {
    if (!tenantId) return null;
    const current = await auth.api.getSession({ headers });
    if (
      !current ||
      current.session.tenantId !== tenantId ||
      Date.now() - current.session.createdAt.getTime() >= ABSOLUTE_LIFETIME_MS
    ) {
      return null;
    }
    if (current.session.kind !== "staff") {
      throw new Error("machine sessions are not supported yet");
    }
    const stored = await storedTenantAccess(current.session.id);
    return stored
      ? { sessionId: current.session.id, subject: stored.subject, tenantId }
      : null;
  }

  type StaffLogin = NonNullable<Awaited<ReturnType<typeof staffLogin>>>;

  async function tenantAccess(sessionId: string) {
    const stored = await storedTenantAccess(sessionId);
    if (!stored) throw new Error("no staff session for this host");
    if (stored.accessTokenExpiresAt.getTime() - Date.now() > EXPIRY_MARGIN_MS) {
      return stored.accessToken;
    }
    const { adapter } = await auth.$context;
    const where = [{ field: "sessionId", value: sessionId }];
    const response = await postToTokenEndpoint({
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

  async function eventAccess(login: StaffLogin, eventId: string) {
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
    const response = await postToTokenEndpoint({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: await tenantAccess(login.sessionId),
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      resource: `https://${env.resourceHost}/tenants/${login.tenantId}/events/${encodeURIComponent(eventId)}`,
      audience: "backend-api",
    });
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
      const login = await staffLogin(headers, tenantId);
      if (!login) return { type: "anonymous" };
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
      if (request.type === "event_access" && request.client === "edge") {
        throw new Error(
          "event_access for the edge client is not supported yet",
        );
      }
      const login = await staffLogin(headers, tenantId);
      if (!login) throw new Error("no staff session for this host");
      return lock(login.sessionId, () =>
        request.type === "tenant_access"
          ? tenantAccess(login.sessionId)
          : eventAccess(login, request.eventId),
      );
    },
  };
}
