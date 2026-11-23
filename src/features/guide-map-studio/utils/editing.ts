// 地図を編集するときの決まりと小さな処理（拡大率・グリッド・名前の付け方・階段などの分身）

import type {
  ConnectorObject,
  ConnectorType,
  GuideMapDoc,
  MapObject,
  PlaceObject,
} from "../type";
import { isConnector } from "./guideMapDoc";

export const ZOOM_MIN = 0.2;
export const ZOOM_MAX = 4;
export const WHEEL_ZOOM_SPEED = 0.0025; // ホイール1単位あたりの拡大率（対数）
export const WHEEL_DELTA_MAX = 20; // 1イベントで効く deltaY の上限（マウス1ノッチ ≒ 5%）
export const GRID_SNAP = 20; // グリッドに揃える刻み（方眼 40px の半分）
export const clampZoom = (z: number) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

// 出発（startId）の場所が消えていたら、出発も外す（消えた場所を指したまま書き出さないように）
export const dropDanglingStart = (d: GuideMapDoc): GuideMapDoc =>
  d.startId && !d.objects.some((o) => o.id === d.startId)
    ? { ...d, startId: undefined }
    : d;
// まだ使われていない名前にする（「1F（コピー）」がすでにあれば「1F（コピー2）」）
export function uniqueName(
  base: string,
  used: string[],
  numbered: (n: number) => string,
) {
  if (!used.includes(base)) return base;
  let n = 2;
  while (used.includes(numbered(n))) n++;
  return numbered(n);
}
export const snap = (v: number) => Math.round(v / GRID_SNAP) * GRID_SNAP;

// 階移動ポイント（階段・エスカレーター・エレベーター）はどの階でも同じ位置・同じ大きさ。
// movedIds のうち階移動ポイントがあれば、同じ link の分身（他の階）の位置・大きさ・形をそろえる。
export function syncLinkedPositions(
  objs: MapObject[],
  movedIds: Set<string>,
): MapObject[] {
  const geo = new Map<
    string,
    Pick<PlaceObject, "x" | "y" | "w" | "h" | "shape" | "markW" | "markH">
  >();
  for (const o of objs)
    if (movedIds.has(o.id) && isConnector(o))
      geo.set(o.link, {
        x: o.x,
        y: o.y,
        w: o.w,
        h: o.h,
        shape: o.shape,
        markW: o.markW,
        markH: o.markH,
      });
  if (geo.size === 0) return objs;
  return objs.map((o) => {
    const g = isConnector(o) ? geo.get(o.link) : undefined;
    return g ? ({ ...o, ...g } as MapObject) : o;
  });
}
// 削除・選択の対象を、階移動ポイントなら同じ link の全フロア分に広げる
export function withLinkedTwins(
  objs: MapObject[],
  ids: Set<string>,
): Set<string> {
  const links = new Set(
    objs
      .filter((o) => ids.has(o.id) && isConnector(o))
      .map((o) => (o as ConnectorObject).link),
  );
  if (links.size === 0) return ids;
  return new Set([
    ...ids,
    ...objs.filter((o) => isConnector(o) && links.has(o.link)).map((o) => o.id),
  ]);
}

export function guessConnector(title?: string): ConnectorType | null {
  if (!title) return null;
  if (/エレベ|ＥＶ|\bEV\b|elevator/i.test(title)) return "elevator";
  if (/エスカ|escalator/i.test(title)) return "escalator";
  if (/階段|stairs?/i.test(title)) return "stairs";
  return null;
}

// 混雑を試す表の見出しに出す、階の短い名前（「6Fホール」→「6F」）。列が細いので、名前の頭の階の番号だけにする。
// 短くすると同じになる階があるときは、元の名前のまま（見出しは切れるが、押す前に名前が見られる）
export function shortFloorNames(names: string[]): string[] {
  const short = names.map(
    (n) => n.normalize("NFKC").match(/^B?\d+F/i)?.[0] ?? n,
  );
  return short.map((s, i) =>
    short.indexOf(s) === short.lastIndexOf(s) ? s : names[i],
  );
}
