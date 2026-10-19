import { setupWorker } from "msw/browser";
import { createOrpcHandlers } from "./handlers";
import { readMockOverrides } from "./overrides";

const storedOverrides = () =>
  readMockOverrides(sessionStorage, window.location.search);

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
