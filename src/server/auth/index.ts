import "server-only";

import { headers } from "next/headers";
import { resolveTenant } from "@/lib/control/tenant";
import { resolveTenantSubdomain } from "../tenantSubdomain";
import { authMockingEnabled } from "./mocking";

export type Viewer =
  | { type: "anonymous" }
  | { type: "staff"; userId: string; tenantId: string }
  | {
      type: "machine";
      userId: string;
      tenantId: string;
      eventId: string;
      edgeDeviceId: string;
    };

export type AccessTokenRequest =
  | { type: "tenant_access" }
  | { type: "event_access"; eventId: string; client: "console" | "edge" };

function requireAuthMocking(): void {
  if (!authMockingEnabled()) {
    throw new Error(
      "no authentication is configured; set AUTH_MOCKING=enabled to use the local mock",
    );
  }
}

export async function getViewer(): Promise<Viewer> {
  requireAuthMocking();
  const resolution = resolveTenant((await headers()).get("host") ?? "");
  if (resolution.type !== "tenant") return { type: "anonymous" };
  const tenantId = await resolveTenantSubdomain(resolution.subdomain);
  if (!tenantId) return { type: "anonymous" };
  return {
    type: "staff",
    userId: process.env.AUTH_MOCK_USER_ID || "user-owner",
    tenantId,
  };
}

const MOCK_TOKEN_ENV = {
  tenant_access: "TENANT_ACCESS_TOKEN",
  console: "GRAPH_ACCESS_TOKEN",
  edge: "OBSERVATION_ACCESS_TOKEN",
} as const;

export async function getAccessToken(
  request: AccessTokenRequest,
): Promise<string> {
  requireAuthMocking();
  const name =
    MOCK_TOKEN_ENV[
      request.type === "tenant_access" ? request.type : request.client
    ];
  const token = process.env[name];
  if (!token) throw new Error(`${name} is not set`);
  return token;
}
