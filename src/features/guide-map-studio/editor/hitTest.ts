// 地図の上のどの物を押したか（当たり判定）。最前面＝配列の末尾から調べる。
// 描画順（ゾーンは最背面）に合わせ、四角・ピン・文字を先に、ゾーンは最後に判定する。
// ゾーンは背景なので、編集中は「枠線・ラベル」だけで掴む（内側のドラッグは範囲選択に回す）。
// areaInterior=true（プレビュー・クリックしただけ）のときは内側でもゾーンを拾う。
// zoom は拡大率（細い線・小さなピンを、拡大率によらず同じくらいの大きさで掴めるようにする）。

import {
  bboxOf,
  centroidOf,
  distToSegment,
  isConnector,
  type MapObject,
  markBoxOf,
  type Pt,
  pointInPolygon,
} from "./venueMap";

export function hitTest(
  objects: MapObject[],
  p: Pt,
  zoom: number,
  areaInterior = false,
): string | null {
  const tol = 8 / zoom;
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.kind === "place") {
      if (o.shape === "pin" && isConnector(o)) {
        // 階移動マーク：中心が x,y の矩形（縦長・横長も可）＋その上の名前ラベル
        const { w, h } = markBoxOf(o);
        if (
          Math.abs(p.x - o.x) <= Math.max(8, w / 2) &&
          Math.abs(p.y - o.y) <= Math.max(8, h / 2)
        )
          return o.id;
        if (
          Math.abs(p.x - o.x) <= Math.max(40, w / 2) &&
          p.y > o.y + h / 2 &&
          p.y <= o.y + h / 2 + 18
        )
          return o.id; // 下の名前
      } else if (o.shape === "pin") {
        if (
          Math.abs(p.x - o.x) <= 16 / zoom &&
          p.y <= o.y + 10 / zoom &&
          p.y >= o.y - 40 / zoom
        )
          return o.id; // 点と上の名前
      } else if (
        Math.abs(p.x - o.x) <= o.w / 2 &&
        Math.abs(p.y - o.y) <= o.h / 2
      )
        return o.id;
    } else if (o.kind === "text") {
      if (Math.abs(p.x - o.x) <= 60 / zoom && Math.abs(p.y - o.y) <= o.size)
        return o.id;
    } else if (o.kind === "route") {
      for (let j = 0; j < o.points.length - 1; j++)
        if (
          distToSegment(p, o.points[j], o.points[j + 1]) <=
          Math.max(tol, o.width / 2)
        )
          return o.id;
    }
  }
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (o.kind !== "area") continue;
    for (let j = 0; j < o.points.length; j++)
      if (
        distToSegment(p, o.points[j], o.points[(j + 1) % o.points.length]) <=
        tol
      )
        return o.id;
    if (o.title) {
      // ラベル（枠上部の名前）
      const c = centroidOf(o.points);
      const top = bboxOf(o.points).y;
      const labelW = (o.title.length + (o.closed ? 6 : 0)) * 16;
      if (
        Math.abs(p.x - c.x) <= labelW / 2 + 4 &&
        p.y >= top + 4 &&
        p.y <= top + 26
      )
        return o.id;
    }
    if (areaInterior && pointInPolygon(p, o.points)) return o.id;
  }
  return null;
}
