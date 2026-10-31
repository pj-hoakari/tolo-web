import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import { headers } from "next/headers";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import TenantGraphEdit from "./event/[eventId]/management/graph/edit/page";
import TenantManagement from "./event/[eventId]/management/page";
import TenantEventManagement from "./management/page";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("AUTH_MOCKING", "enabled");
  vi.stubEnv("ROOT_DOMAIN", "");
  vi.mocked(headers).mockResolvedValue(new Headers({ host: "localhost" }));
});
afterEach(() => vi.unstubAllEnvs());

const params = Promise.resolve({ tenantId: "0123456789abcdef", eventId: "e1" });

it.each([
  ["/management", () => TenantEventManagement({ params })],
  ["/event/e1/management", () => TenantManagement({ params })],
  ["/event/e1/management/graph/edit", () => TenantGraphEdit({ params })],
])(
  "sends an anonymous viewer of %s to the login start",
  async (path, render) => {
    const interrupt = await render().then(
      () => undefined,
      (err: unknown) => err,
    );

    expect(getURLFromRedirectError(interrupt as never)).toBe(
      `/auth/login?return=${encodeURIComponent(path)}`,
    );
  },
);
