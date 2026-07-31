import { describe, expect, it } from "vitest";
import type { AliveEdge } from "@/features/tenant/webrtc/type";
import { buildObservationPointRows } from "./observationPointRows";

function alive(id: string): AliveEdge {
  return { id, lastSeenAt: null };
}

describe("buildObservationPointRows", () => {
  it("接続中の観測点を接続中として並べる", () => {
    const rows = buildObservationPointRows(
      [],
      [alive("cam-a"), alive("cam-b")],
    );

    expect(rows).toEqual([
      { id: "cam-a", online: true },
      { id: "cam-b", online: true },
    ]);
  });

  it("紐づけ済みだが接続が切れた観測点をオフラインとして末尾に残す", () => {
    const rows = buildObservationPointRows(
      ["cam-a", "cam-old"],
      [alive("cam-a"), alive("cam-b")],
    );

    expect(rows).toEqual([
      { id: "cam-a", online: true },
      { id: "cam-b", online: true },
      { id: "cam-old", online: false },
    ]);
  });

  it("接続中の観測点は紐づけ済みでも重複させない", () => {
    const rows = buildObservationPointRows(["cam-a"], [alive("cam-a")]);

    expect(rows).toEqual([{ id: "cam-a", online: true }]);
  });

  it("接続中も紐づけも無ければ空", () => {
    expect(buildObservationPointRows([], [])).toEqual([]);
  });
});
