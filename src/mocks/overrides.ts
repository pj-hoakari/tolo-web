import { LAYOUT_FIXTURE_KEY, layoutFixture } from "./fixtures/graphLayout";
import type { MockRouterOverrides } from "./router";

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
