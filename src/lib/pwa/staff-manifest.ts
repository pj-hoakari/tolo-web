import type { Metadata, MetadataRoute } from "next";
import { createManifest } from "./manifest";

// This is a public tenant URL. Never use the internal /tenant/... rewrite.
export const STAFF_START_URL = "/management";

export function createStaffManifest(): MetadataRoute.Manifest {
  return {
    ...createManifest(STAFF_START_URL),
    // Keep the existing guest/device installation identity intact.
    id: STAFF_START_URL,
  };
}

export function getStaffPwaMetadata(): Pick<Metadata, "manifest"> {
  return { manifest: "/manifest.webmanifest?audience=staff" };
}
