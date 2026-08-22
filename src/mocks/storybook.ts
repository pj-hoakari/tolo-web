import type { MswApi } from "msw-storybook-addon";
import { createPreviewAnnotations } from "msw-storybook-addon/preview";
// `StoryContext["msw"]` を `SetupWorker` として型付けするモジュール拡張
import type {} from "msw-storybook-addon/types";
import { handlers } from "./handlers";

const { beforeEach: initializeMsw = [] } = createPreviewAnnotations();

/**
 * `/rpc` を叩くストーリーの meta に渡す `beforeEach`
 *
 * 実際にモックが要るストーリーの meta にだけ付ける
 * ストーリー側で `msw.use(...)` で個別に上書き
 */
export const mswBeforeEach = [
  initializeMsw,
  ({ msw }: { msw: MswApi }) => {
    msw.use(...handlers);
  },
].flat();
