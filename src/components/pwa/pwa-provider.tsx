"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  getInstallPlatform,
  getRestorePath,
  type InstallPlatform,
  isStandalone,
  LAST_PAGE_KEY,
} from "./pwa-utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<unknown>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallStatus =
  | "idle"
  | "installing"
  | "accepted"
  | "dismissed"
  | "error";

type InstallState = {
  ready: boolean;
  installed: boolean;
  secure: boolean;
  platform: InstallPlatform;
  canPrompt: boolean;
  status: InstallStatus;
  install: () => Promise<void>;
};

const PwaContext = createContext<InstallState | null>(null);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const promptPathRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [secure, setSecure] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("other");
  const [canPrompt, setCanPrompt] = useState(false);
  const [status, setStatus] = useState<InstallStatus>("idle");

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const fullscreen = window.matchMedia("(display-mode: fullscreen)");
    const updateDisplayMode = () => setInstalled(isStandalone());
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as BeforeInstallPromptEvent;
      promptPathRef.current = window.location.pathname;
      setCanPrompt(true);
      setStatus("idle");
    };
    const handleInstalled = () => {
      promptRef.current = null;
      setCanPrompt(false);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    displayMode.addEventListener("change", updateDisplayMode);
    fullscreen.addEventListener("change", updateDisplayMode);
    updateDisplayMode();
    setSecure(window.isSecureContext);
    setPlatform(
      getInstallPlatform(navigator.userAgent, navigator.maxTouchPoints),
    );
    setReady(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      displayMode.removeEventListener("change", updateDisplayMode);
      fullscreen.removeEventListener("change", updateDisplayMode);
    };
  }, []);

  useEffect(() => {
    // Read the public browser URL after hydration because tenant proxy rewrites
    // use an internal /tenant/... pathname on the server.
    if (!pathname) return;
    const currentPath = window.location.pathname;
    // A prompt retained on another page can contain that page's launch URL.
    // After navigation, use the current page's browser-menu install guidance.
    if (promptRef.current && promptPathRef.current !== currentPath) {
      promptRef.current = null;
      setCanPrompt(false);
      setStatus("idle");
    }
    try {
      if (isStandalone() && currentPath === "/") {
        const savedPath = getRestorePath(localStorage.getItem(LAST_PAGE_KEY));
        if (savedPath) router.replace(savedPath);
      } else {
        const publicPath = getRestorePath(currentPath);
        if (publicPath) localStorage.setItem(LAST_PAGE_KEY, publicPath);
      }
    } catch {
      // Storage may be disabled; installation and normal navigation still work.
    }
  }, [pathname, router]);

  const install = async () => {
    const event = promptRef.current;
    if (!event) return;
    // Each browser event may only be prompted once, including cancellation.
    promptRef.current = null;
    setCanPrompt(false);
    setStatus("installing");
    try {
      await event.prompt();
      const choice = await event.userChoice;
      setStatus(choice.outcome);
    } catch {
      setStatus("error");
    }
  };

  return (
    <PwaContext.Provider
      value={{ ready, installed, secure, platform, canPrompt, status, install }}
    >
      {children}
    </PwaContext.Provider>
  );
}

export function usePwaInstall() {
  const context = useContext(PwaContext);
  if (!context) throw new Error("PwaInstall requires PwaProvider");
  return context;
}
