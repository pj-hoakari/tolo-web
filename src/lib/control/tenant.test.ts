import { describe, expect, test } from "vitest";
import { resolveTenant } from "./tenant";

describe("extractTenantId", () => {
  test("extract one subdomain as tenant id from hostHeader string", () => {
    const hostHeader = "tenant1.example.com";
    const result = resolveTenant(hostHeader, "example.com");
    expect(result).toEqual({ type: "tenant", tenantId: "tenant1" });
  });
  test("default root domain should be localhost", () => {
    const hostHeader = "tenant2.localhost";
    const result = resolveTenant(hostHeader);
    expect(result).toEqual({ type: "tenant", tenantId: "tenant2" });
  });
  test("www prefix should be treated as root", () => {
    const hostHeader = "www.example.com";
    const result = resolveTenant(hostHeader, "example.com");
    expect(result).toEqual({ type: "root" });
  });
  test("root domain should be treated as root", () => {
    const hostHeader = "localhost";
    const result = resolveTenant(hostHeader);
    expect(result).toEqual({ type: "root" });
  });
  test("port number should be ignored when resolving the root domain", () => {
    const hostHeader = "localhost:8080";
    const result = resolveTenant(hostHeader);
    expect(result).toEqual({ type: "root" });
  });
  test("no subdomain should be invalid as a malformed host", () => {
    const hostHeader = ".localhost";
    const result = resolveTenant(hostHeader);
    expect(result).toEqual({ type: "invalid", reason: "malformed-host" });
  });
  test("empty string should be invalid as an empty host", () => {
    const hostHeader = "";
    const result = resolveTenant(hostHeader);
    expect(result).toEqual({ type: "invalid", reason: "empty-host" });
  });
  test("IP address should be invalid as a foreign domain", () => {
    const hostHeader = "192.168.0.1";
    const result = resolveTenant(hostHeader);
    expect(result).toEqual({ type: "invalid", reason: "foreign-domain" });
  });
  test("only port number should be invalid as an empty host", () => {
    const hostHeader = ":8080";
    const result = resolveTenant(hostHeader);
    expect(result).toEqual({ type: "invalid", reason: "empty-host" });
  });
  test("host not under the root domain should be invalid as a foreign domain", () => {
    const hostHeader = "tenant1.subdomain.example.com";
    const result = resolveTenant(hostHeader);
    expect(result).toEqual({ type: "invalid", reason: "foreign-domain" });
  });
  test("multiple subdomains under the root domain should be invalid as a nested subdomain", () => {
    const hostHeader = "tenant1.subdomain.example.com";
    const result = resolveTenant(hostHeader, "example.com");
    expect(result).toEqual({ type: "invalid", reason: "nested-subdomain" });
  });
  test("look-alike domain sharing the root suffix should be invalid as a foreign domain", () => {
    const hostHeader = "evilexample.com";
    const result = resolveTenant(hostHeader, "example.com");
    expect(result).toEqual({ type: "invalid", reason: "foreign-domain" });
  });
  test("uppercase host should be normalized to a lowercase tenant id", () => {
    const hostHeader = "Tenant1.Example.com";
    const result = resolveTenant(hostHeader, "example.com");
    expect(result).toEqual({ type: "tenant", tenantId: "tenant1" });
  });
  test("uppercase root domain should still match the host", () => {
    const hostHeader = "tenant1.example.com";
    const result = resolveTenant(hostHeader, "EXAMPLE.COM");
    expect(result).toEqual({ type: "tenant", tenantId: "tenant1" });
  });
  test("reserved subdomain with an extra level should be invalid as a nested subdomain", () => {
    const hostHeader = "www.tenant1.example.com";
    const result = resolveTenant(hostHeader, "example.com");
    expect(result).toEqual({ type: "invalid", reason: "nested-subdomain" });
  });
  test("port number is ignored while extracting a tenant id", () => {
    const hostHeader = "tenant1.localhost:3000";
    const result = resolveTenant(hostHeader);
    expect(result).toEqual({ type: "tenant", tenantId: "tenant1" });
  });
});
