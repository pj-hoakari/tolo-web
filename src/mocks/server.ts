import { setupServer } from "msw/node";
import { handlers } from "./handlers";

/**
 * node 環境（Vitest unit プロジェクト）でモック API を使うための server
 * vitest.config.ts の unit プロジェクトの setupFiles（src/mocks/setup.ts）から
 * listen / resetHandlers / close を呼び出してグローバルに有効化
 * 個別テストで一時的に handler を差し替えるときは server.use(...) を使う
 */
export const server = setupServer(...handlers);
