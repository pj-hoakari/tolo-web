import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * next dev でモック API を有効化するための Service Worker
 * MswBootstrap（NEXT_PUBLIC_API_MOCKING=enabled のとき）から startWorker で起動
 */
export const worker = setupWorker(...handlers);

let startPromise: Promise<unknown> | undefined;

export function startWorker(): Promise<unknown> {
  startPromise ??= worker.start({ onUnhandledRequest: "bypass" });
  return startPromise;
}
