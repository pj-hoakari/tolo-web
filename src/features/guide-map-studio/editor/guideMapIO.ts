// スタジオの地図（venueMap.ts）と、お客さんの画面の案内マップの形とのやりとり。
//  - 書き出し：案内マップ（src/features/guest/info/guideMapLayout.ts の LocalizedGuideMapLayout）の形にする
//  - 読み込み：案内マップの形・スタジオの形（floors を持つ形）・グラフ（nodes / edges）のどれでも読めるようにする
// 案内マップの形はゲスト画面側で決まっているので、スタジオの側で変換して合わせる。

import type {
  GuideMapLayout,
  LocalizedGuideMapLayout,
  LocalizedMapObject,
  MapObject as RouteMapObject,
} from "@/features/guest/info/guideMapLayout";
import type { LocalizedLabel } from "@/features/tenant/management/graph/type";
import { resolveLabel } from "@/features/tenant/management/graph/utils/labels";
import {
  DEFAULT_COLOR,
  genId,
  type MapObject,
  normalizeDoc,
  type VenueGraph,
  type VenueMapDoc,
} from "./venueMap";

const loc = (text: string | undefined): LocalizedLabel | undefined =>
  text?.trim() ? { ja: text } : undefined;
const text = (l: unknown): string | undefined => {
  if (typeof l === "string") return l || undefined;
  if (!l || typeof l !== "object") return undefined;
  const m = l as LocalizedLabel;
  return m.ja || Object.values(m).find(Boolean) || undefined;
};
/** 名前（言語ごと）から表示する名前を選ぶ（グラフ編集と同じ決め方：その言語 → アプリの言語の順 → 残り） */
export const labelOf = (labels: LocalizedLabel | undefined, lang = "ja") =>
  labels ? resolveLabel(labels, lang).text : "";

/** 地図を案内マップの形にする。階はグラフのグループ ID（結び付けていなければスタジオの階の ID）で書く */
export function toGuideMapLayout(doc: VenueMapDoc): LocalizedGuideMapLayout {
  const groupOf = new Map(doc.floors.map((f) => [f.id, f.groupId || f.id]));
  return {
    version: 1,
    groups: doc.floors.map((f) => ({
      groupId: groupOf.get(f.id) ?? f.id,
      ...(f.image ? { image: f.image } : {}),
    })),
    north: doc.north,
    scale: doc.scale,
    objects: doc.objects.map((o) => {
      // スタジオだけで使う項目（floor・graphPointId・graphRouteId・locked）は外し、名前は言語ごとの形にする
      const {
        id,
        floor,
        graphPointId,
        graphRouteId,
        locked: _locked,
        title,
        description,
        kind,
        ...rest
      } = o;
      void _locked;
      return {
        id,
        kind: kind === "route" ? "line" : kind,
        groupId: groupOf.get(floor) ?? floor,
        ...rest,
        ...(loc(title) ? { title: loc(title) } : {}),
        ...(loc(description) ? { description: loc(description) } : {}),
        ...(graphPointId ? { pointId: graphPointId } : {}),
        ...(graphRouteId ? { routeId: graphRouteId } : {}),
      } as LocalizedMapObject;
    }),
    ...(doc.startId && doc.objects.some((o) => o.id === doc.startId)
      ? { startId: doc.startId }
      : {}),
  };
}

/** 案内マップの形の地図を、スタジオの形に戻す。階の名前はグラフのグループ名（無ければ 1F, 2F…） */
export function fromGuideMapLayout(
  l: LocalizedGuideMapLayout,
  graph?: VenueGraph,
): VenueMapDoc {
  const floors = l.groups.map((g, i) => ({
    id: g.groupId,
    groupId: g.groupId,
    name:
      labelOf(graph?.groups.find((x) => x.id === g.groupId)?.labels) ||
      `${i + 1}F`,
    ...(g.image ? { image: g.image } : {}),
  }));
  const objects = l.objects.map((o) => {
    const { groupId, pointId, routeId, title, description, kind, ...rest } = o;
    return {
      ...rest,
      kind: kind === "line" ? "route" : kind,
      floor: groupId,
      ...(text(title) ? { title: text(title) } : {}),
      ...(text(description) ? { description: text(description) } : {}),
      ...(pointId ? { graphPointId: pointId } : {}),
      ...(routeId ? { graphRouteId: routeId } : {}),
    } as unknown as MapObject;
  });
  return {
    version: 1,
    floors,
    activeFloorId: floors[0]?.id ?? genId("f"),
    objects,
    north: l.north ?? 0,
    scale: l.scale ?? 0,
    ...(l.startId ? { startId: l.startId } : {}),
    ...(graph ? { graph } : {}),
  };
}

