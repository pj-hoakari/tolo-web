export function getRootDomain(): string {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost").toLowerCase();
}

const RESERVED_SUBDOMAINS = new Set(["www"]);

export function extractTenantId(
  hostHeader: string,
  rootDomain: string = getRootDomain(),
): { tenantId: string; isInvalid: boolean } {
  if (!hostHeader) {
    return { tenantId: "", isInvalid: true };
  }

  const host = hostHeader.split(":")[0].toLowerCase();
  if (!host) {
    return { tenantId: "", isInvalid: true };
  }

  if (host === rootDomain) {
    return { tenantId: "", isInvalid: false };
  }

  if (!host.endsWith(rootDomain)) {
    return { tenantId: "", isInvalid: true };
  }

  const subdomains = host
    .slice(0, -rootDomain.length)
    .split(".")
    .filter(Boolean);

  if (subdomains.length === 0 || subdomains.length > 1) {
    return { tenantId: "", isInvalid: true };
  }

  if (RESERVED_SUBDOMAINS.has(subdomains[0])) {
    return { tenantId: "", isInvalid: false };
  }

  const tenantId = subdomains[0];
  return { tenantId, isInvalid: false };
}
