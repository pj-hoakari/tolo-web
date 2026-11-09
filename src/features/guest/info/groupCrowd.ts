/**
 * 混雑状況の一覧を、同じ場所・同じ段階で階だけが違うものを 1 行にまとめる。
 * 例：「1F エレベーター前（危険）」〜「6F エレベーター前（危険）」→「1F〜6F エレベーター前（危険）」。
 * 階は名前の先頭の「1F」「B1F」から読む（表示名は Guest Service が付けるため、階の項目は無い）。
 * 続いている階は「1F〜3F」、飛んでいる階は「1F・3F」のように書く。
 */

export type CrowdLike = {
  id: string;
  name: string;
  level: string;
  danger: boolean;
};

export type CrowdGroup<T extends CrowdLike> = {
  /** まとめた行の名前（階の範囲＋場所の名前） */
  name: string;
  level: T["level"];
  danger: boolean;
  /** まとめた元の項目（元の並び順） */
  members: T[];
};

export type FloorFormat = {
  /** 続いている階の範囲（例：from=1F, to=3F → 1F〜3F） */
  range: (from: string, to: string) => string;
  /** 飛んでいる階・範囲の並べ方（例：1F〜3F・5F） */
  join: (parts: string[]) => string;
};

// 先頭の階（B1F・1F・12F）と、その後ろの区切り（空白）と場所の名前
const FLOOR_PREFIX = /^(B?)(\d+)F(\s*)(.+)$/i;

type Parsed = { floor: number; label: string; space: string; place: string };

function parseFloor(name: string): Parsed | null {
  const m = name.normalize("NFKC").match(FLOOR_PREFIX);
  if (!m) return null;
  const n = Number(m[2]);
  return {
    // 地下は負の数にして、B1F の次が 1F になるようにする
    floor: m[1] ? -n : n,
    label: `${m[1].toUpperCase()}${m[2]}F`,
    space: m[3],
    place: m[4],
  };
}

/** 隣り合う階か（地下 1 階の次は 1 階。0 階は無い） */
const adjacent = (a: number, b: number) => b - a === 1 || (a === -1 && b === 1);

function formatFloors(floors: Parsed[], format: FloorFormat) {
  const sorted = [...new Map(floors.map((f) => [f.floor, f])).values()].sort(
    (a, b) => a.floor - b.floor,
  );
  const parts: string[] = [];
  let start = 0;
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && adjacent(sorted[i - 1].floor, sorted[i].floor))
      continue;
    const from = sorted[start];
    const to = sorted[i - 1];
    parts.push(from === to ? from.label : format.range(from.label, to.label));
    start = i;
  }
  return format.join(parts);
}

export function groupCrowdByFloor<T extends CrowdLike>(
  items: readonly T[],
  format: FloorFormat,
): CrowdGroup<T>[] {
  const groups = new Map<
    string,
    { members: T[]; floors: Parsed[]; first: Parsed | null }
  >();
  for (const item of items) {
    const parsed = parseFloor(item.name);
    // 階の無い名前はまとめない（id ごとに 1 行）
    const key = parsed
      ? `${parsed.place}\u0000${item.level}\u0000${item.danger}`
      : `\u0001${item.id}`;
    const group = groups.get(key);
    if (group) {
      group.members.push(item);
      if (parsed) group.floors.push(parsed);
    } else
      groups.set(key, {
        members: [item],
        floors: parsed ? [parsed] : [],
        first: parsed,
      });
  }
  return [...groups.values()].map(({ members, floors, first }) => ({
    name:
      first && floors.length > 1
        ? `${formatFloors(floors, format)}${first.space}${first.place}`
        : members[0].name,
    level: members[0].level,
    danger: members[0].danger,
    members,
  }));
}
