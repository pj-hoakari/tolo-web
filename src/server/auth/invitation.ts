import "server-only";

import { cookies } from "next/headers";

export const INVITATION_COOKIE = "__Host-tolo.invitation";
const INVITATION_TTL_SECONDS = 30 * 60;
const INVITATION_TOKEN = /^[A-Za-z0-9_-]{1,256}$/;

const attributes = {
  path: "/",
  httpOnly: true,
  secure: true,
  sameSite: "lax",
} as const;

export function openInvitation(request: Request): Response {
  const token = new URL(request.url).searchParams.get("token");
  const headers = new Headers({
    Location: "/invitation/accept",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
  });
  if (token && INVITATION_TOKEN.test(token)) {
    headers.append(
      "Set-Cookie",
      `${INVITATION_COOKIE}=${token}; Max-Age=${INVITATION_TTL_SECONDS}; Path=/; HttpOnly; Secure; SameSite=Lax`,
    );
  }
  return new Response(null, { status: 303, headers });
}

export async function pendingInvitationToken(): Promise<string | undefined> {
  const token = (await cookies()).get(INVITATION_COOKIE)?.value;
  return token && INVITATION_TOKEN.test(token) ? token : undefined;
}

export async function forgetInvitation(): Promise<void> {
  (await cookies()).set(INVITATION_COOKIE, "", { ...attributes, maxAge: 0 });
}
