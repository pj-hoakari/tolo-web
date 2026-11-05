import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

export const BROWSER_COOKIE = "__Host-tolo.browser";
const BROWSER_TTL_SECONDS = 365 * 24 * 60 * 60;

export type BrowserCookie = {
  name: string;
  value: string;
  attributes: {
    path: "/";
    secure: true;
    httpOnly: true;
    sameSite: "lax";
    maxAge: number;
  };
};

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

const signature = (id: string, secret: string) =>
  createHmac("sha256", secret).update(`tolo-browser:${id}`).digest("base64url");

export function newBrowserId(): string {
  return randomBytes(32).toString("base64url");
}

export function browserHash(id: string): string {
  return sha256(id);
}

export function signBrowserId(id: string, secret: string): string {
  return `${id}.${signature(id, secret)}`;
}

export function verifyBrowserId(
  value: string | null | undefined,
  secret: string,
): string | undefined {
  if (!value) return undefined;
  const parts = value.split(".");
  if (parts.length !== 2) return undefined;
  const [id, presented] = parts;
  if (!id || !presented) return undefined;
  const expected = signature(id, secret);
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return undefined;
  }
  return id;
}

export function browserCookie(id: string, secret: string): BrowserCookie {
  return {
    name: BROWSER_COOKIE,
    value: signBrowserId(id, secret),
    attributes: {
      path: "/",
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      maxAge: BROWSER_TTL_SECONDS,
    },
  };
}

export function cookieValue(
  cookieHeader: string | null | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    if (trimmed.slice(0, separator) === name) {
      return trimmed.slice(separator + 1);
    }
  }
  return undefined;
}

export function browserCookieValue(
  cookieHeader: string | null | undefined,
): string | undefined {
  return cookieValue(cookieHeader, BROWSER_COOKIE);
}
