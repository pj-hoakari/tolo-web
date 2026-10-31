import "server-only";

import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { TenantService } from "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb";
import { tenantAccess } from "./authorize";

const baseUrl = process.env.GATEWAY_URL ?? "http://127.0.0.1:8080";

export const tenantManagementClient = createClient(
  TenantService,
  createConnectTransport({
    baseUrl,
    httpVersion: "1.1",
    interceptors: [tenantAccess],
  }),
);

export const tenantRegistrationClient = createClient(
  TenantService,
  createConnectTransport({ baseUrl, httpVersion: "1.1" }),
);
