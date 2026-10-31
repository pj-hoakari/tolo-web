import { encodeBasicCredentials } from "better-auth/oauth2";
import { z } from "zod";
import type { AccessTokenRequest, Viewer } from ".";
import { discoveryUrl, PROVIDER_ID, type RealAuth } from "./betterAuth";

const ABSOLUTE_LIFETIME_MS = 12 * 60 * 60 * 1000;
const EXPIRY_MARGIN_MS = 5_000;
const EVENT_ACCESS_TOKEN = "eventAccessToken";

const discoveryDocument = z.object({ token_endpoint: z.string() });
const tokenExchangeResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(),
});

type EventAccessToken = {
  id: string;
  sessionId: string;
  eventId: string;
  accessToken: string;
  expiresAt: Date;
};

function tenantClaim(token: string): unknown {
  try {
    return JSON.parse(
      Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
    ).tenant_id;
  } catch {
    return undefined;
  }
}

export function createSessionAuth({ auth, env, lock }: RealAuth) {
  let tokenEndpoint: Promise<string> | undefined;

  function resolveTokenEndpoint(): Promise<string> {
    tokenEndpoint ??= fetch(discoveryUrl(env.issuer))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`IdP discovery failed with ${response.status}`);
        }
        return discoveryDocument.parse(await response.json()).token_endpoint;
      })
      .catch((err) => {
        tokenEndpoint = undefined;
        throw err;
      });
    return tokenEndpoint;
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
    const { internalAdapter } = await auth.$context;
    const account = (await internalAdapter.findAccounts(current.user.id)).find(
      (candidate) => candidate.providerId === PROVIDER_ID,
    );
    return account ? { session: current.session, account, tenantId } : null;
  }

  type StaffLogin = NonNullable<Awaited<ReturnType<typeof staffLogin>>>;

  async function tenantAccess({ account, tenantId }: StaffLogin) {
    const { accessToken } = await auth.api.getAccessToken({
      body: { accountId: account.id, userId: account.userId },
    });
    if (tenantClaim(accessToken) !== tenantId) {
      throw new Error(
        "the stored tenant_access is not for this host's tenant; sign in on this host again",
      );
    }
    return accessToken;
  }

  async function eventAccess(login: StaffLogin, eventId: string) {
    const { adapter } = await auth.$context;
    const where = [
      { field: "sessionId", value: login.session.id },
      { field: "eventId", value: eventId },
    ];
    const stored = await adapter.findOne<EventAccessToken>({
      model: EVENT_ACCESS_TOKEN,
      where,
    });
    if (stored && stored.expiresAt.getTime() - Date.now() > EXPIRY_MARGIN_MS) {
      return stored.accessToken;
    }
    const response = await fetch(await resolveTokenEndpoint(), {
      method: "POST",
      headers: {
        authorization: encodeBasicCredentials(env.clientId, env.clientSecret),
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
        subject_token: await tenantAccess(login),
        subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
        resource: `https://${env.resourceHost}/tenants/${login.tenantId}/events/${encodeURIComponent(eventId)}`,
        audience: "backend-api",
      }),
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
        data: { sessionId: login.session.id, eventId, ...update },
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
        userId: login.account.accountId,
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
      return lock(login.account.id, () =>
        request.type === "tenant_access"
          ? tenantAccess(login)
          : eventAccess(login, request.eventId),
      );
    },
  };
}
