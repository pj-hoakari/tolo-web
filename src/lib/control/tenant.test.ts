import { describe, expect, test } from "vitest";
import { extractTenantId } from "./tenant";

describe("extractTenantId", () => {
  test("extract one subdomain as tenant id from hostHeader string", () => {
    const hostHeader = "tenant1.example.com";
    const { tenantId, isInvalid } = extractTenantId(hostHeader, "example.com");
    expect(tenantId).toBe("tenant1");
    expect(isInvalid).toBe(false);
  });
  test("default root domain should be localhost", () => {
    const hostHeader = "tenant2.localhost";
    const { tenantId, isInvalid } = extractTenantId(hostHeader);
    expect(tenantId).toBe("tenant2");
    expect(isInvalid).toBe(false);
  });
  test("www prefix should return empty tenant id", () => {
    const hostHeader = "www.example.com";
    const { tenantId, isInvalid } = extractTenantId(hostHeader, "example.com");
    expect(tenantId).toBe("");
    expect(isInvalid).toBe(false);
  });
  test("root domain should return empty tenant id", () => {
    const hostHeader = "localhost";
    const { tenantId, isInvalid } = extractTenantId(hostHeader);
    expect(tenantId).toBe("");
    expect(isInvalid).toBe(false);
  });
  test("port number should be ignored when extracting tenant id", () => {
    const hostHeader = "localhost:8080";
    const { tenantId, isInvalid } = extractTenantId(hostHeader);
    expect(tenantId).toBe("");
    expect(isInvalid).toBe(false);
  });
  test("no subdomain should return empty tenant id", () => {
    const hostHeader = ".localhost";
    const { tenantId, isInvalid } = extractTenantId(hostHeader);
    expect(tenantId).toBe("");
    expect(isInvalid).toBe(true);
  });
  test("empty string should return empty tenant id", () => {
    const hostHeader = "";
    const { tenantId, isInvalid } = extractTenantId(hostHeader);
    expect(tenantId).toBe("");
    expect(isInvalid).toBe(true);
  });
  test("IP address should return empty tenant id", () => {
    const hostHeader = "192.168.0.1";
    const { tenantId, isInvalid } = extractTenantId(hostHeader);
    expect(tenantId).toBe("");
    expect(isInvalid).toBe(true);
  });
  test("only port number should return empty tenant id", () => {
    const hostHeader = ":8080";
    const { tenantId, isInvalid } = extractTenantId(hostHeader);
    expect(tenantId).toBe("");
    expect(isInvalid).toBe(true);
  });
  test("host not under the root domain should be invalid", () => {
    const hostHeader = "tenant1.subdomain.example.com";
    const { tenantId, isInvalid } = extractTenantId(hostHeader);
    expect(tenantId).toBe("");
    expect(isInvalid).toBe(true);
  });
  test("multiple subdomains under the root domain should be invalid", () => {
    const hostHeader = "tenant1.subdomain.example.com";
    const { tenantId, isInvalid } = extractTenantId(hostHeader, "example.com");
    expect(tenantId).toBe("");
    expect(isInvalid).toBe(true);
  });
  test("look-alike domain sharing the root suffix should be invalid", () => {
    const hostHeader = "evilexample.com";
    const { tenantId, isInvalid } = extractTenantId(hostHeader, "example.com");
    expect(tenantId).toBe("");
    expect(isInvalid).toBe(true);
  });
  test("uppercase host should be normalized to a lowercase tenant id", () => {
    const hostHeader = "Tenant1.Example.com";
    const { tenantId, isInvalid } = extractTenantId(hostHeader, "example.com");
    expect(tenantId).toBe("tenant1");
    expect(isInvalid).toBe(false);
  });
  test("uppercase root domain should still match the host", () => {
    const hostHeader = "tenant1.example.com";
    const { tenantId, isInvalid } = extractTenantId(hostHeader, "EXAMPLE.COM");
    expect(tenantId).toBe("tenant1");
    expect(isInvalid).toBe(false);
  });
  test("reserved subdomain with an extra level should be invalid", () => {
    const hostHeader = "www.tenant1.example.com";
    const { tenantId, isInvalid } = extractTenantId(hostHeader, "example.com");
    expect(tenantId).toBe("");
    expect(isInvalid).toBe(true);
  });
  test("port number is ignored while extracting a tenant id", () => {
    const hostHeader = "tenant1.localhost:3000";
    const { tenantId, isInvalid } = extractTenantId(hostHeader);
    expect(tenantId).toBe("tenant1");
    expect(isInvalid).toBe(false);
  });
});
