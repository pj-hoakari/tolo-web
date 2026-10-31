import "server-only";

import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { RelationAdminService } from "@pj-hoakari/tolo-tenant-management-connect-es/tolo/relation/v1/relation_pb";
import { TenantService } from "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb";
import { tenantAccess } from "./authorize";

const baseUrl = process.env.GATEWAY_URL ?? "http://127.0.0.1:8080";

const tenantAccessTransport = createConnectTransport({
  baseUrl,
  httpVersion: "1.1",
  interceptors: [tenantAccess],
});

export const tenantManagementClient = createClient(
  TenantService,
  tenantAccessTransport,
);

export const relationAdminClient = createClient(
  RelationAdminService,
  tenantAccessTransport,
);

const registrationTransport = createConnectTransport({
  baseUrl,
  httpVersion: "1.1",
});

export const tenantRegistrationClient = createClient(
  TenantService,
  registrationTransport,
);

export const relationRegistrationClient = createClient(
  RelationAdminService,
  registrationTransport,
);
