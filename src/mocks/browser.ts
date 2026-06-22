import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * next dev でモック API を有効化するための Service Worker
 * MswBootstrap（NEXT_PUBLIC_API_MOCKING=enabled のとき）から start
 */
export const worker = setupWorker(...handlers);
