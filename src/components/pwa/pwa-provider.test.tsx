// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import messages from "../../../messages/ja.json";
import { PwaInstall } from "./pwa-install";
import { PwaProvider, usePwaInstall } from "./pwa-provider";
import { LAST_PAGE_KEY } from "./pwa-utils";

const navigation = vi.hoisted(() => ({
  pathname: "/",
  router: { replace: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => navigation.router,
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <IntlTestProvider>
      <PwaProvider>{children}</PwaProvider>
    </IntlTestProvider>
  );
}

function createMediaQuery(query: string) {
  const target = new EventTarget();
  return Object.assign(target, {
    media: query,
    matches: false,
    onchange: null,
    addEventListener: vi.fn(target.addEventListener.bind(target)),
    removeEventListener: vi.fn(target.removeEventListener.bind(target)),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  });
}

const mediaQueries = new Map<string, ReturnType<typeof createMediaQuery>>();
const originalDescriptors = new Map<
  object,
  Map<string, PropertyDescriptor | undefined>
>();

function setBrowserProperty(target: object, key: string, value: unknown) {
  let descriptors = originalDescriptors.get(target);
  if (!descriptors) {
    descriptors = new Map();
    originalDescriptors.set(target, descriptors);
  }
  if (!descriptors.has(key))
    descriptors.set(key, Object.getOwnPropertyDescriptor(target, key));
  Object.defineProperty(target, key, { configurable: true, value });
}

function mediaQuery(query: string) {
  let result = mediaQueries.get(query);
  if (!result) {
    result = createMediaQuery(query);
    mediaQueries.set(query, result);
  }
  return result;
}

function emitInstallPrompt(
  outcome: "accepted" | "dismissed" = "accepted",
  prompt = vi.fn().mockResolvedValue(undefined),
) {
  const event = Object.assign(
    new Event("beforeinstallprompt", { cancelable: true }),
    {
      prompt,
      userChoice: Promise.resolve({ outcome }),
    },
  );
  fireEvent(window, event);
  return event;
}

function moveTo(path: string, internalPath = path) {
  window.history.replaceState(null, "", path);
  navigation.pathname = internalPath;
}

beforeEach(() => {
  mediaQueries.clear();
  window.localStorage.clear();
  navigation.router.replace.mockReset();
  moveTo("/");
  setBrowserProperty(
    window,
    "matchMedia",
    vi.fn((query: string) => mediaQuery(query)),
  );
  setBrowserProperty(window, "isSecureContext", true);
  setBrowserProperty(navigator, "userAgent", "Mozilla/5.0 Chrome/130.0.0.0");
  setBrowserProperty(navigator, "maxTouchPoints", 0);
  setBrowserProperty(navigator, "standalone", false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const [target, descriptors] of originalDescriptors) {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
  }
  originalDescriptors.clear();
  window.localStorage.clear();
});

describe("PwaProvider", () => {
  it.each(["accepted", "dismissed"] as const)(
    "retains the browser event and prompts once when the choice is %s",
    async (outcome) => {
      const { result } = renderHook(usePwaInstall, { wrapper: Wrapper });
      expect(result.current.canPrompt).toBe(false);
      const event = emitInstallPrompt(outcome);
      expect(event.defaultPrevented).toBe(true);
      expect(result.current.canPrompt).toBe(true);
      expect(event.prompt).not.toHaveBeenCalled();

      await act(async () => {
        await Promise.all([result.current.install(), result.current.install()]);
      });

      expect(event.prompt).toHaveBeenCalledTimes(1);
      expect(result.current.canPrompt).toBe(false);
      expect(result.current.status).toBe(outcome);
      expect(result.current.installed).toBe(false);
    },
  );

  it("reports a failed native prompt and permits a fresh event", async () => {
    const { result } = renderHook(usePwaInstall, { wrapper: Wrapper });
    const first = emitInstallPrompt(
      "accepted",
      vi.fn().mockRejectedValue(new Error("unavailable")),
    );
    await act(async () => result.current.install());
    expect(result.current.status).toBe("error");
    expect(result.current.canPrompt).toBe(false);
    await act(async () => result.current.install());
    expect(first.prompt).toHaveBeenCalledTimes(1);

    const second = emitInstallPrompt();
    expect(result.current.status).toBe("idle");
    await act(async () => result.current.install());
    expect(second.prompt).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("accepted");
  });

  it("shows installing until the browser choice settles", async () => {
    const { result } = renderHook(usePwaInstall, { wrapper: Wrapper });
    const choice = Promise.withResolvers<{ outcome: "accepted" }>();
    const event = Object.assign(
      new Event("beforeinstallprompt", { cancelable: true }),
      {
        prompt: vi.fn().mockResolvedValue(undefined),
        userChoice: choice.promise,
      },
    );
    fireEvent(window, event);
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.install();
    });
    expect(result.current.status).toBe("installing");
    expect(result.current.canPrompt).toBe(false);
    await act(async () => {
      choice.resolve({ outcome: "accepted" });
      await pending;
    });
    expect(result.current.status).toBe("accepted");
  });

  it("discards the pending prompt after client navigation so installation uses the current page", async () => {
    moveTo("/event/test/management");
    const { result, rerender } = renderHook(usePwaInstall, {
      wrapper: Wrapper,
    });
    const event = emitInstallPrompt();

    moveTo("/event/test/management/graph/edit");
    rerender();
    expect(result.current.canPrompt).toBe(false);
    await act(async () => result.current.install());
    expect(event.prompt).not.toHaveBeenCalled();
    const currentPageEvent = emitInstallPrompt();
    await act(async () => result.current.install());
    expect(currentPageEvent.prompt).toHaveBeenCalledTimes(1);
  });

  it("clears the event and hides installation after appinstalled", async () => {
    render(<PwaInstall />, { wrapper: Wrapper });
    const event = emitInstallPrompt();
    expect(
      screen.getByRole("button", { name: messages.PwaInstall.button }),
    ).toBeTruthy();

    fireEvent(window, new Event("appinstalled"));

    expect(
      screen.queryByRole("button", { name: messages.PwaInstall.button }),
    ).toBeNull();
    expect(event.prompt).not.toHaveBeenCalled();
  });

  it.each(["standalone", "fullscreen", "ios"])(
    "hides installation when launched in %s mode",
    (mode) => {
      if (mode === "ios") setBrowserProperty(navigator, "standalone", true);
      else mediaQuery(`(display-mode: ${mode})`).matches = true;
      render(<PwaInstall />, { wrapper: Wrapper });
      expect(
        screen.queryByRole("button", { name: messages.PwaInstall.button }),
      ).toBeNull();
    },
  );

  it("updates installed state when the display mode changes", () => {
    const { result } = renderHook(usePwaInstall, { wrapper: Wrapper });
    const standalone = mediaQuery("(display-mode: standalone)");
    act(() => {
      standalone.matches = true;
      standalone.dispatchEvent(new Event("change"));
    });
    expect(result.current.installed).toBe(true);
    act(() => {
      standalone.matches = false;
      standalone.dispatchEvent(new Event("change"));
    });
    expect(result.current.installed).toBe(false);
  });

  it("removes browser and media listeners on unmount", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(usePwaInstall, { wrapper: Wrapper });
    unmount();
    for (const name of ["beforeinstallprompt", "appinstalled"]) {
      const registration = add.mock.calls.find(([type]) => type === name);
      expect(registration).toBeDefined();
      expect(remove).toHaveBeenCalledWith(name, registration?.[1]);
    }
    for (const mode of ["standalone", "fullscreen"]) {
      const query = mediaQuery(`(display-mode: ${mode})`);
      expect(query.removeEventListener).toHaveBeenCalledWith(
        "change",
        query.addEventListener.mock.calls[0][1],
      );
    }
  });

  it("saves the public path instead of the tenant rewrite", () => {
    moveTo("/event/test/guest", "/tenant/test/event/test/guest");
    renderHook(usePwaInstall, { wrapper: Wrapper });
    expect(localStorage.getItem(LAST_PAGE_KEY)).toBe("/event/test/guest");
  });

  it("restores the last public page when a standalone app opens at root", () => {
    localStorage.setItem(LAST_PAGE_KEY, "/event/test/management");
    mediaQuery("(display-mode: standalone)").matches = true;
    renderHook(usePwaInstall, { wrapper: Wrapper });
    expect(navigation.router.replace).toHaveBeenCalledWith(
      "/event/test/management",
    );
  });

  it.each([
    "https://example.com/",
    "//example.com/",
    "/.//example.com/",
    "/tenant/other/event/test/guest",
  ])("does not navigate to an unsafe stored path %s", (path) => {
    localStorage.setItem(LAST_PAGE_KEY, path);
    mediaQuery("(display-mode: standalone)").matches = true;
    renderHook(usePwaInstall, { wrapper: Wrapper });
    expect(navigation.router.replace).not.toHaveBeenCalled();
  });

  it.each(["browser", "standalone"])(
    "continues when storage is disabled in %s mode",
    (mode) => {
      if (mode === "standalone")
        mediaQuery("(display-mode: standalone)").matches = true;
      else moveTo("/event/test/guest");
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("disabled", "SecurityError");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("disabled", "SecurityError");
      });
      const { result } = renderHook(usePwaInstall, { wrapper: Wrapper });
      expect(result.current.ready).toBe(true);
      expect(navigation.router.replace).not.toHaveBeenCalled();
    },
  );
});

