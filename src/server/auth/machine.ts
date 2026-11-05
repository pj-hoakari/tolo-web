import "server-only";

import { createHash, randomBytes } from "node:crypto";
import {
  encodeBasicCredentials,
  verifyJwsAccessToken,
} from "better-auth/oauth2";
import { z } from "zod";
import { rootOrigin, tenantOrigin } from "@/lib/control/tenant";
import { getRealAuth, type RealAuth } from "./betterAuth";
import { idpDiscovery } from "./discovery";
import {
  machineBindingCookie,
  PENDING_MACHINE_AUTHORIZATION,
  PENDING_MACHINE_HANDOFF,
} from "./machineSession";

const PENDING_TTL_MS = 10 * 60 * 1000;
const HANDOFF_TTL_MS = 60 * 1000;
const DEFAULT_REDIRECT_URI = "http://localhost:3000/api/auth/machine/callback";

const tokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  id_token: z.string().optional(),
  expires_in: z.number(),
});

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
const randomToken = () => randomBytes(32).toString("base64url");

export interface MachineStartInput {
  tenantId: string;
  eventId: string;
  pageEdgeDeviceId: string;
  staffSub: string;
  host: string;
  returnPath: string;
}

export interface MachineStartResult {
  location: string;
  binding: {
    name: string;
    value: string;
    attributes: ReturnType<typeof machineBindingCookie>["attributes"];
  };
}

export interface MachineCallbackInput {
  code: string | undefined;
  state: string | undefined;
  error: string | undefined;
}

export type MachineSessionResult = "login_required" | "failed";

type PendingMachine = {
  id: string;
  stateHash: string;
  codeVerifier: string;
  nonce: string;
  tenantId: string;
  eventId: string;
  pageEdgeDeviceId: string;
  staffSub: string;
  host: string;
  bindingHash: string;
  returnPath: string;
  redirectUri: string;
  expiresAt: Date;
};

type MachineEnvironment = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  resourceHost: string;
  redirectUri: string;
};

export function machineResultPath(
  returnPath: string,
  result: MachineSessionResult,
): string {
  const url = new URL(returnPath, "http://host.invalid");
  url.searchParams.set("machineSession", result);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function createMachineAuth(
  realAuth: RealAuth,
  options: { redirectUri?: string } = {},
) {
  const discovery = idpDiscovery(realAuth.env.issuer);

  function environment(): MachineEnvironment {
    const {
      issuer,
      machineClientId,
      machineClientSecret,
      resourceHost,
      baseUrl,
    } = realAuth.env;
    const redirectUri =
      options.redirectUri ||
      process.env.AUTH_IDP_MACHINE_REDIRECT_URI ||
      (baseUrl
        ? `${baseUrl.replace(/\/+$/, "")}/api/auth/machine/callback`
        : undefined) ||
      DEFAULT_REDIRECT_URI;
    if (!issuer || !machineClientId || !machineClientSecret || !resourceHost) {
      throw new Error("the observation page machine client is not configured");
    }
    return {
      issuer,
      clientId: machineClientId,
      clientSecret: machineClientSecret,
      resourceHost,
      redirectUri,
    };
  }

  async function adapter() {
    return (await realAuth.auth.$context).adapter;
  }

  async function pendingByState(state: string) {
    const store = await adapter();
    return store.findOne<PendingMachine>({
      model: PENDING_MACHINE_AUTHORIZATION,
      where: [{ field: "stateHash", value: sha256(state) }],
    });
  }

  async function deletePending(id: string) {
    const store = await adapter();
    await store.delete({
      model: PENDING_MACHINE_AUTHORIZATION,
      where: [{ field: "id", value: id }],
    });
  }

  async function postToTokenEndpoint(
    env: MachineEnvironment,
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
    env: MachineEnvironment,
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

  return {
    async start(input: MachineStartInput): Promise<MachineStartResult> {
      const env = environment();
      const store = await adapter();
      const now = new Date();
      await store.deleteMany({
        model: PENDING_MACHINE_AUTHORIZATION,
        where: [{ field: "expiresAt", operator: "lt", value: now }],
      });
      const previous = await store.findMany<PendingMachine>({
        model: PENDING_MACHINE_AUTHORIZATION,
        where: [
          { field: "eventId", value: input.eventId },
          { field: "pageEdgeDeviceId", value: input.pageEdgeDeviceId },
        ],
      });
      for (const row of previous ?? []) await deletePending(row.id);

      const state = randomToken();
      const nonce = randomToken();
      const verifier = randomToken();
      const bindingValue = randomToken();
      const challenge = createHash("sha256")
        .update(verifier)
        .digest("base64url");
      await store.create({
        model: PENDING_MACHINE_AUTHORIZATION,
        data: {
          stateHash: sha256(state),
          codeVerifier: verifier,
          nonce,
          tenantId: input.tenantId,
          eventId: input.eventId,
          pageEdgeDeviceId: input.pageEdgeDeviceId,
          staffSub: input.staffSub,
          host: input.host,
          bindingHash: sha256(bindingValue),
          returnPath: input.returnPath,
          redirectUri: env.redirectUri,
          expiresAt: new Date(Date.now() + PENDING_TTL_MS),
        },
      });

      const url = new URL((await discovery()).authorization_endpoint);
      url.searchParams.set("response_type", "code");
      url.searchParams.set("client_id", env.clientId);
      url.searchParams.set("redirect_uri", env.redirectUri);
      url.searchParams.set("scope", "openid events.report");
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
      return {
        location: url.href,
        binding: {
          ...machineBindingCookie(),
          value: bindingValue,
        },
      };
    },

    async callback(input: MachineCallbackInput): Promise<{ location: string }> {
      const env = environment();
      const pending = input.state ? await pendingByState(input.state) : null;
      if (!pending || pending.expiresAt <= new Date()) {
        if (pending) await deletePending(pending.id);
        return {
          location: `${rootOrigin()}/auth/error?error=machine_state_invalid`,
        };
      }
      const finish = async (result: MachineSessionResult) => {
        await deletePending(pending.id);
        return { location: machineResultPath(pending.returnPath, result) };
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
      if (subject !== pending.staffSub) return finish("failed");

      const { adapter: store, internalAdapter } = await realAuth.auth.$context;
      const found = await internalAdapter.findUserByEmail(
        `${subject}@tolo-idp.local`,
      );
      if (!found?.user) return finish("failed");
      const target = tenantOrigin(pending.host);
      if (!target) return finish("failed");

      const code = randomToken();
      await store.create({
        model: PENDING_MACHINE_HANDOFF,
        data: {
          codeHash: sha256(code),
          tenantId: pending.tenantId,
          eventId: pending.eventId,
          edgeDeviceId: pending.pageEdgeDeviceId,
          userId: found.user.id,
          subject,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          idToken: tokens.id_token,
          accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
          host: pending.host,
          bindingHash: pending.bindingHash,
          returnPath: pending.returnPath,
          expiresAt: new Date(Date.now() + HANDOFF_TTL_MS),
        },
      });
      await deletePending(pending.id);
      return {
        location: `${target}/api/auth/machine/handoff?code=${encodeURIComponent(code)}`,
      };
    },
  };
}

let machineAuth: ReturnType<typeof createMachineAuth> | undefined;

export function getMachineAuth(): ReturnType<typeof createMachineAuth> {
  machineAuth ??= createMachineAuth(getRealAuth());
  return machineAuth;
}
