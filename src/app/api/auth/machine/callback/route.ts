import { NextResponse } from "next/server";
import { rootOrigin } from "@/lib/control/tenant";
import { getMachineAuth } from "@/server/auth/machine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    const { location } = await getMachineAuth().callback({
      code: url.searchParams.get("code") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      error: url.searchParams.get("error") ?? undefined,
    });
    const response = NextResponse.redirect(new URL(location, request.url), 302);
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    console.error(
      "failed to complete the observation page machine authorization",
      error,
    );
    return NextResponse.redirect(
      new URL("/auth/error?error=machine_failed", rootOrigin()),
      302,
    );
  }
}
