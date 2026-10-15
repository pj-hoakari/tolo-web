import { setupWorker } from "msw/browser";
import { createOrpcHandlers } from "./handlers";
import type { MockRouterOverrides } from "./router";

function storedOverrides(): MockRouterOverrides | undefined {
  try {
    const stored = sessionStorage.getItem("msw:overrides");
    return stored ? JSON.parse(stored) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * next dev でモック API を有効化するための Service Worker
 * MswBootstrap（NEXT_PUBLIC_API_MOCKING=enabled のとき）から startWorker で起動
 */
export const worker = setupWorker(...createOrpcHandlers(storedOverrides()));

window.addEventListener("msw:overrides", () => {
  worker.use(...createOrpcHandlers(storedOverrides()));
});

let startPromise: Promise<unknown> | undefined;

export function startWorker(): Promise<unknown> {
  startPromise ??= worker.start({ onUnhandledFrame: "bypass" });
  return startPromise;
}
