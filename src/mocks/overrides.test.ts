import { describe, expect, it } from "vitest";
import { layoutFixture } from "./fixtures/graphLayout";
import { sampleGuideMapGraph } from "./fixtures/guest";
import { readMockOverrides } from "./overrides";

const storage = (values: Record<string, string> = {}) => ({
  getItem: (key: string) => values[key] ?? null,
});
const name = "issue249-group-movement";
describe("readMockOverrides", () => {
  it("既定では差し替えず、既存のエラー設定も保持する", () => {
    expect(readMockOverrides(storage(), "")).toBeUndefined();
    expect(
      readMockOverrides(
        storage({ "msw:overrides": '{"getGraphError":true}' }),
        "",
      ),
    ).toEqual({ getGraphError: true });
  });
  it("手動再現用URLのグラフをモック設定へ変換する", () => {
    expect(readMockOverrides(storage(), `?layoutFixture=${name}`)).toEqual({
      graph: layoutFixture(name),
    });
  });
  it("案内マップのグラフを名前で指定すると KCG本館のグラフに差し替える", () => {
    expect(readMockOverrides(storage(), "?layoutFixture=guide-map")).toEqual({
      graph: sampleGuideMapGraph,
    });
  });
  it("既存のグラフ差し替えをURLより優先し、他の設定も保持する", () => {
    const overrides = { graph: { nodes: [], edges: [] }, getGraphError: true };
    expect(
      readMockOverrides(
        storage({ "msw:overrides": JSON.stringify(overrides) }),
        `?layoutFixture=${name}`,
      ),
    ).toEqual(overrides);
  });
  it("セッションのフィクスチャ名を読み、エラー設定は消さない", () => {
    expect(
      readMockOverrides(
        storage({
          "tolo-layout-fixture": name,
          "msw:overrides": '{"getGraphError":true}',
        }),
        "",
      ),
    ).toEqual({ graph: layoutFixture(name), getGraphError: true });
  });
  it("未知の名前・不正なJSON・ストレージ利用不可なら既定のモックへ戻る", () => {
    expect(
      readMockOverrides(storage(), "?layoutFixture=unknown"),
    ).toBeUndefined();
    expect(
      readMockOverrides(storage({ "msw:overrides": "{" }), ""),
    ).toBeUndefined();
    expect(
      readMockOverrides(
        {
          getItem: () => {
            throw new Error("denied");
          },
        },
        "",
      ),
    ).toBeUndefined();
  });
});
