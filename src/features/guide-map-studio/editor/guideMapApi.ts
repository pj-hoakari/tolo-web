// スタジオの地図を tolo-web（Graph Authoring）に保存する・読み込む。
// やりとりは案内マップの形（LocalizedGuideMapLayout）だけで、書き出しの JSON と同じ toGuideMapLayout で変換する。
// 作業途中の一時保存はこのブラウザ（VenueMapStudio の localStorage）で行い、ここは使わない

import { ORPCError } from "@orpc/client";
import type { LocalizedGuideMapLayout } from "@/features/guest/info/guideMapLayout";
import { orpc } from "@/lib/orpc";
import { fromGuideMapLayout, labelOf, toGuideMapLayout } from "./guideMapIO";
import type { VenueMapDoc } from "./venueMap";

/** 保存できなかった理由。rejected＝中身を受け付けなかった（グラフに無い階・場所を指しているなど）、forbidden＝保存する権限が無い */
export class GuideMapSaveError extends Error {
  readonly reason: "rejected" | "forbidden";

  constructor(reason: "rejected" | "forbidden") {
    super();
    this.name = "GuideMapSaveError";
    this.reason = reason;
  }
}

/**
 * サーバーに送る形。サーバーが持たない項目（階の下敷き画像・写真）は送らない（画像は大きいので、送ると保存が遅くなる）。
 * サーバーが読み戻すときの形（マークの大きさは幅・高さ、上り下りの既定は both）にそろえておき、
 * 保存した地図と読み戻した地図を同じものとして比べられるようにする
 */
function forServer(layout: LocalizedGuideMapLayout): LocalizedGuideMapLayout {
  return {
    ...layout,
    groups: layout.groups.map(({ groupId }) => ({ groupId })),
    objects: layout.objects.map((o) => {
      const { photo: _photo, ...rest } = o;
      if (rest.kind !== "place") return rest;
      const { markerSize, connector, link, direction, ...place } = rest;
      return {
        ...place,
        markW: place.markW ?? markerSize,
        markH: place.markH ?? markerSize,
        ...(connector && link
          ? { connector, link, direction: direction ?? "both" }
          : {}),
      };
    }),
  };
}

/** 地図を tolo-web に保存する */
export async function saveGuideMap(
  eventId: string,
  doc: VenueMapDoc,
): Promise<void> {
  try {
    await orpc.graph.saveGuideMapLayout({
      eventId,
      layout: forServer(toGuideMapLayout(doc)),
    });
  } catch (error) {
    if (error instanceof ORPCError && error.code === "BAD_REQUEST")
      throw new GuideMapSaveError("rejected");
    if (error instanceof ORPCError && error.code === "FORBIDDEN")
      throw new GuideMapSaveError("forbidden");
    throw error;
  }
}

/** tolo-web に保存した地図を読む。まだ保存していなければ null。階の名前はグラフのグループ名にする */
export async function loadGuideMap(
  eventId: string,
  lang = "ja",
): Promise<VenueMapDoc | null> {
  const { layout, groupLabels } = await orpc.graph.getGuideMapLayout({
    eventId,
  });
  if (layout.groups.length === 0) return null;
  const doc = fromGuideMapLayout(layout);
  return {
    ...doc,
    floors: doc.floors.map((f) => {
      const name = labelOf(groupLabels[f.groupId ?? f.id], lang);
      return name ? { ...f, name } : f;
    }),
  };
}

// 項目の並び順・空の項目（false・空文字・空のまとまり）の違いを無視して文字列にする
function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object") {
    const entries = Object.entries(v)
      .map(([k, x]) => [k, stableJson(x)] as const)
      .filter(([, x]) => x !== "" && x !== "false" && x !== "{}")
      .sort(([a], [b]) => (a < b ? -1 : 1));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${x}`).join(",")}}`;
  }
  return v === undefined || v === false || v === "" ? "" : JSON.stringify(v);
}

/**
 * サーバーに送る中身の指紋。tolo-web に保存した地図と、いまの地図が同じかを比べるのに使う
 * （同じなら「保存していない変更」は無い）。中身が大きいので、短い文字列にして残す
 */
export function guideMapFingerprint(doc: VenueMapDoc): string {
  const s = stableJson(forServer(toGuideMapLayout(doc)));
  // cyrb53（速い 53 bit のハッシュ）
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
