import { createHash, randomBytes } from "node:crypto";
import type { BetterAuthPlugin, GenericEndpointContext } from "better-auth";
import {
  createAuthEndpoint,
  createAuthMiddleware,
  getOAuthState,
} from "better-auth/api";
import {
  deleteSessionCookie,
  expireCookie,
  setSessionCookie,
} from "better-auth/cookies";
import { z } from "zod";
import { challengeLogin } from "@/features/auth/idpLogin";
import { rootOrigin, tenantOrigin } from "@/lib/control/tenant";
import type { RealAuth } from "./betterAuth";
import { idpDiscovery } from "./discovery";

export const PROVIDER_ID = "tolo-idp";
const PENDING_LOGIN = "pendingLogin";
const LOGIN_TTL_SECONDS = 10 * 60;
const CODE_TTL_MS = 60 * 1000;

type PendingLogin = {
  id: string;
  tenantId: string;
  host: string;
  bindingHash: string;
  returnPath: string;
  expiresAt: Date;
  codeHash?: string | null;
  userId?: string | null;
  subject?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  accessTokenExpiresAt?: Date | null;
  idToken?: string | null;
};

type ReceivedTokens = Pick<
  PendingLogin,
  "accessToken" | "refreshToken" | "accessTokenExpiresAt" | "idToken"
>;

const TENANT_ACCESS_TOKEN = "tenantAccessToken";
const EVENT_ACCESS_TOKEN = "eventAccessToken";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
const randomToken = () => randomBytes(32).toString("base64url");

const binding = (loginId: string) => ({
  name: `__Host-tolo.login.${loginId}`,
  attributes: {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: LOGIN_TTL_SECONDS,
  } as const,
});

const withoutTokens = {
  data: {
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
  },
};

const oauthLoginId = async () => {
  const loginId = (await getOAuthState())?.loginId;
  return typeof loginId === "string" ? loginId : undefined;
};

export function loginErrorUrl(host?: string, error?: string): string {
  const url = new URL("/auth/error", rootOrigin());
  if (host) url.searchParams.set("host", host);
  if (error) url.searchParams.set("error", error);
  return url.href;
}

