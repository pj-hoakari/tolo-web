export function getRootDomain(): string {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost").toLowerCase();
}

const RESERVED_SUBDOMAINS = new Set(["www"]);

export type TenantInvalidReason =
  | "empty-host"
  | "foreign-domain"
  | "malformed-host"
  | "nested-subdomain";

export type TenantResolution =
  | { type: "tenant"; tenantId: string }
  | { type: "root" }
  | { type: "invalid"; reason: TenantInvalidReason };

export function resolveTenant(
  hostHeader: string,
  rootDomain: string = getRootDomain(),
): TenantResolution {
  if (!hostHeader) {
    return { type: "invalid", reason: "empty-host" };
  }

  const host = hostHeader.split(":")[0].toLowerCase();
  if (!host) {
    return { type: "invalid", reason: "empty-host" };
  }

  const normalizedRoot = rootDomain.toLowerCase();

  if (host === normalizedRoot) {
    return { type: "root" };
  }

  const suffix = `.${normalizedRoot}`;
  if (!host.endsWith(suffix)) {
    return { type: "invalid", reason: "foreign-domain" };
  }

  const subdomains = host.slice(0, -suffix.length).split(".").filter(Boolean);

  if (subdomains.length === 0) {
    return { type: "invalid", reason: "malformed-host" };
  }

  if (subdomains.length > 1) {
    return { type: "invalid", reason: "nested-subdomain" };
  }

  const subdomain = subdomains[0];

  if (RESERVED_SUBDOMAINS.has(subdomain)) {
    return { type: "root" };
  }

  return { type: "tenant", tenantId: subdomain };
}