describe("PwaInstall guidance", () => {
  it("expands the iOS instructions for an iPad with a desktop user agent", async () => {
    setBrowserProperty(
      navigator,
      "userAgent",
      "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15",
    );
    setBrowserProperty(navigator, "maxTouchPoints", 5);
    render(<PwaInstall />, { wrapper: Wrapper });
    fireEvent.click(
      screen.getByRole("button", { name: messages.PwaInstall.button }),
    );
    const ios = await screen.findByRole("button", {
      name: messages.PwaInstall.iosTitle,
    });
    expect(ios.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(messages.PwaInstall.iosSteps.second)).toBeTruthy();
  });

  it("opens fallback steps and closes the guide", async () => {
    render(<PwaInstall />, { wrapper: Wrapper });
    fireEvent.click(
      screen.getByRole("button", { name: messages.PwaInstall.button }),
    );
    const android = await screen.findByRole("button", {
      name: messages.PwaInstall.androidTitle,
    });
    fireEvent.click(android);
    expect(android.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByText(messages.PwaInstall.androidSteps.second),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: messages.PwaInstall.nativeInstall }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: messages.PwaInstall.close }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens and closes the guide using the keyboard", async () => {
    render(<PwaInstall />, { wrapper: Wrapper });
    const trigger = screen.getByRole("button", {
      name: messages.PwaInstall.button,
    });
    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: "Enter", code: "Enter" });
    fireEvent.keyUp(trigger, { key: "Enter", code: "Enter" });
    const dialog = await screen.findByRole("dialog", {
      name: messages.PwaInstall.title,
    });
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    fireEvent.keyUp(dialog, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows HTTPS instructions instead of native or manual install actions in an insecure context", async () => {
    setBrowserProperty(window, "isSecureContext", false);
    render(<PwaInstall />, { wrapper: Wrapper });
    emitInstallPrompt();
    fireEvent.click(
      screen.getByRole("button", { name: messages.PwaInstall.button }),
    );
    expect(await screen.findByRole("status")).toHaveProperty(
      "textContent",
      messages.PwaInstall.insecure,
    );
    expect(
      screen.queryByRole("button", { name: messages.PwaInstall.nativeInstall }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: messages.PwaInstall.iosTitle }),
    ).toBeNull();
  });
});
