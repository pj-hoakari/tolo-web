import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const redirect = vi.hoisted(() =>
  vi.fn((url: string): never => {
    throw new Error(`redirect:${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string) => key,
}));

import LoggedOut from "./page";

const state = (host: string, returnPath: string) =>
  Buffer.from(JSON.stringify({ host, returnPath })).toString("base64url");

afterEach(() => {
  vi.unstubAllEnvs();
  redirect.mockClear();
});

describe("machine logout return", () => {
  it("returns to the tenant observation page", async () => {
    vi.stubEnv("ROOT_DOMAIN", "tolo.test");
    await expect(
      LoggedOut({
        searchParams: Promise.resolve({
          state: state("acme.tolo.test", "/event/123/observation/456"),
        }),
      }),
    ).rejects.toThrow(
      "redirect:https://acme.tolo.test/event/123/observation/456",
    );
  });

  it.each([
    ["foreign.test", "/event/123"],
    ["acme.tolo.test", "//foreign.test/path"],
    ["acme.tolo.test", "https://foreign.test/path"],
  ])("does not redirect for an invalid host or path", async (host, path) => {
    vi.stubEnv("ROOT_DOMAIN", "tolo.test");
    await LoggedOut({
      searchParams: Promise.resolve({ state: state(host, path) }),
    });
    expect(redirect).not.toHaveBeenCalled();
  });
});
