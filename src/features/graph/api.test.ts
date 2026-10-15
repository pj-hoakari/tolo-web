import { describe, expect, it } from "vitest";
import { createOrpcHandlers } from "@/mocks/handlers";
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
        saveGraphError: { message: "invalid graph document", violations },
      }),
    );

    const error = await save("e");

    expect(error).toBeInstanceOf(GraphValidationError);
    expect(error).toMatchObject({
      message: "invalid graph document",
      violations,
    });
  });

  it("違反の詳細がない拒否では違反を持たない", async () => {
    const error = await save("");

    expect(error).toBeInstanceOf(GraphValidationError);
    expect(error).toMatchObject({ violations: [] });
  });
});
