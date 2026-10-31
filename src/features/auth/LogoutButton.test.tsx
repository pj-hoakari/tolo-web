// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { LogoutButton } from "./LogoutButton";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

it("posts to this host's logout endpoint", () => {
  vi.stubEnv("AUTH_MOCKING", "");

  render(<LogoutButton />, { wrapper: IntlTestProvider });

  const form = screen
    .getByRole("button", { name: "ログアウト" })
    .closest("form");
  expect(form?.method).toBe("post");
  expect(form?.getAttribute("action")).toBe("/auth/logout");
});

it("is absent under AUTH_MOCKING, which has no session to end", () => {
  vi.stubEnv("AUTH_MOCKING", "enabled");
  vi.stubEnv("ROOT_DOMAIN", "");

  const { container } = render(<LogoutButton />, {
    wrapper: IntlTestProvider,
  });

  expect(container.innerHTML).toBe("");
});
