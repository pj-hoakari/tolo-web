import { afterEach, describe, expect, test, vi } from "vitest";
import { getRootDomain, resolveTenant } from "./tenant";

describe("resolveTenant", () => {
  test("extract one label below the root domain as the subdomain name", () => {
    const hostHeader = "tenant1.example.com";
    const result = resolveTenant(hostHeader, "example.com");
    expect(result).toEqual({ type: "tenant", subdomain: "tenant1" });
  });
  test("default root domain should be localhost", () => {
    const hostHeader = "tenant2.localhost";
    const result = resolveTenant(hostHeader);
    expect(result).toEqual({ type: "tenant", subdomain: "tenant2" });
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
  test("uppercase host should be normalized to a lowercase subdomain name", () => {
    const hostHeader = "Tenant1.Example.com";
    const result = resolveTenant(hostHeader, "example.com");
    expect(result).toEqual({ type: "tenant", subdomain: "tenant1" });
  });
  test("uppercase root domain should still match the host", () => {
    const hostHeader = "tenant1.example.com";
    const result = resolveTenant(hostHeader, "EXAMPLE.COM");
    expect(result).toEqual({ type: "tenant", subdomain: "tenant1" });
  });
  test("reserved subdomain with an extra level should be invalid as a nested subdomain", () => {
    const hostHeader = "www.tenant1.example.com";
    const result = resolveTenant(hostHeader, "example.com");
    expect(result).toEqual({ type: "invalid", reason: "nested-subdomain" });
  });
  test("port number is ignored while extracting a subdomain name", () => {
    const hostHeader = "tenant1.localhost:3000";
    const result = resolveTenant(hostHeader);
    expect(result).toEqual({ type: "tenant", subdomain: "tenant1" });
  });
  test("a public id label is parsed as a subdomain name like any other label", () => {
    const result = resolveTenant("0123456789abcdef.localhost");
    expect(result).toEqual({ type: "tenant", subdomain: "0123456789abcdef" });
  });
});

describe("getRootDomain", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });
  test("reads the root domain from ROOT_DOMAIN", () => {
    vi.stubEnv("ROOT_DOMAIN", "Runtime.Example");
    expect(getRootDomain()).toBe("runtime.example");
  });
  test("falls back to localhost when ROOT_DOMAIN is unset", () => {
    vi.stubEnv("ROOT_DOMAIN", "");
    expect(getRootDomain()).toBe("localhost");
  });
});
