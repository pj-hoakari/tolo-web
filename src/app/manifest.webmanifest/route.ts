import { getRestorePath } from "@/components/pwa/pwa-utils";
import { createManifest } from "@/lib/pwa/manifest";

export function GET(request: Request) {
  const requestedStart = new URL(request.url).searchParams.get("start");
  const startUrl = getRestorePath(requestedStart) ?? "/";

  return Response.json(createManifest(startUrl), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-store",
    },
  });
}
