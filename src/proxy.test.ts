import { NextRequest, NextResponse } from "next/server";
import { describe, expect, test } from "vitest";
import { __test__, config, tenantProxy } from "./proxy";

describe("proxy matcher", () => {
  test("detection runtime assets should bypass tenant routing", () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);

    expect(matcher.test("/models/yolov8n.onnx")).toBe(false);
    expect(matcher.test("/onnxruntime/runtime.wasm")).toBe(false);
    expect(matcher.test("/onnxruntime/runtime.mjs")).toBe(false);
    expect(matcher.test("/event/test/observation")).toBe(true);
  });
});

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
  test("path sharing the tenant prefix should not be detected", () => {
    const detected = isInternalTenantPath("/tenants");
    expect(detected).toBe(false);
  });
  test("unrelated path should not be detected", () => {
    const detected = isInternalTenantPath("/about");
    expect(detected).toBe(false);
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
    const rewriteToken = "test-token";
    const request = new NextRequest(`http://${host}`, {
      headers: {
        host: host,
      },
    });
    const response = tenantProxy(request, rewriteToken);
    const url = request.nextUrl.clone();
    url.pathname = "/tenant/tenant1";
    expect(response.headers.get("x-middleware-rewrite")).toBe(url.toString());
    expect(
      response.headers.get("x-middleware-request-tolo-tenant-rewritten"),
    ).toBe(rewriteToken);
    expect(response.status).toBe(200);
  });
  test("subpath should be preserved when rewriting to the internal tenant path", () => {
    const host = "tenant1.localhost";
    const request = new NextRequest(`http://${host}/about`, {
      headers: {
        host: host,
      },
    });
    const response = tenantProxy(request);
    const url = request.nextUrl.clone();
    url.pathname = "/tenant/tenant1/about";
    expect(response.headers.get("x-middleware-rewrite")).toBe(url.toString());
  });
  test("invalid host should be denied with 404", () => {
    const host = "tenant1.example.com";
    const request = new NextRequest(`http://${host}`, {
      headers: {
        host: host,
      },
    });
    const response = tenantProxy(request);
    expect(response).toEqual(
      NextResponse.rewrite(new URL("/not-found", request.url)),
    );
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
