import { setupWorker } from "msw/browser";
import type { SavedGuideMap } from "@/server/router";
import { createOrpcHandlers } from "./handlers";
import {
  readMockOverrides,
  readSavedGuideMap,
  writeSavedGuideMap,
} from "./overrides";

// 案内マップエディタで保存した地図は localStorage に残し、開き直しても・ゲスト画面でも同じ地図を返す
const storedOverrides = () => {
  const overrides = readMockOverrides(sessionStorage, window.location.search);
  return {
    savedGuideMap: readSavedGuideMap(localStorage),
    ...overrides,
    onGuideMapSaved: (saved: SavedGuideMap) =>
      writeSavedGuideMap(localStorage, saved),
  };
};

/**
 * next dev でモック API を有効化するための Service Worker
 * instrumentation-client（NEXT_PUBLIC_API_MOCKING=enabled のとき）から startWorker で起動
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
