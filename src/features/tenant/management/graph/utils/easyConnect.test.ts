import { describe, expect, it } from "vitest";
import type { GraphNodeType } from "../type";
import {
  EASY_CONNECT_HANDLE_ID,
  isStaleEasyConnection,
  planFromNodeRelease,
} from "./easyConnect";

const IDENTITY_VIEWPORT = { x: 0, y: 0, zoom: 1 };

function node(id: string, x: number, y: number): GraphNodeType {
  return {
    id,
    type: "graph",
    position: { x, y },
    // 寸法未計測時のフォールバック（160x56）で判定される
    data: { labels: { ja: id }, nodeType: "GOAL" },
  };
}

describe("isStaleEasyConnection（モード終了後の easy-connect 接続の破棄判定）", () => {
  const easyConnection = {
    source: "n1",
    sourceHandle: EASY_CONNECT_HANDLE_ID,
    target: "n2",
    targetHandle: null,
  };

  it("モード終了後に届いた easy-connect 由来の接続は破棄対象", () => {
    expect(isStaleEasyConnection(easyConnection, false)).toBe(true);
    expect(
      isStaleEasyConnection(
        {
          ...easyConnection,
          sourceHandle: null,
          targetHandle: EASY_CONNECT_HANDLE_ID,
        },
        false,
      ),
    ).toBe(true);
  });

  it("モードが有効な間の easy-connect 接続は破棄しない", () => {
    expect(isStaleEasyConnection(easyConnection, true)).toBe(false);
  });

  it("通常ハンドル由来の接続はモードに関わらず破棄しない", () => {
    const normal = {
      source: "n1",
      sourceHandle: "connect-right",
      target: "n2",
      targetHandle: "connect-left",
    };
    expect(isStaleEasyConnection(normal, false)).toBe(false);
    expect(isStaleEasyConnection(normal, true)).toBe(false);
  });
});

describe("planFromNodeRelease（始点固定モードのリリース後の挙動）", () => {
  const nodes = [node("src", 0, 0), node("other", 400, 0)];

  it("別ノードの近くでのリリースはその位置からドラッグを再開する", () => {
    const plan = planFromNodeRelease({
      pointer: { x: 420, y: 20 }, // other の内部
      releasePoint: { x: 420, y: 20 },
      viewport: IDENTITY_VIEWPORT,
      nodes,
      sourceNodeId: "src",
    });
    expect(plan).toEqual({ kind: "restart", origin: { x: 420, y: 20 } });
  });

  it("何もない場所でのリリースはモードを終了する", () => {
    const plan = planFromNodeRelease({
      pointer: { x: 200, y: 300 },
      releasePoint: { x: 200, y: 300 },
      viewport: IDENTITY_VIEWPORT,
      nodes,
      sourceNodeId: "src",
    });
    expect(plan).toEqual({ kind: "end" });
  });

  it("始点ノード自身の上でのリリースは再開せずモードを終了する", () => {
    const plan = planFromNodeRelease({
      pointer: { x: 20, y: 20 }, // src の内部
      releasePoint: { x: 20, y: 20 },
      viewport: IDENTITY_VIEWPORT,
      nodes,
      sourceNodeId: "src",
    });
    expect(plan).toEqual({ kind: "end" });
  });

  it("スクリーン座標が取得できないときは再開できないためモードを終了する", () => {
    const plan = planFromNodeRelease({
      pointer: { x: 420, y: 20 },
      releasePoint: null,
      viewport: IDENTITY_VIEWPORT,
      nodes,
      sourceNodeId: "src",
    });
    expect(plan).toEqual({ kind: "end" });
  });

  it("ポインタ位置が無いときはモードを終了する", () => {
    const plan = planFromNodeRelease({
      pointer: null,
      releasePoint: { x: 0, y: 0 },
      viewport: IDENTITY_VIEWPORT,
      nodes,
      sourceNodeId: "src",
    });
    expect(plan).toEqual({ kind: "end" });
  });

  it("ズーム中はスクリーン座標をキャンバス座標へ変換して近傍判定する", () => {
    // viewport zoom 0.5: スクリーン (210,10) → キャンバス (420,20) = other の内部
    const plan = planFromNodeRelease({
      pointer: { x: 210, y: 10 },
      releasePoint: { x: 210, y: 10 },
      viewport: { x: 0, y: 0, zoom: 0.5 },
      nodes,
      sourceNodeId: "src",
    });
    expect(plan).toEqual({ kind: "restart", origin: { x: 210, y: 10 } });
  });
});