/** グラフ（グラフ編集の nodes / edges）から、グループ・ポイント・ルートを取り出す */
export function parseGraph(raw: unknown): VenueGraph {
  const g = raw as { nodes?: unknown[]; edges?: unknown[] };
  if (!Array.isArray(g?.nodes) || !Array.isArray(g?.edges))
    throw new Error("invalid");
  type Node = {
    id: string;
    type?: string;
    parentId?: string;
    data?: { labels?: LocalizedLabel; nodeType?: string };
  };
  type Edge = {
    id: string;
    source: string;
    target: string;
    data?: { labels?: LocalizedLabel; label?: string };
  };
  const nodes = g.nodes as Node[];
  const nameOf = (id: string) =>
    labelOf(nodes.find((n) => n.id === id)?.data?.labels) || id;
  return {
    groups: nodes
      .filter((n) => n.type === "graphGroup")
      .map((n) => ({ id: n.id, labels: n.data?.labels ?? {} })),
    points: nodes
      .filter((n) => n.type !== "graphGroup")
      .map((n) => ({
        id: n.id,
        labels: n.data?.labels ?? {},
        groupId: n.parentId,
        nodeType: n.data?.nodeType,
      })),
    routes: (g.edges as Edge[]).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      labels:
        e.data?.labels ??
        (e.data?.label
          ? { ja: e.data.label }
          : { ja: `${nameOf(e.source)} ↔ ${nameOf(e.target)}` }),
    })),
  };
}

export type ImportedFile =
  | { kind: "studio"; doc: VenueMapDoc }
  | { kind: "guideMap"; layout: LocalizedGuideMapLayout }
  | { kind: "graph"; graph: VenueGraph };
/** 読み込んだ JSON が、どの形かを見分ける */
export function detectFile(raw: unknown): ImportedFile {
  const r = raw as Record<string, unknown>;
  if (Array.isArray(r?.groups) && Array.isArray(r?.objects))
    return {
      kind: "guideMap",
      layout: r as unknown as LocalizedGuideMapLayout,
    };
  if (Array.isArray(r?.floors) && (r.floors as unknown[]).length)
    return { kind: "studio", doc: r as unknown as VenueMapDoc };
  if (Array.isArray(r?.nodes) && Array.isArray(r?.edges))
    return { kind: "graph", graph: parseGraph(r) };
  throw new Error("unknown");
}

/**
 * 道案内の計算に渡す形（案内マップの GuideMapLayout）。お客さんの画面と同じ計算（src/features/guest/info/guideMapFloorRoute.ts）をそのまま使うために変える。
 * 階の ID はスタジオの階の ID のまま（計算結果の階をスタジオの画面でそのまま使えるように）、名前は1つの文字列にする。
 */
export function toRouteLayout(
  doc: Pick<VenueMapDoc, "floors" | "objects" | "north" | "scale" | "startId">,
): GuideMapLayout {
  return {
    version: 1,
    groups: doc.floors.map((f) => ({
      groupId: f.id,
      ...(f.image ? { image: f.image } : {}),
    })),
    north: doc.north ?? 0,
    scale: doc.scale ?? 0,
    ...(doc.startId ? { startId: doc.startId } : {}),
    objects: doc.objects.map((o) => {
      const {
        floor,
        graphPointId,
        graphRouteId,
        locked: _locked,
        kind,
        ...rest
      } = o;
      void _locked;
      return {
        ...rest,
        kind: kind === "route" ? "line" : kind,
        groupId: floor,
        ...(graphPointId ? { pointId: graphPointId } : {}),
        ...(graphRouteId ? { routeId: graphRouteId } : {}),
      } as unknown as RouteMapObject;
    }),
  };
}

// 見本（テンプレート）のマップ。tolo-web のモック（src/mocks/fixtures/ の案内マップとグラフ。KCG本館 1F〜6F）を、スタジオの形にする。
// 使うときだけ読み込む（最初に読む量を減らすため）
// 見本の範囲は「建物の外枠」（濃い線）で入っているので、自分で囲んで色を選んだ範囲と同じ「基本の色」にする
export async function sampleVenueDoc(): Promise<VenueMapDoc> {
  const [layout, graph] = await Promise.all([
    import("@/mocks/fixtures/guideMapLayout.json"),
    import("@/mocks/fixtures/guideMapGraph.json"),
  ]);
  const d = normalizeDoc(
    fromGuideMapLayout(
      structuredClone(layout.default) as unknown as LocalizedGuideMapLayout,
      parseGraph(graph.default),
    ),
  );
  return {
    ...d,
    objects: d.objects.map((o) =>
      o.kind === "area" && o.color === "building"
        ? { ...o, color: DEFAULT_COLOR }
        : o,
    ),
  };
}
