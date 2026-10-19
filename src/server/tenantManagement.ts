import "server-only";

import { createClient, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { TenantService } from "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb";

const authorize: Interceptor = (next) => (req) => {
  const token = process.env.TENANT_ACCESS_TOKEN;
  if (token) req.header.set("Authorization", `Bearer ${token}`);
  return next(req);
};

export const tenantManagementClient = createClient(
  TenantService,
  createConnectTransport({
    baseUrl: process.env.GATEWAY_URL ?? "http://127.0.0.1:8080",
    httpVersion: "1.1",
    interceptors: [authorize],
  }),
);
