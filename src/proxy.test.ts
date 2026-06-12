import { NextRequest, NextResponse } from "next/server";
import { describe, expect, test } from "vitest";
import { __test__, tenantProxy } from "./proxy";

describe("internal tenant path routing detection", () => {
  const isInternalTenantPath = __test__.isInternalTenantPath;

  test("tenant path root should be detected correctly", () => {
    const tenantPath = "/tenant";
    const detected = isInternalTenantPath(tenantPath);
    expect(detected).toBe(true);
  });
  test("tenant path with subpath should be detected correctly", () => {
    const tenantPath = "/tenant/subpath";
    const detected = isInternalTenantPath(tenantPath);
    expect(detected).toBe(true);
  });
});

describe("tenant routing proxy", () => {
  test("request has tolo-tenant-rewritten header should be skipped", () => {
    const rewriteToken = "test-token";
    const request = new NextRequest("http://localhost/tenant/example", {
      headers: {
        "tolo-tenant-rewritten": rewriteToken,
      },
    });
    const response = tenantProxy(request, rewriteToken);
    expect(response).toEqual(NextResponse.next());
  });
  test("request with tenant subdomain should be rewritten to internal tenant path", () => {
    const host = "tenant1.localhost";
    const request = new NextRequest(`http://${host}`, {
      headers: {
        host: host,
      },
    });
    const response = tenantProxy(request);
    const url = request.nextUrl.clone();
    url.pathname = "/tenant/tenant1";
    expect(response.headers.get("x-middleware-rewrite")).toBe(url.toString());
    expect(response.headers.has("x-middleware-request-tolo-tenant-rewritten"));
    expect(response.status).toBe(200);
  });
  test("direct internal tenant path request should be denied with 404", () => {
    const urlString = "http://localhost/tenant/example";
    const request = new NextRequest(urlString);
    const response = tenantProxy(request);
    expect(response).toEqual(
      NextResponse.rewrite(new URL("/not-found", request.url)),
    );
  });
  test("multiple subdomains should be denied with 404", () => {
    const urlString = "http://tenant1.tenant2.tenant3.localhost/tenant/example";
    const request = new NextRequest(urlString);
    const response = tenantProxy(request);
    expect(response).toEqual(
      NextResponse.rewrite(new URL("/not-found", request.url)),
    );
  });
  test("non-tenant path should be allowed to proceed", () => {
    const host = "localhost";
    const request = new NextRequest(`http://${host}`, {
      headers: {
        host: host,
      },
    });
    const response = tenantProxy(request);
    expect(response).toEqual(NextResponse.next());
  });
  test("www prefix non-tenant path should be allowed to proceed", () => {
    const host = "www.localhost";
    const request = new NextRequest(`http://${host}`, {
      headers: {
        host: host,
      },
    });
    const response = tenantProxy(request);
    expect(response).toEqual(NextResponse.next());
  });
});
