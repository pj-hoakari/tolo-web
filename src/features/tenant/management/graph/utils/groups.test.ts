import { describe, expect, it } from "vitest";
import type { GraphCanvasNode, GraphNodeType, GroupNodeType } from "../type";
import {
  absolutePositionOf,
  descendantIdsOf,
  dissolveGroups,
  fitGroupsToChildren,
  GROUP_DEFAULT_HEIGHT,
  GROUP_DEFAULT_WIDTH,
  GROUP_FIT_PADDING_BOTTOM,
  GROUP_FIT_PADDING_TOP,
  GROUP_FIT_PADDING_X,
  reparentNode,
  resolveParentGroup,
  sortByNesting,
  withAbsolutePositions,
} from "./groups";

function point(
  id: string,
  x: number,
  y: number,
  parentId?: string,
): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x, y },
    ...(parentId ? { parentId } : {}),
    data: { label: id, nodeType: "GOAL_TRANSIT_MIXED" },
  };
}

function group(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  parentId?: string,
): GroupNodeType {
  return {
    id,
    type: "graphGroup",
    position: { x, y },
    width,
    height,
    ...(parentId ? { parentId } : {}),
    data: { label: id },
  };
}

function byId(nodes: GraphCanvasNode[]) {
  return new Map(nodes.map((n) => [n.id, n]));
}

describe("absolutePositionOf: 親相対座標の絶対化", () => {
  it("ネストしたグループの座標を親をたどって合算する", () => {
    const nodes = [
      group("g1", 100, 100, 800, 600),
      group("g2", 50, 50, 400, 300, "g1"),
      point("p1", 10, 20, "g2"),
    ];
    expect(absolutePositionOf(nodes[2], byId(nodes))).toEqual({
      x: 160,
      y: 170,
    });
  });

  it("トップレベルのノードはそのままの座標", () => {
    const nodes = [point("p1", 30, 40)];
    expect(absolutePositionOf(nodes[0], byId(nodes))).toEqual({ x: 30, y: 40 });
  });

  it("withAbsolutePositions は子の position だけを絶対化する", () => {
    const nodes = [group("g1", 100, 100, 800, 600), point("p1", 10, 20, "g1")];
    const abs = withAbsolutePositions(nodes);
    expect(abs[0].position).toEqual({ x: 100, y: 100 });
    expect(abs[1].position).toEqual({ x: 110, y: 120 });
    // 元の配列は変更しない
    expect(nodes[1].position).toEqual({ x: 10, y: 20 });
  });
});

describe("sortByNesting: 親が子より先という制約の維持", () => {
  it("子が親より前にあっても並べ替える", () => {
    const nodes = [
      point("p1", 0, 0, "g2"),
      group("g2", 0, 0, 400, 300, "g1"),
      group("g1", 0, 0, 800, 600),
    ];
    expect(sortByNesting(nodes).map((n) => n.id)).toEqual(["g1", "g2", "p1"]);
  });
});

describe("resolveParentGroup: ドロップ位置からの所属解決", () => {
  const floors = [
    group("g1f", 0, 300, 800, 400),
    group("g2f", 0, 0, 500, 250),
    group("g_inner", 400, 20, 300, 200, "g1f"), // g1f 内のネストグループ
  ];

  it("グループの内側に中心があるノードはそのグループに属する", () => {
    const nodes = [...floors, point("p", 100, 400)];
    expect(resolveParentGroup("p", nodes)).toBe("g1f");
  });

  it("ネストしているときは最も内側（最小面積）のグループを選ぶ", () => {
    // g_inner の絶対範囲は x:400-700, y:320-520
    const nodes = [...floors, point("p", 450, 350)];
    expect(resolveParentGroup("p", nodes)).toBe("g_inner");
  });

  it("どのグループにも含まれなければ undefined（トップレベル）", () => {
    const nodes = [...floors, point("p", 900, 900)];
    expect(resolveParentGroup("p", nodes)).toBeUndefined();
  });

  it("グループを自分自身や子孫には入れない", () => {
    // g1f の中心は g1f 自身の範囲内だが候補から除外される
    const nodes = [...floors];
    expect(resolveParentGroup("g1f", nodes)).toBeUndefined();
  });
});

describe("reparentNode: 所属変更と相対座標の変換", () => {
  it("グループに入れると position が親相対になる", () => {
    const nodes = [group("g", 100, 200, 400, 300), point("p", 150, 260)];
    const result = reparentNode(nodes, "p", "g");
    const p = result.find((n) => n.id === "p");
    expect(p?.parentId).toBe("g");
    expect(p?.position).toEqual({ x: 50, y: 60 });
  });

  it("グループから出すと position が絶対に戻る", () => {
    const nodes = [group("g", 100, 200, 400, 300), point("p", 50, 60, "g")];
    const result = reparentNode(nodes, "p", undefined);
    const p = result.find((n) => n.id === "p");
    expect(p?.parentId).toBeUndefined();
    expect(p?.position).toEqual({ x: 150, y: 260 });
  });

  it("所属が変わらないときは配列をそのまま返す", () => {
    const nodes = [group("g", 0, 0, 400, 300), point("p", 10, 10, "g")];
    expect(reparentNode(nodes, "p", "g")).toBe(nodes);
  });
});

