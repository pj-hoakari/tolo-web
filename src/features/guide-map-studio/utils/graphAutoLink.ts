// 地図と tolo-web のグラフ（誘導グラフ）の自動の結び付け。
// お客さんの画面は、混雑の情報を「グラフのポイント ID」で受け取り、結び付いた地図の物に重ねて避ける。
// 手で「つなぎ」を開かなくてよいよう、次の順で、迷わず決まるものだけを結び付ける（迷うものは手で選ぶ）。
//  1. 階 … 名前が同じグラフのグループ（階）
//  2. 場所 … 同じ階のグループの中で、名前が同じポイント（「2F 階段」のように頭に階の名前が付いていても同じとみなす）。
//     その階に当てはまるポイントが 1 つだけのときに結び付ける（エレベーター 3 台を 1 つの「エレベーター」に、のように、
//     地図の物がいくつあっても、グラフでは 1 つのポイントにまとめてよい）
//  3. 階段・エレベーター・エスカレーター … 名前で決まらなければ、種類（階段など）の言葉を含むポイントで同じように決める。
//     ほかの階の同じ階段（分身）がもう結び付いていれば、そのポイントとグラフでつながっているポイントに絞る
//     （1 つの階に階段が 2 つあっても、上の階から順に決まっていく）
// 自動で結び付けるのは、まだ結び付いていない階・物だけ。
//  - 手で「結び付きを外す」をした物（graphPointId が ""）は、自動では結び付け直さない
//  - 結び付け先がグラフに無くなった物（グラフを作り直したときなど）は、勝手に付け替えず、チェックで知らせて手で選んでもらう
//    （開いただけで保存した地図が書き換わらないように）

import type {
  ConnectorType,
  GuidanceGraph,
  GuideMapDoc,
  MapObject,
} from "../type";
import { isConnector } from "./guideMapDoc";

const norm = (v: string) =>
  v.normalize("NFKC").replace(/\s/g, "").toLowerCase();

// 階段などの種類を表す言葉（名前で決まらないときに、ポイントの名前にこの言葉が入っているかで探す）
const TYPE_WORDS: Record<ConnectorType, string[]> = {
  stairs: ["階段", "stairs", "stair"],
  elevator: ["エレベーター", "エレベータ", "elevator"],
  escalator: ["エスカレーター", "エスカレータ", "escalator"],
};

/** 階を、名前が同じグラフのグループに結び付ける（まだ結び付いていない階だけ） */
export function linkFloorsByName(
  d: GuideMapDoc,
  g: GuidanceGraph | undefined = d.graph,
): GuideMapDoc {
  if (!g) return d;
  let changed = false;
  const floors = d.floors.map((f) => {
    if (f.groupId) return f;
    const groupId = g.groups.find((x) =>
      Object.values(x.labels).some((l) => l && norm(l) === norm(f.name)),
    )?.id;
    if (!groupId) return f;
    changed = true;
    return { ...f, groupId };
  });
  return changed ? { ...d, floors } : d;
}

/**
 * 階・場所・階段などを、グラフに自動で結び付ける。何も変わらなければ同じ地図をそのまま返す
 * （画面は、変わったときだけ地図を書き換える）
 */
