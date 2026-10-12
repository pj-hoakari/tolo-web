import { describe, expect, it } from "vitest";
import { getInstallPlatform, getRestorePath } from "./pwa-utils";

describe("getInstallPlatform", () => {
  it.each([
    ["Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Safari/604.1", 1, "ios"],
    ["Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15", 5, "ios"],
    ["Mozilla/5.0 (Linux; Android 15) Chrome/130.0.0.0", 5, "android"],
    ["Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0 Edg/130.0", 0, "desktop"],
    ["Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15", 0, "mac"],
    ["Mozilla/5.0 (Macintosh) Chrome/130.0.0.0 Safari/537.36", 0, "desktop"],
    ["Mozilla/5.0 Firefox/130.0", 0, "other"],
  ] as const)(
    "%s (%i touch points) selects %s",
    (userAgent, touches, expected) => {
      expect(getInstallPlatform(userAgent, touches)).toBe(expected);
    },
  );
});

describe("getRestorePath", () => {
  it.each([
    "/event/test/guest",
    "/event/test/management/graph/edit",
    "/event/test/observation/0123456789abcdef",
  ])("restores the public pathname %s", (path) => {
    expect(getRestorePath(path)).toBe(path);
  });

  it.each([
    null,
    "",
    "/",
    "https://example.com/event/test/guest",
    "//example.com/event/test/guest",
    "/.//example.com/event/test/guest",
    "/event/..//example.com/event/test/guest",
    "/\\example.com/event/test/guest",
    "event/test/guest",
    "/event/test/guest?redirect=https://example.com",
    "/event/test/guest#section",
    "/event/test/guest\n",
    "/tenant/test/event/test/guest",
    "/api/health",
    "/rpc/observation",
    "/_next/static/file.js",
    "/event/../tenant/test",
    "/event/%2e%2e/api/health",
    "/event/..",
  ])("rejects an external, internal, or non-page path: %s", (path) => {
    expect(getRestorePath(path)).toBeNull();
  });
});
