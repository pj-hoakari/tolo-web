import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";
import { createOrpcHandlers } from "@/mocks/handlers";
import { MOCK_SERVER_MESSAGE } from "@/mocks/router";
import { server } from "@/mocks/server";
import { GraphValidationError, saveGraph } from "./api";
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
