import { createHash } from "node:crypto";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { expireCookie, setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { rootOrigin } from "@/lib/control/tenant";

export const PENDING_MACHINE_AUTHORIZATION = "pendingMachineAuthorization";
export const PENDING_MACHINE_HANDOFF = "pendingMachineHandoff";
export const MACHINE_BINDING_COOKIE = "__Host-tolo.machine.binding";

const TENANT_ACCESS_TOKEN = "tenantAccessToken";
const EVENT_ACCESS_TOKEN = "eventAccessToken";
const BINDING_TTL_SECONDS = 10 * 60;

type PendingMachineHandoff = {
  id: string;
  codeHash: string;
  tenantId: string;
  eventId: string;
  edgeDeviceId: string;
  userId: string;
  subject: string;
  accessToken: string;
  refreshToken: string;
  idToken?: string | null;
  accessTokenExpiresAt: Date;
  host: string;
  bindingHash: string;
  returnPath: string;
  expiresAt: Date;
};

export const machineBindingCookie = () => ({
  name: MACHINE_BINDING_COOKIE,
  attributes: {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: BINDING_TTL_SECONDS,
  } as const,
});

export const machineSessionPlugin = {
  id: "tolo-machine-session",
  schema: {
    pendingMachineAuthorization: {
      fields: {
        stateHash: { type: "string", required: true, unique: true },
        codeVerifier: { type: "string", required: true },
        nonce: { type: "string", required: true },
        tenantId: { type: "string", required: true },
        eventId: { type: "string", required: true },
        pageEdgeDeviceId: { type: "string", required: true },
        staffSub: { type: "string", required: true },
        host: { type: "string", required: true },
        bindingHash: { type: "string", required: true },
        returnPath: { type: "string", required: true },
        redirectUri: { type: "string", required: true },
        expiresAt: { type: "date", required: true },
      },
    },
    pendingMachineHandoff: {
      fields: {
        codeHash: { type: "string", required: true, unique: true },
        tenantId: { type: "string", required: true },
        eventId: { type: "string", required: true },
        edgeDeviceId: { type: "string", required: true },
        userId: { type: "string", required: true },
        subject: { type: "string", required: true },
        accessToken: { type: "string", required: true },
        refreshToken: { type: "string", required: true },
        idToken: { type: "string", required: false },
        accessTokenExpiresAt: { type: "date", required: true },
        host: { type: "string", required: true },
        bindingHash: { type: "string", required: true },
        returnPath: { type: "string", required: true },
        expiresAt: { type: "date", required: true },
      },
    },
  },
  endpoints: {
    completeMachineSession: createAuthEndpoint.serverOnly(
      {
        method: "POST",
        body: z.object({ code: z.string(), host: z.string() }),
        metadata: { noStore: true },
      },
      async (ctx) => {
        ctx.setHeader("Referrer-Policy", "no-referrer");
        const { adapter, internalAdapter, authCookies, secret } = ctx.context;
        const handoff = await adapter.consumeOne<PendingMachineHandoff>({
          model: PENDING_MACHINE_HANDOFF,
          where: [{ field: "codeHash", value: sha256(ctx.body.code) }],
        });
        const presented = ctx.getCookie(MACHINE_BINDING_COOKIE);
        if (
          !handoff ||
          handoff.expiresAt <= new Date() ||
          handoff.host !== ctx.body.host ||
          !presented ||
          sha256(presented) !== handoff.bindingHash
        ) {
          throw ctx.redirect(
            `${rootOrigin()}/auth/error?error=machine_handoff_invalid`,
          );
        }
        const user = await internalAdapter.findUserById(handoff.userId);
        if (!user) {
          throw ctx.redirect(
            `${rootOrigin()}/auth/error?error=machine_handoff_invalid`,
          );
        }

        const previous = await ctx.getSignedCookie(
          authCookies.sessionToken.name,
          secret,
        );
        if (previous) {
          const current = await internalAdapter.findSession(previous);
          if (current) {
            const where = [{ field: "sessionId", value: current.session.id }];
            await adapter.deleteMany({ model: EVENT_ACCESS_TOKEN, where });
            await adapter.deleteMany({ model: TENANT_ACCESS_TOKEN, where });
            await internalAdapter.deleteSession(current.session.token);
          }
        }

        const session = await internalAdapter.createSession(
          user.id,
          false,
          {
            tenantId: handoff.tenantId,
            eventId: handoff.eventId,
            edgeDeviceId: handoff.edgeDeviceId,
            kind: "machine",
          },
          true,
        );
        await adapter.create({
          model: TENANT_ACCESS_TOKEN,
          data: {
            sessionId: session.id,
            subject: handoff.subject,
            accessToken: handoff.accessToken,
            refreshToken: handoff.refreshToken,
            accessTokenExpiresAt: handoff.accessTokenExpiresAt,
            idToken: handoff.idToken,
          },
        });
        await setSessionCookie(ctx, { session, user }, false, {
          maxAge: undefined,
        });
        expireCookie(ctx, machineBindingCookie());
        throw ctx.redirect(handoff.returnPath);
      },
    ),
  },
} satisfies BetterAuthPlugin;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}
