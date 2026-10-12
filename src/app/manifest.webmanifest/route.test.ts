import { describe, expect, test } from "vitest";
import { GET } from "./route";

describe("manifest route", () => {
  test.each(["https://tolo.example.com", "https://tenant.tolo.example.com"])(
    "starts at the installation page on %s without browser storage",
    async (origin) => {
      const start = "/event/example/guest";
      const url = new URL("/manifest.webmanifest", origin);
      url.searchParams.set("start", start);

      const response = GET(new Request(url));
      const manifest = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "application/manifest+json",
      );
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(manifest.start_url).toBe(start);
      expect(manifest.id).toBe("/");
      expect(manifest.scope).toBe("/");
    },
  );

  test.each([
    null,
    "",
    "/",
    "https://example.com/event/example/guest",
    "//example.com/event/example/guest",
    "/\\example.com/event/example/guest",
    "/tenant/example/event/example/guest",
    "/api/health",
    "/rpc/observation",
    "/_next/static/file.js",
    "/event/../tenant/example",
    "/event/%2e%2e/api/health",
    "/event/example/guest?redirect=https://example.com",
    "/event/example/guest#section",
  ])("falls back to / for an invalid launch target: %s", async (start) => {
    const url = new URL("https://tenant.tolo.example.com/manifest.webmanifest");
    if (start !== null) url.searchParams.set("start", start);

    const response = GET(new Request(url));
    expect((await response.json()).start_url).toBe("/");
  });
});