export function autoLinkGraph(doc: GuideMapDoc): GuideMapDoc {
  const g = doc.graph;
  if (!g) return doc;
  const d = linkFloorsByName(doc, g);
  const points = g.points.filter((p) => p.nodeType !== "EXTERNAL");
  const pointIds = new Set(points.map((p) => p.id));
  const groupOfFloor = new Map(d.floors.map((f) => [f.id, f.groupId]));
  const groupNames = new Map(
    g.groups.map((x) => [
      x.id,
      Object.values(x.labels).filter(Boolean).map(norm),
    ]),
  );
  // ポイントの名前（言語ごと）。頭に階の名前が付いていれば、外した名前も入れる
  const namesOf = new Map(
    points.map((p) => {
      const prefixes = groupNames.get(p.groupId ?? "") ?? [];
      const names = new Set<string>();
      for (const l of Object.values(p.labels)) {
        if (!l) continue;
        const n = norm(l);
        names.add(n);
        for (const pre of prefixes)
          if (pre && n.startsWith(pre) && n.length > pre.length)
            names.add(n.slice(pre.length));
      }
      return [p.id, names];
    }),
  );
  // グラフでとなり合うポイント（ルートの両端）
  const next = new Map<string, Set<string>>();
  for (const r of g.routes) {
    if (!next.has(r.source)) next.set(r.source, new Set());
    if (!next.has(r.target)) next.set(r.target, new Set());
    next.get(r.source)?.add(r.target);
    next.get(r.target)?.add(r.source);
  }

  // 結び付け先（id → ポイント）。いま正しく結び付いている物は、そのまま使う
  const linkOf = new Map<string, string>();
  for (const o of d.objects)
    if (o.graphPointId && pointIds.has(o.graphPointId))
      linkOf.set(o.id, o.graphPointId);
  // 自動で結び付ける物：場所（ピン・部屋・区画・階段など）で、まだ結び付いていない物
  const targets = d.objects.filter(
    (o): o is Extract<MapObject, { kind: "place" }> =>
      o.kind === "place" &&
      o.graphPointId === undefined &&
      Boolean(groupOfFloor.get(o.floor)),
  );
  const titleOf = (o: MapObject) => norm(o.title ?? "");
  const matchesName = (o: MapObject, pid: string) =>
    titleOf(o) !== "" && (namesOf.get(pid)?.has(titleOf(o)) ?? false);
  const matchesType = (o: MapObject, pid: string) =>
    isConnector(o) &&
    [...(namesOf.get(pid) ?? [])].some((n) =>
      TYPE_WORDS[o.connector].some((w) => n.includes(w)),
    );

  // 1 回で決まらなくても、ほかの階で決まった階段を手がかりに次の回で決まることがあるので、変わらなくなるまで繰り返す
  for (let pass = 0; pass < 12; pass++) {
    let progress = false;
    for (const o of targets) {
      if (linkOf.has(o.id)) continue;
      const group = groupOfFloor.get(o.floor);
      const inFloor = points.filter((p) => p.groupId === group);
      // ほかの階の分身が結び付いているポイントと、グラフでとなり合うものだけに絞る
      const twinPoints = isConnector(o)
        ? d.objects.flatMap((x) =>
            isConnector(x) && x.link === o.link && linkOf.has(x.id)
              ? [linkOf.get(x.id) as string]
              : [],
          )
        : [];
      const nearTwin = (pid: string) =>
        twinPoints.length === 0 ||
        twinPoints.some((tp) => next.get(tp)?.has(pid));
      // この階で、ほかの組の階段・エレベーターがもう使っているポイント
      // （階段が 2 つあれば、片方が決まると残りのポイントがもう片方のものと分かる）
      const takenByOthers = new Set(
        isConnector(o)
          ? d.objects.flatMap((x) =>
              isConnector(x) &&
              x.floor === o.floor &&
              x.link !== o.link &&
              linkOf.has(x.id)
                ? [linkOf.get(x.id) as string]
                : [],
            )
          : [],
      );
      // 当てはまるポイントが 1 つに決まるときだけ結び付ける（2 つ以上あれば、どれのことか分からないので待つ）
      const pick = (match: (x: MapObject, pid: string) => boolean) => {
        const cands = inFloor.filter((p) => match(o, p.id) && nearTwin(p.id));
        if (cands.length === 1) return cands[0].id;
        const left = cands.filter((p) => !takenByOthers.has(p.id));
        return left.length === 1 ? left[0].id : undefined;
      };
      const pid = pick(matchesName) ?? pick(matchesType);
      if (pid) {
        linkOf.set(o.id, pid);
        progress = true;
      }
    }
    if (!progress) break;
  }

  let changed = d !== doc;
  const objects = d.objects.map((o) => {
    const pid = linkOf.get(o.id);
    if (!pid || o.graphPointId === pid) return o;
    changed = true;
    return { ...o, graphPointId: pid };
  });
  return changed ? { ...d, objects } : doc;
}
