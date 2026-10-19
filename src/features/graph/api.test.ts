import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";
import { createOrpcHandlers } from "@/mocks/handlers";
import { MOCK_SERVER_MESSAGE } from "@/mocks/router";
import { server } from "@/mocks/server";
import { fetchGraph, GraphValidationError, saveGraph } from "./api";
import type { GraphViolation } from "./graphDataSchema";
import { PLACEHOLDER_GRAPH } from "./placeholderGraph";

const save = (eventId: string) =>
  saveGraph({ tenantId: "t", eventId }, PLACEHOLDER_GRAPH).catch(
    (e: unknown) => e,
  );

describe("saveGraph", () => {
  it("構造検証の拒否を、エラー詳細の違反を持つ GraphValidationError にする", async () => {
    const violations: GraphViolation[] = [
      {
        kind: "NODE_WITHOUT_ROUTE",
        elementKind: "node",
        elementId: "p1",
        relatedIds: [],
      },
      {
        kind: "SELF_LOOP_EDGE",
        elementKind: "edge",
        elementId: "e1",
        relatedIds: ["a"],
      },
    ];
    server.use(
      ...createOrpcHandlers({
        saveGraphError: { code: "BAD_REQUEST", violations },
      }),
    );

    const error = await save("e");

    expect(error).toBeInstanceOf(GraphValidationError);
    expect(error).toMatchObject({ violations });
    expect((error as Error).message).not.toContain(MOCK_SERVER_MESSAGE);
  });

  it("違反の詳細がない拒否は GraphValidationError にせずそのまま投げる", async () => {
    const error = await save("");

    expect(error).not.toBeInstanceOf(GraphValidationError);
    expect(error).toBeInstanceOf(ORPCError);
    expect(error).toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("fetchGraph", () => {
  const key = { tenantId: "t", eventId: "test" };
  it("既定のサンプルをRPC経由で取得する", async () => {
    expect(await fetchGraph(key)).toEqual(PLACEHOLDER_GRAPH);
  });
  it("MSWの差し替えグラフを取得し、呼び出し間で編集状態を共有しない", async () => {
    const graph = { nodes: [PLACEHOLDER_GRAPH.nodes[0]], edges: [] };
    server.use(...createOrpcHandlers({ graph }));
    const first = await fetchGraph(key);
    expect(first).toEqual(graph);
    first.nodes.length = 0;
    expect(await fetchGraph(key)).toEqual(graph);
  });
  it("グラフ差し替え中も取得エラーをそのまま返す", async () => {
    server.use(
      ...createOrpcHandlers({
        graph: { nodes: [], edges: [] },
        getGraphError: true,
      }),
    );
    await expect(fetchGraph(key)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    });
  });
});
