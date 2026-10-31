import { getRootDomain } from "@/lib/control/tenant";

export function isAuthMockingAllowed(
  rootDomain: string,
  allowedRootDomains = "",
): boolean {
  const domain = rootDomain.trim().toLowerCase();
  return ["localhost", ...allowedRootDomains.split(",")]
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .some((entry) => domain === entry || domain.endsWith(`.${entry}`));
}

export function authMockingEnabled(): boolean {
  if (process.env.AUTH_MOCKING !== "enabled") return false;
  const rootDomain = getRootDomain();
  if (
    !isAuthMockingAllowed(
      rootDomain,
      process.env.AUTH_MOCKING_ALLOWED_ROOT_DOMAINS,
    )
  ) {
    throw new Error(
      `AUTH_MOCKING=enabled is not allowed for ROOT_DOMAIN=${rootDomain}; use localhost or list it in AUTH_MOCKING_ALLOWED_ROOT_DOMAINS`,
    );
  }
  return true;
}
