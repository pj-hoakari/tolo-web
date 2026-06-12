import { randomUUID } from "node:crypto";
import {
  type NextFetchEvent,
  type NextProxy,
  type NextRequest,
  NextResponse,
} from "next/server";
import { extractTenantId } from "./lib/control/tenant";

const REWRITE_MARKER_HEADER = "tolo-tenant-rewritten";
const REWRITE_TOKEN = randomUUID();

const TENANT_PATH_BASE = "/tenant";

function isInternalTenantPath(pathname: string): boolean {
  return (
    pathname === TENANT_PATH_BASE || pathname.startsWith(`${TENANT_PATH_BASE}/`)
  );
}

export function tenantProxy(
  request: NextRequest,
  rewriteToken: string = REWRITE_TOKEN,
) {
  if (request.headers.get(REWRITE_MARKER_HEADER) === rewriteToken) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (isInternalTenantPath(pathname)) {
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }

  const { tenantId, isInvalid } = extractTenantId(
    request.headers.get("host") ?? "",
  );

  if (!tenantId) {
    return isInvalid
      ? NextResponse.rewrite(new URL("/not-found", request.url))
      : NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `${TENANT_PATH_BASE}/${tenantId}${pathname === "/" ? "" : pathname}`;
  const headers = new Headers(request.headers);
  headers.set(REWRITE_MARKER_HEADER, REWRITE_TOKEN);
  return NextResponse.rewrite(url, { request: { headers } });
}

export function createTenantProxy() {
  return (request: NextRequest, _: NextFetchEvent) => {
    return tenantProxy(request);
  };
}

export const proxy: NextProxy = createTenantProxy();

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|ico)$).*)",
  ],
};

export const __test__ = {
  isInternalTenantPath,
};
