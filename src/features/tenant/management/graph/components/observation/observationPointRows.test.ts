import { describe, expect, it } from "vitest";
import type { ObservationPoint } from "@/server/router";
import { buildObservationPointRows } from "./observationPointRows";

function point(observationPointId: string, name = ""): ObservationPoint {
  return { observationPointId, name };
}

describe("buildObservationPointRows", () => {
  it("稼働中の観測点を観測点 ID と名前で稼働中として並べる", () => {
    const rows = buildObservationPointRows(
      [],
      [point("op-a", "入口"), point("op-b")],
    );

    expect(rows).toEqual([
      { id: "op-a", name: "入口", online: true },
      { id: "op-b", name: "", online: true },
    ]);
  });

  it("紐づけ済みだが稼働していない観測点をオフラインとして末尾に残す", () => {
    const rows = buildObservationPointRows(
      ["op-a", "op-old"],
      [point("op-a"), point("op-b")],
    );

    expect(rows).toEqual([
      { id: "op-a", name: "", online: true },
      { id: "op-b", name: "", online: true },
      { id: "op-old", online: false },
    ]);
  });

  it("稼働中の観測点は紐づけ済みでも重複させない", () => {
    const rows = buildObservationPointRows(["op-a"], [point("op-a")]);

    expect(rows).toEqual([{ id: "op-a", name: "", online: true }]);
  });

  it("稼働中も紐づけも無ければ空", () => {
    expect(buildObservationPointRows([], [])).toEqual([]);
  });
});
