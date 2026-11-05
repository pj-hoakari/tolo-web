import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveTenant, rootOrigin } from "@/lib/control/tenant";
import { issueRegistrationToken } from "../idp";
import { resolveTenantSubdomain } from "../tenantSubdomain";
import { getRealAuth } from "./betterAuth";
import { createLoginFlow } from "./login";
import { authMockingEnabled } from "./mocking";
import {
  createOnboarding,
  ONBOARDING_COOKIE,
  type OnboardingInput,
  type StartedRegistration,
  type TenantRegistration,
} from "./onboarding";
import { createSessionAuth } from "./session";

export { authMockingEnabled };

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
let onboarding: ReturnType<typeof createOnboarding> | undefined;

function realAuth() {
  sessionAuth ??= createSessionAuth(getRealAuth());
  return sessionAuth;
}

export function loginFlow() {
  login ??= createLoginFlow(getRealAuth());
  return login;
}

export function onboardingStore() {
  onboarding ??= createOnboarding(getRealAuth());
  return onboarding;
}

export async function boundOnboarding(): Promise<
  TenantRegistration | undefined
> {
  return onboardingStore().bound(
    (await cookies()).get(ONBOARDING_COOKIE)?.value,
  );
}

export async function prepareOnboarding(
  input: OnboardingInput,
  start: () => Promise<StartedRegistration>,
): Promise<string> {
  const jar = await cookies();
  const { binding, expiresAt } = await onboardingStore().keep(
    jar.get(ONBOARDING_COOKIE)?.value,
    input,
    start,
  );
  jar.set(ONBOARDING_COOKIE, binding, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  });
  return "/onboarding/start";
}

export async function requestTenantId(): Promise<string | undefined> {
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
  return { type: "staff", userId: mockUserId(), tenantId };
}

function mockUserId(): string {
  return process.env.AUTH_MOCK_USER_ID || "user-owner";
}

export async function getRegistrationToken(): Promise<string> {
  if (!authMockingEnabled()) {
    throw new Error(
      "registration tokens come from the IdP's registration authorization unless AUTH_MOCKING is enabled",
    );
  }
  return issueRegistrationToken(mockUserId());
}

export async function requireStaff(returnPath: string): Promise<void> {
  const viewer = await getViewer();
  if (viewer.type === "staff") return;
  if (viewer.type === "machine") {
    redirect(`${rootOrigin()}/auth/error?error=machine_session_forbidden`);
  }
  redirect(`/auth/login?return=${encodeURIComponent(returnPath)}`);
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
