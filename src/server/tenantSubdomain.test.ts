import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { ResolveTenantSubdomainResponseSchema } from "@pj-hoakari/tolo-tenant-management-connect-es/tolo/tenant/v1/tenant_pb";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTenantSubdomainResolver,
  resolveTenantSubdomain,
} from "./tenantSubdomain";

vi.hoisted(() => {
  process.env.GATEWAY_URL = "http://127.0.0.1:9";
});
vi.mock("server-only", () => ({}));

const tenantId = "0123456789abcdef";

function fakeClient(...outcomes: (string | Error)[]) {
  const resolveTenantSubdomain = vi.fn(async () => {
    const outcome = outcomes.shift();
    if (outcome instanceof Error) throw outcome;
    return create(ResolveTenantSubdomainResponseSchema, { tenantId: outcome });
  });
  return {
    resolveTenantSubdomain,
    resolve: createTenantSubdomainResolver({ resolveTenantSubdomain }),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createTenantSubdomainResolver", () => {
  it("asks the gateway once and answers later lookups of the same name from memory", async () => {
    const client = fakeClient(tenantId);

    expect(await client.resolve("acme")).toBe(tenantId);
    expect(await client.resolve("acme")).toBe(tenantId);
    expect(client.resolveTenantSubdomain).toHaveBeenCalledTimes(1);
    expect(client.resolveTenantSubdomain).toHaveBeenCalledWith({
      subdomain: "acme",
    });
  });

  it("answers not found for an unknown name and asks again next time", async () => {
    const notFound = new ConnectError("no tenant", Code.NotFound);
    const client = fakeClient(notFound, tenantId);

    expect(await client.resolve("acme")).toBeUndefined();
    expect(await client.resolve("acme")).toBe(tenantId);
    expect(client.resolveTenantSubdomain).toHaveBeenCalledTimes(2);
  });

  it("passes other failures through and asks again next time", async () => {
    const unavailable = new ConnectError("gateway down", Code.Unavailable);
    const client = fakeClient(unavailable, tenantId);

    await expect(client.resolve("acme")).rejects.toBe(unavailable);
    expect(await client.resolve("acme")).toBe(tenantId);
    expect(client.resolveTenantSubdomain).toHaveBeenCalledTimes(2);
  });
});

describe("resolveTenantSubdomain with TENANT_SUBDOMAIN_MOCKING", () => {
  it("resolves the seed subdomain test to the seed tenant without the gateway", async () => {
    vi.stubEnv("TENANT_SUBDOMAIN_MOCKING", "enabled");

    expect(await resolveTenantSubdomain("test")).toBe(tenantId);
    expect(await resolveTenantSubdomain(tenantId)).toBeUndefined();
    expect(await resolveTenantSubdomain("unknown")).toBeUndefined();
  });
});
