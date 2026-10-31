import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveTenant } from "@/lib/control/tenant";
import { resolveTenantSubdomain } from "../tenantSubdomain";
import { getRealAuth } from "./betterAuth";
import { createLoginFlow } from "./login";
import { authMockingEnabled } from "./mocking";
import { createSessionAuth } from "./session";

export type Viewer =
  | { type: "anonymous" }
  | { type: "staff"; userId: string; tenantId: string }
  | {
      type: "machine";
      userId: string;
      tenantId: string;
      eventId: string;
      edgeDeviceId: string;
    };

export type AccessTokenRequest =
  | { type: "tenant_access" }
  | { type: "event_access"; eventId: string; client: "console" | "edge" };

let sessionAuth: ReturnType<typeof createSessionAuth> | undefined;
let login: ReturnType<typeof createLoginFlow> | undefined;

function realAuth() {
  sessionAuth ??= createSessionAuth(getRealAuth());
  return sessionAuth;
}

export function loginFlow() {
  login ??= createLoginFlow(getRealAuth());
  return login;
}

async function requestTenantId(): Promise<string | undefined> {
  const resolution = resolveTenant((await headers()).get("host") ?? "");
  if (resolution.type !== "tenant") return undefined;
  return resolveTenantSubdomain(resolution.subdomain);
}

export async function getViewer(): Promise<Viewer> {
  if (!authMockingEnabled()) {
    return realAuth().viewer(await headers(), await requestTenantId());
  }
  const tenantId = await requestTenantId();
  if (!tenantId) return { type: "anonymous" };
  return {
    type: "staff",
    userId: process.env.AUTH_MOCK_USER_ID || "user-owner",
    tenantId,
  };
}

export async function requireStaff(returnPath: string): Promise<void> {
  if ((await getViewer()).type !== "staff") {
    redirect(`/auth/login?return=${encodeURIComponent(returnPath)}`);
  }
}

const MOCK_TOKEN_ENV = {
  tenant_access: "TENANT_ACCESS_TOKEN",
  console: "GRAPH_ACCESS_TOKEN",
  edge: "OBSERVATION_ACCESS_TOKEN",
} as const;

export async function getAccessToken(
  request: AccessTokenRequest,
): Promise<string> {
  if (!authMockingEnabled()) {
    return realAuth().accessToken(
      await headers(),
      await requestTenantId(),
      request,
    );
  }
  const name =
    MOCK_TOKEN_ENV[
      request.type === "tenant_access" ? request.type : request.client
    ];
  const token = process.env[name];
  if (!token) throw new Error(`${name} is not set`);
  return token;
}
