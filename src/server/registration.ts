import "server-only";

import { Code, ConnectError } from "@connectrpc/connect";
import { parseCookies } from "better-auth/cookies";
import type { AcceptError } from "@/features/invitation/acceptErrors";
import type { OnboardingError } from "@/features/onboarding/errorMessages";
import { getRootDomain, rootOrigin } from "@/lib/control/tenant";
import { loginFlow, onboardingStore } from "./auth";
import { INVITATION_COOKIE } from "./auth/invitation";
import { cookie, loginErrorUrl } from "./auth/login";
import { ONBOARDING_COOKIE } from "./auth/onboarding";
import {
  relationRegistrationClient,
  tenantRegistrationClient,
} from "./tenantManagement";

const LOGIN_TO_MANAGEMENT = `/auth/login?return=${encodeURIComponent("/management")}`;

export async function claimTenantOwnership(
  claim: {
    tenantId: string;
    ownershipClaimToken: string;
    subdomain: string;
    displayName: string;
  },
  registrationToken: string,
): Promise<string> {
  const claimed = await tenantRegistrationClient.claimTenantOwnership(claim, {
    headers: { Authorization: `Bearer ${registrationToken}` },
  });
  if (!claimed.tenant) {
    throw new Error("ClaimTenantOwnership returned no tenant");
  }
  return claimed.tenant.subdomain;
}

function onboardingError(err: unknown): OnboardingError {
  if (!(err instanceof ConnectError)) return "failed";
  if (err.code === Code.AlreadyExists) return "subdomainTaken";
  if (err.code === Code.InvalidArgument) return "invalid";
  return "failed";
}

function acceptError(err: unknown): AcceptError {
  if (!(err instanceof ConnectError)) return "failed";
  if (err.code === Code.Unauthenticated) return "unusable";
  if (err.code === Code.FailedPrecondition) return "cannotJoin";
  if (err.code === Code.NotFound) return "notFound";
  return "failed";
}

function redirect(headers: Headers, location: string): Response {
  headers.set("location", location);
  return new Response(null, { status: 302, headers });
}

export async function completeOnboarding(request: Request): Promise<Response> {
  const host = request.headers.get("host") ?? "";
  const { headers, registration } = await loginFlow().takeRegistration(request);
  const pending = await onboardingStore().bound(
    parseCookies(request.headers.get("cookie") ?? "").get(ONBOARDING_COOKIE),
  );
  if (!registration || !pending || pending.tenantId !== registration.tenantId) {
    return redirect(headers, loginErrorUrl(host, "invalid_handoff"));
  }
  let subdomain: string;
  try {
    subdomain = await claimTenantOwnership(
      {
        tenantId: pending.tenantId,
        ownershipClaimToken: pending.ownershipClaimToken,
        subdomain: pending.subdomain,
        displayName: pending.displayName,
      },
      registration.token,
    );
  } catch (err) {
    console.error("failed to claim the tenant ownership", err);
    const error = onboardingError(err);
    if (error === "failed") {
      await onboardingStore().forget(pending.id);
      headers.append("set-cookie", cookie(ONBOARDING_COOKIE, "", 0));
    }
    return redirect(headers, `/onboarding?error=${error}`);
  }
  await onboardingStore().forget(pending.id);
  headers.append("set-cookie", cookie(ONBOARDING_COOKIE, "", 0));
  return redirect(
    headers,
    `${new URL(rootOrigin()).protocol}//${subdomain}.${getRootDomain()}${LOGIN_TO_MANAGEMENT}`,
  );
}

export async function completeInvitation(
  request: Request,
  tenantId: string,
): Promise<Response> {
  const host = request.headers.get("host") ?? "";
  const { headers, registration } = await loginFlow().takeRegistration(request);
  if (!registration || registration.tenantId !== tenantId) {
    return redirect(headers, loginErrorUrl(host, "invalid_handoff"));
  }
  const invitationToken = parseCookies(request.headers.get("cookie") ?? "").get(
    INVITATION_COOKIE,
  );
  if (!invitationToken) return redirect(headers, "/invitation/accept");
  try {
    await relationRegistrationClient.acceptTenantInvitation(
      { tenantId, invitationToken },
      { headers: { Authorization: `Bearer ${registration.token}` } },
    );
  } catch (err) {
    console.error("failed to accept the invitation", err);
    return redirect(headers, `/invitation/accept?error=${acceptError(err)}`);
  }
  headers.append("set-cookie", cookie(INVITATION_COOKIE, "", 0));
  return redirect(headers, LOGIN_TO_MANAGEMENT);
}
