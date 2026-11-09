import { NextResponse } from "next/server";
import { rootOrigin } from "@/lib/control/tenant";
import { getConnectionAuth } from "@/server/auth/connection";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const location = await getConnectionAuth().callback({
      code: url.searchParams.get("code") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      error: url.searchParams.get("error") ?? undefined,
    });
    return NextResponse.redirect(location, 302);
  } catch (error) {
    console.error(
      "failed to complete the camera connection authorization",
      error,
    );
    return NextResponse.redirect(
      new URL("/auth/error?error=connection_failed", rootOrigin()),
      302,
    );
  }
}
