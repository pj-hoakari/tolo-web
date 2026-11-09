// 書き出す前のチェック。お客さんに出す前に気づきたいこと（行けない場所・つながっていない階段・名前がない場所など）を探す。
// 文言は画面側で訳すので、ここでは種類と差し込む値だけを返す。

// 行けるかどうかは、お客さんの画面の案内マップと同じ計算（src/features/guest/info/guideMapFloorRoute.ts）で確かめる
import { computeFloorRoute } from "@/features/guest/info/guideMapFloorRoute";
import { toRouteLayout } from "./guideMapIO";
import { isConnector, isTwinOf, type VenueMapDoc } from "./venueMap";

export type CheckIssue = {
  kind:
    | "unreachable"
    | "no-start"
    | "unnamed"
    | "connector-unlinked"
    | "floor-isolated"
    | "overlap"
    | "empty-floor"
    | "no-graph"
    | "floor-no-group"
    | "bad-point"
    | "bad-route"
    | "unlinked-points"
    | "unlinked-routes";
  level: "warn" | "info"; // warn＝案内が正しく出ない／info＝念のため確認
  floorId?: string;
  objectId?: string;
  otherId?: string; // 重なっている相手など、いっしょに選ぶ物
  vars?: Record<string, string | number>;
};

export function checkVenueDoc(
  doc: VenueMapDoc,
  untitled: string,
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const floorName = (id: string) =>
    doc.floors.find((f) => f.id === id)?.name ?? "";
  const order = new Map(doc.floors.map((f, i) => [f.id, i]));
  const g = doc.graph;
  const pointName = (id?: string) =>
    (id && g
      ? Object.values(g.points.find((p) => p.id === id)?.labels ?? {}).find(
          Boolean,
        )
      : undefined) || "";
  // 目的地・現在地に選べる場所（tolo-web と同じ：名前のある場所。グラフのポイントに結び付いていれば、その名前）
  const places = doc.objects.filter(
    (o) =>
      o.kind === "place" &&
      !isConnector(o) &&
      Boolean(o.title?.trim() || pointName(o.graphPointId)),
  );

  // 階ごとの確認（空の階・ほかの階へ移れない階）
  for (const f of doc.floors) {
    const objs = doc.objects.filter((o) => o.floor === f.id);
    if (objs.length === 0)
      issues.push({
        kind: "empty-floor",
        level: "info",
        floorId: f.id,
        vars: { floor: f.name },
      });
    else if (doc.floors.length > 1 && !objs.some(isConnector))
      issues.push({
        kind: "floor-isolated",
        level: "warn",
        floorId: f.id,
        vars: { floor: f.name },
      });
  }
  // つながっていない階段・エレベーター（1つの階にしか無い）
  if (doc.floors.length > 1) {
    const seen = new Set<string>();
    for (const o of doc.objects) {
      if (!isConnector(o) || seen.has(o.link)) continue;
      seen.add(o.link);
      const floors = new Set(
        doc.objects.filter((x) => isTwinOf(x, o.link)).map((x) => x.floor),
      );
      if (floors.size < 2)
        issues.push({
          kind: "connector-unlinked",
          level: "warn",
          floorId: o.floor,
          objectId: o.id,
          vars: { name: o.title || untitled, floor: floorName(o.floor) },
        });
    }
  }
  // 名前が無い目印（ピン）。名前が無いと、お客さんの画面で目的地に選べない
  for (const o of doc.objects)
    if (
      o.kind === "place" &&
      o.shape === "pin" &&
      !isConnector(o) &&
      !o.title?.trim() &&
      !pointName(o.graphPointId)
    )
      issues.push({
        kind: "unnamed",
        level: "info",
        floorId: o.floor,
        objectId: o.id,
        vars: { floor: floorName(o.floor) },
      });

  // tolo-web のグラフとの結び付け（混雑を避けて案内するのに使う）
  if (!g) issues.push({ kind: "no-graph", level: "info" });
  else {
    for (const f of doc.floors)
      if (!f.groupId || !g.groups.some((x) => x.id === f.groupId))
        issues.push({
          kind: "floor-no-group",
          level: "warn",
          floorId: f.id,
          vars: { floor: f.name },
        });
    for (const o of doc.objects) {
      if (o.graphPointId && !g.points.some((p) => p.id === o.graphPointId))
        issues.push({
          kind: "bad-point",
          level: "warn",
          floorId: o.floor,
          objectId: o.id,
          vars: { name: o.title || untitled, id: o.graphPointId },
        });
      if (o.graphRouteId && !g.routes.some((r) => r.id === o.graphRouteId))
        issues.push({
          kind: "bad-route",
          level: "warn",
          floorId: o.floor,
          objectId: o.id,
          vars: { name: o.title || untitled, id: o.graphRouteId },
        });
    }
    // 地図のどれとも結び付いていないポイント・ルート（そこが混んでも避けられない）。数が多いので1件にまとめる
    // 例として出す名前（同じ名前はまとめて、4つまで）
    const sample = (all: string[]) => {
      const names = [...new Set(all)];
      return names.slice(0, 4).join("・") + (names.length > 4 ? "…" : "");
    };
    const unlinkedPoints = g.points.filter(
      (p) =>
        p.nodeType !== "EXTERNAL" &&
        !doc.objects.some((o) => o.graphPointId === p.id),
    );
    if (unlinkedPoints.length)
      issues.push({
        kind: "unlinked-points",
        level: "info",
        vars: {
          n: unlinkedPoints.length,
          names: sample(
            unlinkedPoints.map(
              (p) => Object.values(p.labels).find(Boolean) || p.id,
            ),
          ),
        },
      });
    const unlinkedRoutes = g.routes.filter(
      (r) => !doc.objects.some((o) => o.graphRouteId === r.id),
    );
    if (unlinkedRoutes.length)
      issues.push({
        kind: "unlinked-routes",
        level: "info",
        vars: {
          n: unlinkedRoutes.length,
          names: sample(
            unlinkedRoutes.map(
              (r) => Object.values(r.labels).find(Boolean) || r.id,
            ),
          ),
        },
      });
  }

  // 行けない場所（出発＝現在地から、それぞれの場所まで道案内できるか）
  const start = places.find((p) => p.id === doc.startId) ?? null;
  if (places.length >= 2) {
    if (!start) issues.push({ kind: "no-start", level: "info" });
    const from = start ?? places[0];
    const routeDoc = toRouteLayout(doc);
    for (const p of places) {
      if (p.id === from.id) continue;
      const r = computeFloorRoute(routeDoc, from.id, p.id);
      if (!("steps" in r))
        issues.push({
          kind: "unreachable",
          level: "warn",
          floorId: p.floor,
          objectId: p.id,
          vars: {
            name: p.title || pointName(p.graphPointId) || untitled,
            floor: floorName(p.floor),
            from: from.title || pointName(from.graphPointId) || untitled,
          },
        });
    }
  }

  // 重なっている四角・丸（通路がふさがったり、押しにくくなったりする）
  const shapes = doc.objects.filter(
    (o) => o.kind === "place" && o.shape !== "pin",
  ) as Extract<VenueMapDoc["objects"][number], { kind: "place" }>[];
  let overlaps = 0;
  for (let i = 0; i < shapes.length && overlaps < 20; i++) {
    for (let j = i + 1; j < shapes.length && overlaps < 20; j++) {
      const a = shapes[i];
      const b = shapes[j];
      if (a.floor !== b.floor) continue;
      if (isConnector(a) && isConnector(b) && a.link === b.link) continue;
      const ox =
        Math.min(a.x + a.w / 2, b.x + b.w / 2) -
        Math.max(a.x - a.w / 2, b.x - b.w / 2);
      const oy =
        Math.min(a.y + a.h / 2, b.y + b.h / 2) -
        Math.max(a.y - a.h / 2, b.y - b.h / 2);
      if (ox > 2 && oy > 2) {
        overlaps++;
        issues.push({
          kind: "overlap",
          level: "info",
          floorId: a.floor,
          objectId: a.id,
          otherId: b.id,
          vars: {
            a: a.title || untitled,
            b: b.title || untitled,
            floor: floorName(a.floor),
          },
        });
      }
    }
  }

  // 大事なものから、階の順に並べる
  return issues.sort((x, y) =>
    x.level === y.level
      ? (order.get(x.floorId ?? "") ?? -1) - (order.get(y.floorId ?? "") ?? -1)
      : x.level === "warn"
        ? -1
        : 1,
  );
}
