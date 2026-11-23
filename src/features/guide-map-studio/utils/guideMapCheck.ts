// 書き出す前のチェック。お客さんに出す前に気づきたいこと（行けない場所・つながっていない階段・名前がない場所など）を探す。
// 文言は画面側で訳すので、ここでは種類と差し込む値だけを返す。

// 行けるかどうかは、お客さんの画面の案内マップと同じ計算（src/features/guest/info/guideMapFloorRoute.ts）で確かめる
import { computeFloorRoute } from "@/features/guest/info/guideMapFloorRoute";
import type { GuideMapDoc } from "../type";
import {
  isConnector,
  isTwinOf,
  markBoxOf,
  needsGraphPoint,
} from "./guideMapDoc";
import { toRouteLayout } from "./guideMapIO";

// 気になる所の重さ（3 段階）。
//  - error：お客さんの画面で案内が正しく出ない（直してください）
//  - warn：案内は出るが、選べない・混雑を避けられないなどの困りごとがある（確認してください）
//  - info：使い方によっては問題ない（念のため）
export type CheckLevel = "error" | "warn" | "info";
export const CHECK_LEVELS: readonly CheckLevel[] = ["error", "warn", "info"];

export type CheckIssue = {
  kind:
    | "unreachable"
    | "no-start"
    | "unnamed"
    | "connector-unlinked"
    | "connector-no-point"
    | "floor-isolated"
    | "overlap"
    | "empty-floor"
    | "no-graph"
    | "floor-no-group"
    | "bad-point"
    | "bad-route"
    | "unlinked-points"
    | "unlinked-routes";
  level: CheckLevel;
  floorId?: string;
  objectId?: string;
  otherId?: string; // 重なっている相手など、いっしょに選ぶ物
  vars?: Record<string, string | number>;
};

