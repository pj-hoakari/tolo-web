import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

// Vitest unit プロジェクトのグローバル setup
// 全テスト前に MSW server を起動し、各テスト後に handler をリセット、全テスト後に停止
// 既定では /rpc 以外のリクエストは bypass
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