describe("dissolveGroups: グループ解除", () => {
  it("コンテナを取り除き、子は見た目の位置を保ってトップレベルへ戻る", () => {
    const nodes = [group("g", 100, 200, 400, 300), point("p", 50, 60, "g")];
    const result = dissolveGroups(nodes, ["g"]);
    expect(result.map((n) => n.id)).toEqual(["p"]);
    expect(result[0].parentId).toBeUndefined();
    expect(result[0].position).toEqual({ x: 150, y: 260 });
  });

  it("ネスト内のグループを解除すると子は祖父グループに付け替わる", () => {
    const nodes = [
      group("outer", 100, 100, 800, 600),
      group("inner", 50, 50, 400, 300, "outer"),
      point("p", 10, 20, "inner"),
    ];
    const result = dissolveGroups(nodes, ["inner"]);
    const p = result.find((n) => n.id === "p");
    expect(p?.parentId).toBe("outer");
    expect(p?.position).toEqual({ x: 60, y: 70 });
  });

  it("descendantIdsOf は子孫のみを返す", () => {
    const nodes = [
      group("outer", 0, 0, 800, 600),
      group("inner", 0, 0, 400, 300, "outer"),
      point("p", 0, 0, "inner"),
      point("other", 0, 0),
    ];
    expect(descendantIdsOf(nodes, "outer")).toEqual(new Set(["inner", "p"]));
  });
});

describe("fitGroupsToChildren: 子に合わせた拡縮", () => {
  // ポイントの寸法未計測時のフォールバックは 160x56（sizeOf と同じ想定）
  const POINT_W = 160;
  const POINT_H = 56;

  it("子のバウンディングボックス + 余白にフィットし、子の絶対位置は変えない", () => {
    const nodes = [
      group("g", 0, 0, 1000, 800),
      point("p1", 200, 300, "g"),
      point("p2", 500, 400, "g"),
    ];
    const result = fitGroupsToChildren(nodes);
    const g = result.find((n) => n.id === "g");
    const p1 = result.find((n) => n.id === "p1");

    // 幅 = 子の広がり + 左右余白
    expect(g?.width).toBe(500 + POINT_W - 200 + GROUP_FIT_PADDING_X * 2);
    expect(g?.height).toBe(
      400 + POINT_H - 300 + GROUP_FIT_PADDING_TOP + GROUP_FIT_PADDING_BOTTOM,
    );
    // グループ原点が子の左上 - 余白へ移動する
    expect(g?.position).toEqual({
      x: 200 - GROUP_FIT_PADDING_X,
      y: 300 - GROUP_FIT_PADDING_TOP,
    });
    // 子は相対座標が逆補正され、絶対位置が変わらない
    expect(p1?.position).toEqual({
      x: GROUP_FIT_PADDING_X,
      y: GROUP_FIT_PADDING_TOP,
    });
    const byId = new Map(result.map((n) => [n.id, n]));
    expect(p1 && absolutePositionOf(p1, byId)).toEqual({ x: 200, y: 300 });
  });

  it("手動の最小サイズ（data.minWidth / minHeight）が下限として働く", () => {
    const g = group("g", 0, 0, 100, 100);
    const nodes = [
      { ...g, data: { ...g.data, minWidth: 900, minHeight: 700 } },
      point("p1", 100, 100, "g"),
    ];
    const result = fitGroupsToChildren(nodes);
    const fitted = result.find((n) => n.id === "g");
    expect(fitted?.width).toBe(900);
    expect(fitted?.height).toBe(700);
  });

  it("空のグループは既定サイズを保つ", () => {
    const nodes = [group("g", 10, 20, 999, 999)];
    const result = fitGroupsToChildren(nodes);
    expect(result[0].width).toBe(GROUP_DEFAULT_WIDTH);
    expect(result[0].height).toBe(GROUP_DEFAULT_HEIGHT);
    expect(result[0].position).toEqual({ x: 10, y: 20 });
  });

  it("ネストは内側からフィットし、外側は内側の矩形を含む", () => {
    const nodes = [
      group("outer", 0, 0, 2000, 2000),
      group("inner", 300, 300, 1000, 1000, "outer"),
      point("p1", 100, 100, "inner"),
    ];
    const result = fitGroupsToChildren(nodes);
    const inner = result.find((n) => n.id === "inner");
    const outer = result.find((n) => n.id === "outer");

    // inner は p1 + 余白（下限 GROUP_MIN 未満なら下限）
    expect(inner?.width).toBe(POINT_W + GROUP_FIT_PADDING_X * 2);
    // outer は inner の確定後サイズ + 余白
    expect(outer?.width).toBe((inner?.width ?? 0) + GROUP_FIT_PADDING_X * 2);
    // p1 の絶対位置は不変（元: 0+300+100 = 400）
    const byId = new Map(result.map((n) => [n.id, n]));
    const p1 = result.find((n) => n.id === "p1");
    expect(p1 && absolutePositionOf(p1, byId)).toEqual({ x: 400, y: 400 });
  });

  it("フィット済みなら配列をそのまま返す", () => {
    const once = fitGroupsToChildren([
      group("g", 0, 0, 1000, 800),
      point("p1", 200, 300, "g"),
    ]);
    expect(fitGroupsToChildren(once)).toBe(once);
  });
});
