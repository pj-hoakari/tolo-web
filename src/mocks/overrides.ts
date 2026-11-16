import type { SavedGuideMap } from "@/server/router";
import { LAYOUT_FIXTURE_KEY, layoutFixture } from "./fixtures/graphLayout";
import type { MockRouterOverrides } from "./router";

/**
 * 開発サーバーのモックで、案内マップエディタが保存した地図を残す場所。
 * ページを開き直しても、別のタブのゲスト画面でも同じ地図を出すため、localStorage に置く（消すと KCG本館の見本に戻る）
 */
export const SAVED_GUIDE_MAP_KEY = "msw:saved-guide-map";

export function readSavedGuideMap(
  storage: Pick<Storage, "getItem">,
): SavedGuideMap | undefined {
  try {
    const stored = storage.getItem(SAVED_GUIDE_MAP_KEY);
    return stored ? (JSON.parse(stored) as SavedGuideMap) : undefined;
  } catch {
    return undefined;
  }
}

export function writeSavedGuideMap(
  storage: Pick<Storage, "setItem">,
  saved: SavedGuideMap,
) {
  try {
    storage.setItem(SAVED_GUIDE_MAP_KEY, JSON.stringify(saved));
  } catch {
    // 残せなくても、開いている間は保存した地図を返す
  }
}

/** モック専用。既存の差し替え設定を優先し、手動再現用URLも同じRPC経由で扱う。 */
export function readMockOverrides(
  storage: Pick<Storage, "getItem">,
  search: string,
): MockRouterOverrides | undefined {
  try {
    const stored = storage.getItem("msw:overrides");
    const overrides: MockRouterOverrides | undefined = stored
      ? JSON.parse(stored)
      : undefined;
    if (overrides?.graph !== undefined) return overrides;
    const name =
      new URLSearchParams(search).get("layoutFixture") ??
      storage.getItem(LAYOUT_FIXTURE_KEY);
    const graph = name ? layoutFixture(name) : undefined;
    return graph ? { ...overrides, graph } : overrides;
  } catch {
    return undefined;
  }
}
