// コピー・貼り付け・複製と、階段・エレベーター等の分身（各階に置く同じ組の物）。
// 地図の物と階の一覧だけを受け取る（画面の状態には触らない）。

import {
  type ConnectorObject,
  type Floor,
  floorSize,
  genId,
  isConnector,
  type MapObject,
} from "./venueMap";

// 階段・エレベーター等の、ほかの階の分身（コピー・複製で、つながる階と各階の設定をそのまま写すため）
export const twinsOf = (all: MapObject[], items: MapObject[]) => {
  const ids = new Set(items.map((o) => o.id));
  const links = new Set(items.filter(isConnector).map((o) => o.link));
  return all.filter(
    (o): o is ConnectorObject =>
      isConnector(o) && links.has(o.link) && !ids.has(o.id),
  );
};
// 項目を floorId の階へ写す（off だけずらす）。中身（名前・色・大きさ・説明・結び付きなど）はすべてそのまま。
// 階段・エレベーター等は新しい1組にし、元と同じ階に分身を置く（貼る階が元の組に無ければ、その階も足す）。
// shown＝貼った階に出る物（選び直す対象）、all＝ほかの階の分身も含めた全部
export const cloneObjects = (
  floors: Floor[],
  items: MapObject[],
  twins: ConnectorObject[],
  floorId: string,
  off: number,
) => {
  const links = new Map<string, string>();
  const move = <T extends MapObject>(o: T, floor: string): T => {
    const c = structuredClone(o);
    c.id = genId(isConnector(o) ? "c" : o.kind[0]);
    c.floor = floor;
    if (c.kind === "place" || c.kind === "text") {
      const { w, h } = floorSize(floors.find((f) => f.id === floor));
      c.x = Math.min(c.x + off, w);
      c.y = Math.min(c.y + off, h);
    } else c.points = c.points.map((pt) => ({ x: pt.x + off, y: pt.y + off }));
    if (isConnector(c)) {
      const link = links.get(c.link) ?? genId("l");
      links.set(c.link, link);
      c.link = link;
    }
    return c;
  };
  const shown = items.map((o) => move(o, floorId));
  const rest = items.filter(isConnector).flatMap((o) => {
    // 元の組の、ほかの階の分身（別の階に貼るときは、元の階の物も分身として残す）
    const members = [
      ...twins.filter((x) => x.link === o.link),
      ...(o.floor !== floorId ? [o] : []),
    ];
    return members
      .filter(
        (m) => m.floor !== floorId && floors.some((f) => f.id === m.floor),
      )
      .map((m) => move(m, m.floor));
  });
  return { shown, all: [...shown, ...rest] };
};

// 階段・エレベーター等の、別の階の分身（同じ位置に置く。階の広さからはみ出さないようにする）
export const twinOn = (c: ConnectorObject, f: Floor): ConnectorObject => {
  const { w, h } = floorSize(f);
  return {
    ...c,
    id: genId("c"),
    floor: f.id,
    x: Math.min(c.x, w),
    y: Math.min(c.y, h),
  };
};
