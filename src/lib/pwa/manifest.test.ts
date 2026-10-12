import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { createManifest, getPwaMetadata } from "./manifest";

const publicDirectory = new URL("../../../public/", import.meta.url);

function readPngSize(url: URL) {
  const bytes = readFileSync(url);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe("PWA manifest", () => {
  test("provides the fields required for browser installation", () => {
    const config = createManifest();

    expect(config.name || config.short_name).toBeTruthy();
    expect(config.start_url).toBeTruthy();
    expect(config.display).toBe("standalone");
    expect(config.prefer_related_applications).not.toBe(true);
    expect(config.icons?.map((icon) => icon.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
  });

  test("declared install icons are PNG files with the advertised dimensions", () => {
    const config = createManifest();

    for (const icon of config.icons ?? []) {
      expect(icon.type).toBe("image/png");
      const iconUrl = new URL(icon.src.slice(1), publicDirectory);
      expect(readPngSize(iconUrl)).toBe(icon.sizes);
    }
    expect(readPngSize(new URL("apple-touch-icon.png", publicDirectory))).toBe(
      "180x180",
    );
  });

  test.each(["https://tolo.example.com", "https://tenant.tolo.example.com"])(
    "keeps all public pages within the installed origin %s",
    (origin) => {
      const manifestUrl = new URL("/manifest.webmanifest", origin);
      const paths = [
        "/",
        "/event/example/guest",
        "/event/example/management",
        "/event/example/management/graph/edit",
        "/event/example/observation",
        "/event/example/observation/device",
      ];

      for (const pathname of paths) {
        const config = createManifest(pathname);
        const startUrl = new URL(config.start_url ?? "", manifestUrl);
        const scope = new URL(config.scope ?? "", manifestUrl);

        expect(startUrl.origin).toBe(origin);
        expect(startUrl.pathname).toBe(pathname);
        expect(scope.origin).toBe(origin);
        expect(startUrl.pathname.startsWith(scope.pathname)).toBe(true);
        expect(new URL(config.id ?? "", manifestUrl).href).toBe(`${origin}/`);
      }
    },
  );
});

describe("PWA page metadata", () => {
  test.each([
    "/",
    "/event/example/guest",
    "/event/example/management/graph/edit",
    "/event/example/observation/device",
    "/event/%E5%85%AC%E9%96%8B/guest",
  ])("encodes %s as its manifest launch target", (pathname) => {
    const metadata = getPwaMetadata(pathname);
    const manifestUrl = new URL(
      String(metadata.manifest),
      "https://tenant.tolo.example.com",
    );

    expect(manifestUrl.pathname).toBe("/manifest.webmanifest");
    expect(manifestUrl.searchParams.get("start")).toBe(pathname);
  });
});
