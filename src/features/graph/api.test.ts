import { describe, expect, it } from "vitest";
import { GraphValidationError, validationTarget } from "./api";

describe("validationTarget", () => {
  it.each([
    ['invalid graph document: point "p1" has no route', "node", "p1"],
    ['invalid graph document: external node "x" has no edge', "node", "x"],
    ['invalid graph document: group "g" is nested in a cycle', "node", "g"],
    ['invalid graph document: group "g" has no members', "node", "g"],
    [
      'invalid graph document: node "n" refers to missing group "g"',
      "node",
      "n",
    ],
    [
      'invalid graph document: edge "e" connects two external nodes',
      "edge",
      "e",
    ],
    [
      'invalid graph document: edge "e" connects node "a" to itself',
      "edge",
      "e",
    ],
  ])("%s", (message, type, id) => {
    expect(validationTarget(message)).toEqual({ type, id });
  });

  it("要素を特定できないメッセージでは null を返す", () => {
    expect(
      validationTarget("invalid graph document: node has an empty ID"),
    ).toBeNull();
  });

  it("GraphValidationError はメッセージから対象を持つ", () => {
    const error = new GraphValidationError(
      'invalid graph document: point "p1" has no route',
    );
    expect(error.message).toBe(
      'invalid graph document: point "p1" has no route',
    );
    expect(error.target).toEqual({ type: "node", id: "p1" });
  });
});
