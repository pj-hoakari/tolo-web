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

  const normalizedRoot = rootDomain.toLowerCase();

  if (host === normalizedRoot) {
    return { tenantId: "", isInvalid: false };
  }

  const suffix = `.${normalizedRoot}`;
  if (!host.endsWith(suffix)) {
    return { tenantId: "", isInvalid: true };
  }

  const subdomains = host.slice(0, -suffix.length).split(".").filter(Boolean);

  if (subdomains.length !== 1) {
    return { tenantId: "", isInvalid: true };
  }

  const subdomain = subdomains[0];

  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return { tenantId: "", isInvalid: false };
  }

  return { tenantId: subdomain, isInvalid: false };
}
