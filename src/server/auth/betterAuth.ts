import {
  type BetterAuthOptions,
  type BetterAuthPlugin,
  betterAuth,
} from "better-auth";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { Pool } from "pg";

export const PROVIDER_ID = "tolo-idp";
export const SESSION_COOKIE = "__Host-tolo.session_token";

const AUTH_ENV = {
  databaseUrl: "AUTH_DATABASE_URL",
  secret: "AUTH_SECRET",
  issuer: "AUTH_IDP_ISSUER",
  clientId: "AUTH_IDP_CLIENT_ID",
  clientSecret: "AUTH_IDP_CLIENT_SECRET",
  resourceHost: "AUTH_RESOURCE_HOST",
} as const;

export type AuthEnv = Record<keyof typeof AUTH_ENV, string>;

export function readAuthEnv(): AuthEnv {
  const missing = Object.values(AUTH_ENV).filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(
      `set ${missing.join(", ")} for authentication, or AUTH_MOCKING=enabled to use the local mock`,
    );
  }
  return Object.fromEntries(
    Object.entries(AUTH_ENV).map(([key, name]) => [key, process.env[name]]),
  ) as AuthEnv;
}

export function discoveryUrl(issuer: string): string {
  return `${issuer.replace(/\/+$/, "")}/.well-known/openid-configuration`;
}

function withoutMaxAge(cookie: string): string {
  return cookie.startsWith(`${SESSION_COOKIE}=`)
    ? cookie.replace(/; Max-Age=[1-9]\d*/i, "")
    : cookie;
}

const toloSession = {
  id: "tolo-session",
  schema: {
    eventAccessToken: {
      fields: {
        sessionId: {
          type: "string",
          required: true,
          index: true,
          references: { model: "session", field: "id", onDelete: "cascade" },
        },
        eventId: { type: "string", required: true },
        accessToken: { type: "string", required: true },
        expiresAt: { type: "date", required: true },
      },
    },
  },
  async onResponse(response) {
    const cookies = response.headers.getSetCookie();
    const rewritten = cookies.map(withoutMaxAge);
    if (rewritten.every((cookie, i) => cookie === cookies[i])) return;
    const headers = new Headers(response.headers);
    headers.delete("set-cookie");
    for (const cookie of rewritten) headers.append("set-cookie", cookie);
    return {
      response: new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      }),
    };
  },
} satisfies BetterAuthPlugin;

export function authOptions(env: AuthEnv) {
  return {
    secret: env.secret,
    session: {
      expiresIn: 60 * 60,
      updateAge: 0,
      additionalFields: {
        tenantId: { type: "string", required: false, input: false },
        kind: {
          type: ["staff", "machine"],
          required: true,
          defaultValue: "staff",
          input: false,
        },
      },
    },
    advanced: {
      useSecureCookies: false,
      defaultCookieAttributes: { secure: true },
      cookies: {
        session_token: {
          name: SESSION_COOKIE,
          attributes: { sameSite: "strict" },
        },
      },
    },
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: PROVIDER_ID,
            discoveryUrl: discoveryUrl(env.issuer),
            clientId: env.clientId,
            clientSecret: env.clientSecret,
            tokenEndpointAuth: { method: "client_secret_basic" },
            pkce: true,
            requireIdTokenVerification: true,
          },
        ],
      }),
      toloSession,
    ],
  } satisfies BetterAuthOptions;
}

export type AccountLock = <T>(
  accountId: string,
  task: () => Promise<T>,
) => Promise<T>;

export function advisoryLock(pool: Pool): AccountLock {
  return async (accountId, task) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        accountId,
      ]);
      return await task();
    } finally {
      await client.query("ROLLBACK").then(
        () => client.release(),
        (err: Error) => client.release(err),
      );
    }
  };
}

function createRealAuth(env: AuthEnv) {
  return {
    env,
    auth: betterAuth({
      ...authOptions(env),
      database: new Pool({ connectionString: env.databaseUrl }),
    }),
    lock: advisoryLock(new Pool({ connectionString: env.databaseUrl })),
  };
}

export type RealAuth = ReturnType<typeof createRealAuth>;

let realAuth: RealAuth | undefined;

export function getRealAuth(): RealAuth {
  realAuth ??= createRealAuth(readAuthEnv());
  return realAuth;
}
