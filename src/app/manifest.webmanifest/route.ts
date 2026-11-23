import { getRestorePath } from "@/components/pwa/pwa-utils";
import { createManifest } from "@/lib/pwa/manifest";
import { createStaffManifest } from "@/lib/pwa/staff-manifest";

export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requestedStart = params.get("start");
  const startUrl = getRestorePath(requestedStart) ?? "/";

  return Response.json(
    params.get("audience") === "staff"
      ? createStaffManifest()
      : createManifest(startUrl),
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-store",
      },
    },
  );
}
