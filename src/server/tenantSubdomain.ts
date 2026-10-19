import "server-only";

import {
  type Client,
  Code,
  ConnectError,
  createClient,
} from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { TenantService } from "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb";

type SubdomainClient = Pick<
  Client<typeof TenantService>,
  "resolveTenantSubdomain"
>;

const MOCK_TENANT_IDS = new Map([["test", "0123456789abcdef"]]);

export function createTenantSubdomainResolver(client: SubdomainClient) {
  const tenantIds = new Map<string, string>();
  return async (subdomain: string): Promise<string | undefined> => {
    const cached = tenantIds.get(subdomain);
    if (cached) return cached;
    try {
      const { tenantId } = await client.resolveTenantSubdomain({ subdomain });
      tenantIds.set(subdomain, tenantId);
      return tenantId;
    } catch (err) {
      if (ConnectError.from(err).code === Code.NotFound) return undefined;
      throw err;
    }
  };
}

const resolveFromGateway = createTenantSubdomainResolver(
  createClient(
    TenantService,
    createConnectTransport({
      baseUrl: process.env.GATEWAY_URL ?? "http://127.0.0.1:8080",
      httpVersion: "1.1",
    }),
  ),
);

export async function resolveTenantSubdomain(
  subdomain: string,
): Promise<string | undefined> {
  if (process.env.TENANT_SUBDOMAIN_MOCKING === "enabled") {
    return MOCK_TENANT_IDS.get(subdomain);
  }
  return resolveFromGateway(subdomain);
}
