import type { Metadata, MetadataRoute } from "next";

export function createManifest(startUrl = "/"): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Tolo",
    short_name: "Tolo",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    prefer_related_applications: false,
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

export function getPwaMetadata(path: string): Pick<Metadata, "manifest"> {
  return {
    manifest: `/manifest.webmanifest?start=${encodeURIComponent(path)}`,
  };
}