export function checkGuideMapDoc(
  doc: GuideMapDoc,
  untitled: string,
  /** 範囲の呼び名（範囲には名前を付けないので、項目ではこの呼び名で示す） */
  areaName: string = untitled,
): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const nameOf = (o: GuideMapDoc["objects"][number]) =>
    o.kind === "area" ? areaName : o.title || untitled;
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
        level: "error",
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
          level: "error",
          floorId: o.floor,
          objectId: o.id,
          vars: { name: nameOf(o), floor: floorName(o.floor) },
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
        level: "warn",
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
          level: "error",
          floorId: f.id,
          vars: { floor: f.name },
        });
    for (const o of doc.objects) {
      // 誘導グラフに要る所（階段・エレベーターなど）が結び付いていないと、そこが混んでも避けられない。部屋は結び付けなくてよい
      // 手で結び付きを外した物（""）は、わざとなので知らせない
      if (needsGraphPoint(o) && o.graphPointId === undefined)
        issues.push({
          kind: "connector-no-point",
          level: "warn",
          floorId: o.floor,
          objectId: o.id,
          vars: { name: nameOf(o), floor: floorName(o.floor) },
        });
      if (o.graphPointId && !g.points.some((p) => p.id === o.graphPointId))
        issues.push({
          kind: "bad-point",
          level: "error",
          floorId: o.floor,
          objectId: o.id,
          vars: { name: nameOf(o), id: o.graphPointId },
        });
      if (o.graphRouteId && !g.routes.some((r) => r.id === o.graphRouteId))
        issues.push({
          kind: "bad-route",
          level: "error",
          floorId: o.floor,
          objectId: o.id,
          vars: { name: nameOf(o), id: o.graphRouteId },
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
    if (!start) issues.push({ kind: "no-start", level: "warn" });
    const from = start ?? places[0];
    const routeDoc = toRouteLayout(doc);
    for (const p of places) {
      if (p.id === from.id) continue;
      const r = computeFloorRoute(routeDoc, from.id, p.id);
      if (!("steps" in r))
        issues.push({
          kind: "unreachable",
          level: "error",
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

  // 重なっている物（部屋・区画・丸い区画・階段・エレベーター）。通路がふさがったり、押しにくくなったりする。
  // 意図して重ねていることもあるので「確認してください」にとどめ、チェックの「OK」で消せるようにする。
  // 部屋の中の目印（ピン）は部屋に印を付ける普通の使い方なので数えない。範囲（区域・建物の外枠）も中に部屋を置くものなので数えない
  const solids = doc.objects.flatMap((o) => {
    if (o.kind !== "place") return [];
    if (o.shape !== "pin")
      return [
        {
          o,
          shape: {
            round: o.shape === "circle",
            cx: o.x,
            cy: o.y,
            rx: o.w / 2,
            ry: o.h / 2,
          },
        },
      ];
    if (!isConnector(o)) return [];
    const mb = markBoxOf(o);
    return [
      {
        o,
        shape: { round: false, cx: o.x, cy: o.y, rx: mb.w / 2, ry: mb.h / 2 },
      },
    ];
  });
  let overlaps = 0;
  for (let i = 0; i < solids.length && overlaps < 20; i++) {
    for (let j = i + 1; j < solids.length && overlaps < 20; j++) {
      const a = solids[i].o;
      const b = solids[j].o;
      if (a.floor !== b.floor) continue;
      if (isConnector(a) && isConnector(b) && a.link === b.link) continue;
      if (!shapesOverlap(solids[i].shape, solids[j].shape)) continue;
      overlaps++;
      issues.push({
        kind: "overlap",
        level: "warn",
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

  // 大事なものから、階の順に並べる
  return issues.sort((x, y) =>
    x.level === y.level
      ? (order.get(x.floorId ?? "") ?? -1) - (order.get(y.floorId ?? "") ?? -1)
      : CHECK_LEVELS.indexOf(x.level) - CHECK_LEVELS.indexOf(y.level),
  );
}

/**
 * 項目を見分ける鍵。「OK」で消した項目を覚えておくのに使う。
 * 名前などの差し込む値は入れない（名前を直しても、同じ物の同じ問題なら消したままにする）
 */
export const checkIssueKey = (is: CheckIssue) =>
  [is.kind, is.floorId ?? "", is.objectId ?? "", is.otherId ?? ""].join(":");

// --- 重なりの判定 ---
// 四角は真ん中（cx, cy）と、半分の幅・高さ（rx, ry）で表す。丸（楕円）は真ん中と半径
export type OverlapShape = {
  round: boolean;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

// 縁がふれているだけ（となり合わせに並べた部屋）は重なりとしない
const TOUCH = 2;

/** 2 つの形が重なっているか（縁がふれている程度は除く） */
export function shapesOverlap(a: OverlapShape, b: OverlapShape): boolean {
  // まず外側の四角どうしで、離れているものを外す
  if (
    Math.abs(a.cx - b.cx) >= a.rx + b.rx - TOUCH ||
    Math.abs(a.cy - b.cy) >= a.ry + b.ry - TOUCH
  )
    return false;
  if (!a.round && !b.round) return true;
  if (a.round && !b.round) return ellipseHitsRect(a, b);
  if (!a.round && b.round) return ellipseHitsRect(b, a);
  // 丸どうし：片方の真ん中がもう片方に入っているか、縁の点が入っているか
  return insideEllipse(b, a.cx, a.cy) || ellipseEdgeHits(a, b);
}

// 点が楕円の中か（縁から TOUCH の分は外とみなす）
const insideEllipse = (e: OverlapShape, x: number, y: number) => {
  const rx = Math.max(1, e.rx - TOUCH);
  const ry = Math.max(1, e.ry - TOUCH);
  return ((x - e.cx) / rx) ** 2 + ((y - e.cy) / ry) ** 2 < 1;
};

// 楕円と四角：四角の中で、楕円の真ん中にいちばん近い点が楕円の中か
const ellipseHitsRect = (e: OverlapShape, r: OverlapShape) => {
  const x = Math.min(r.cx + r.rx, Math.max(r.cx - r.rx, e.cx));
  const y = Math.min(r.cy + r.ry, Math.max(r.cy - r.ry, e.cy));
  return insideEllipse(e, x, y);
};

// 楕円どうし：a の縁を 48 点に分けて、b に入る点があるか
const ellipseEdgeHits = (a: OverlapShape, b: OverlapShape) => {
  for (let k = 0; k < 48; k++) {
    const th = (k / 48) * Math.PI * 2;
    if (
      insideEllipse(b, a.cx + a.rx * Math.cos(th), a.cy + a.ry * Math.sin(th))
    )
      return true;
  }
  return false;
};

// --- 重さの色・数・OK にした項目 ---

/** 重さごとの色（studio-theme.css）。チェックの一覧・地図の印・上の帯の数に使う */
export const CHECK_LEVEL_COLOR: Record<CheckLevel, string> = {
  error: "var(--studio-check-error)",
  warn: "var(--studio-check-warn)",
  info: "var(--studio-check-info)",
};
/** 重さの色の上に置く文字の色（黄色の上は白い字が読みにくいので、黒に近い字にする） */
export const CHECK_LEVEL_ON_COLOR: Record<CheckLevel, string> = {
  error: "#fff",
  warn: "#1c1917",
  info: "#fff",
};

/**
 * 見てほしい項目（「直してください」「確認してください」で、OK にしていないもの）の数と、その中でいちばん重いもの。
 * 上の帯のチェックの数と、書き出す前に一覧を出すかどうかに使う
 */
export function needsLookOf(
  doc: Pick<GuideMapDoc, "checkIgnored">,
  issues: CheckIssue[],
): { n: number; level: CheckLevel | null } {
  const ignored = new Set(doc.checkIgnored ?? []);
  const look = issues.filter(
    (is) => is.level !== "info" && !ignored.has(checkIssueKey(is)),
  );
  return {
    n: look.length,
    level: look.some((is) => is.level === "error")
      ? "error"
      : look.length
        ? "warn"
        : null,
  };
}

/** 項目を「OK」にした（on）／一覧に戻した地図。OK にした項目は地図に覚えておく（書き出しには入れない） */
export function withCheckIgnored(
  doc: GuideMapDoc,
  is: CheckIssue,
  on: boolean,
): GuideMapDoc {
  const keys = new Set(doc.checkIgnored ?? []);
  if (on) keys.add(checkIssueKey(is));
  else keys.delete(checkIssueKey(is));
  return { ...doc, checkIgnored: keys.size ? [...keys] : undefined };
}