export function sameHostPath(value: string): string | undefined {
  const base = "http://host.invalid";
  const url = URL.parse(value, base);
  if (
    !value.startsWith("/") ||
    url?.origin !== base ||
    url.pathname.startsWith("//")
  ) {
    return undefined;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export const loginHandoff = {
  id: "tolo-login",
  schema: {
    pendingLogin: {
      fields: {
        tenantId: { type: "string", required: true },
        host: { type: "string", required: true },
        bindingHash: { type: "string", required: true },
        returnPath: { type: "string", required: true },
        expiresAt: { type: "date", required: true },
        codeHash: { type: "string", required: false, unique: true },
        userId: { type: "string", required: false },
        subject: { type: "string", required: false },
        accessToken: { type: "string", required: false },
        refreshToken: { type: "string", required: false },
        accessTokenExpiresAt: { type: "date", required: false },
        idToken: { type: "string", required: false },
      },
    },
  },
  init() {
    return {
      options: {
        databaseHooks: {
          account: {
            create: {
              before: async (account, ctx) => {
                await keepForLogin(account, ctx);
                return withoutTokens;
              },
            },
            update: {
              before: async (account, ctx) => {
                await keepForLogin(account, ctx);
                return withoutTokens;
              },
            },
          },
        },
      },
    };
  },
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === "/callback/:id",
        handler: createAuthMiddleware(async (ctx) => {
          const created = ctx.context.newSession;
          if (!created) return;
          const { adapter, internalAdapter, baseURL } = ctx.context;
          await internalAdapter.deleteSession(created.session.token);
          deleteSessionCookie(ctx);
          const loginId = await oauthLoginId();
          const login = loginId
            ? await adapter.findOne<PendingLogin>({
                model: PENDING_LOGIN,
                where: [{ field: "id", value: loginId }],
              })
            : null;
          const account = (
            await internalAdapter.findAccounts(created.user.id)
          ).find(({ providerId }) => providerId === PROVIDER_ID);
          if (
            !login ||
            !account ||
            login.expiresAt <= new Date() ||
            !login.accessToken ||
            !login.refreshToken ||
            !login.accessTokenExpiresAt
          ) {
            throw ctx.redirect(loginErrorUrl(login?.host, "login_expired"));
          }
          const code = randomToken();
          await adapter.update({
            model: PENDING_LOGIN,
            where: [{ field: "id", value: login.id }],
            update: {
              codeHash: sha256(code),
              userId: created.user.id,
              subject: account.accountId,
              expiresAt: new Date(Date.now() + CODE_TTL_MS),
            },
          });
          ctx.setHeader("Referrer-Policy", "no-referrer");
          throw ctx.redirect(
            `${new URL(baseURL).protocol}//${login.host}/auth/handoff?code=${code}`,
          );
        }),
      },
    ],
  },
  endpoints: {
    startLogin: createAuthEndpoint.serverOnly(
      {
        method: "POST",
        body: z.object({
          tenantId: z.string(),
          host: z.string(),
          returnPath: z.string(),
        }),
      },
      async (ctx) => {
        const { adapter, baseURL } = ctx.context;
        await adapter.deleteMany({
          model: PENDING_LOGIN,
          where: [{ field: "expiresAt", operator: "lt", value: new Date() }],
        });
        const value = randomToken();
        const login = await adapter.create<
          Omit<PendingLogin, "id">,
          PendingLogin
        >({
          model: PENDING_LOGIN,
          data: {
            ...ctx.body,
            bindingHash: sha256(value),
            expiresAt: new Date(Date.now() + LOGIN_TTL_SECONDS * 1000),
          },
        });
        const cookie = binding(login.id);
        ctx.setCookie(cookie.name, value, cookie.attributes);
        throw ctx.redirect(
          `${new URL(baseURL).origin}/auth/begin?login=${login.id}`,
        );
      },
    ),
    handOffLogin: createAuthEndpoint.serverOnly(
      {
        method: "POST",
        body: z.object({ code: z.string(), host: z.string() }),
        metadata: { noStore: true },
      },
      async (ctx) => {
        ctx.setHeader("Referrer-Policy", "no-referrer");
        const { adapter, internalAdapter, authCookies, secret } = ctx.context;
        const login = await adapter.consumeOne<PendingLogin>({
          model: PENDING_LOGIN,
          where: [{ field: "codeHash", value: sha256(ctx.body.code) }],
        });
        const presented = login && ctx.getCookie(binding(login.id).name);
        const user = login?.userId
          ? await internalAdapter.findUserById(login.userId)
          : null;
        if (
          !login ||
          !user ||
          !login.subject ||
          !login.accessToken ||
          !login.refreshToken ||
          !login.accessTokenExpiresAt ||
          login.expiresAt <= new Date() ||
          login.host !== ctx.body.host ||
          !presented ||
          sha256(presented) !== login.bindingHash
        ) {
          throw ctx.redirect(loginErrorUrl(ctx.body.host, "invalid_handoff"));
        }
        const previous = await ctx.getSignedCookie(
          authCookies.sessionToken.name,
          secret,
        );
        if (previous) await internalAdapter.deleteSession(previous);
        const session = await internalAdapter.createSession(user.id, false, {
          tenantId: login.tenantId,
          kind: "staff",
        });
        await adapter.create({
          model: TENANT_ACCESS_TOKEN,
          data: {
            sessionId: session.id,
            subject: login.subject,
            accessToken: login.accessToken,
            refreshToken: login.refreshToken,
            accessTokenExpiresAt: login.accessTokenExpiresAt,
            idToken: login.idToken,
          },
        });
        await setSessionCookie(ctx, { session, user }, false, {
          maxAge: undefined,
        });
        expireCookie(ctx, binding(login.id));
        const target = login.returnPath
          .replaceAll("&", "&amp;")
          .replaceAll('"', "&quot;");
        return new Response(
          `<!doctype html><meta http-equiv="refresh" content="0;url=${target}">`,
          { headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
      },
    ),
    logOut: createAuthEndpoint.serverOnly({ method: "POST" }, async (ctx) => {
      const { adapter, internalAdapter, authCookies, secret } = ctx.context;
      const token = await ctx.getSignedCookie(
        authCookies.sessionToken.name,
        secret,
      );
      const current = token ? await internalAdapter.findSession(token) : null;
      let idToken: string | null = null;
      if (current) {
        const where = [{ field: "sessionId", value: current.session.id }];
        idToken =
          (
            await adapter.findOne<{ idToken?: string | null }>({
              model: TENANT_ACCESS_TOKEN,
              where,
            })
          )?.idToken ?? null;
        await adapter.deleteMany({ model: EVENT_ACCESS_TOKEN, where });
        await adapter.deleteMany({ model: TENANT_ACCESS_TOKEN, where });
        await internalAdapter.deleteSession(current.session.token);
      }
      deleteSessionCookie(ctx);
      return { idToken };
    }),
  },
} satisfies BetterAuthPlugin;

async function keepForLogin(
  { accessToken, refreshToken, accessTokenExpiresAt, idToken }: ReceivedTokens,
  ctx: GenericEndpointContext | null,
) {
  const loginId = ctx ? await oauthLoginId() : undefined;
  if (!ctx || !loginId) return;
  await ctx.context.adapter.update({
    model: PENDING_LOGIN,
    where: [{ field: "id", value: loginId }],
    update: { accessToken, refreshToken, accessTokenExpiresAt, idToken },
  });
}

export function createLoginFlow({ auth, env }: RealAuth) {
  const discovery = idpDiscovery(env.issuer);

  async function endSessionEndpoint() {
    const { end_session_endpoint } = await discovery();
    if (!end_session_endpoint) {
      throw new Error("the IdP publishes no end_session_endpoint");
    }
    return end_session_endpoint;
  }

  return {
    async challengeLogin(challenge: string) {
      return challengeLogin(
        env.issuer,
        (await discovery()).authorization_endpoint,
        challenge,
      );
    },

    async start(request: Request, tenantId: string): Promise<Response> {
      const returnPath = sameHostPath(
        new URL(request.url).searchParams.get("return") ?? "/",
      );
      const host = request.headers.get("host") ?? "";
      if (!returnPath) {
        return Response.redirect(loginErrorUrl(host, "invalid_return"), 302);
      }
      return auth.api.startLogin({
        body: { tenantId, host, returnPath },
        asResponse: true,
      });
    },

    async begin(request: Request): Promise<Response> {
      const loginId = new URL(request.url).searchParams.get("login");
      const { adapter } = await auth.$context;
      const login = loginId
        ? await adapter.findOne<PendingLogin>({
            model: PENDING_LOGIN,
            where: [{ field: "id", value: loginId }],
          })
        : null;
      if (!login || login.codeHash || login.expiresAt <= new Date()) {
        return Response.redirect(
          loginErrorUrl(login?.host, "login_expired"),
          302,
        );
      }
      const { headers } = await auth.api.signInSocial({
        body: {
          provider: PROVIDER_ID,
          callbackURL: "/",
          errorCallbackURL: loginErrorUrl(login.host),
          additionalData: { loginId: login.id },
          additionalParams: {
            resource: `https://${env.resourceHost}/tenants/${login.tenantId}`,
            audience: "backend-api",
          },
        },
        headers: request.headers,
        returnHeaders: true,
      });
      return new Response(null, { status: 302, headers });
    },

    async logout(request: Request): Promise<Response> {
      const host = request.headers.get("host") ?? "";
      const origin = tenantOrigin(host);
      if (!origin || request.headers.get("origin") !== origin) {
        return new Response(null, { status: 403 });
      }
      const { headers, response } = await auth.api.logOut({
        headers: request.headers,
        returnHeaders: true,
      });
      const { idToken } = response;
      const loggedOut = `${rootOrigin()}/auth/logged-out`;
      const target = new URL(idToken ? await endSessionEndpoint() : loggedOut);
      if (idToken) {
        target.searchParams.set("id_token_hint", idToken);
        target.searchParams.set("post_logout_redirect_uri", loggedOut);
      }
      target.searchParams.set("state", host);
      headers.set("location", target.href);
      return new Response(null, { status: 303, headers });
    },

    handoff(request: Request): Promise<Response> {
      return auth.api.handOffLogin({
        body: {
          code: new URL(request.url).searchParams.get("code") ?? "",
          host: request.headers.get("host") ?? "",
        },
        headers: request.headers,
        asResponse: true,
      });
    },
  };
}
