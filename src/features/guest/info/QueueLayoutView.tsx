import { InfoCard } from "./InfoCard";

/** 列の形状 */
export type QueueShape = "zigzag" | "straight" | "l-shape" | "spiral";
/** 進行方向 */
export type QueueDirection = "ltr" | "rtl" | "ttb" | "btt";
/** 入口の位置 */
export type QueueEntrance = "top" | "bottom" | "left" | "right";

/** 表示ラベル（言語ごとに解決済み） */
export type QueueLayoutLabels = {
  title: string;
  shape: string;
  direction: string;
  entrance: string;
  entranceMarker: string;
  current: string;
  max: string;
  people: string;
  /** 選択中の形状の表示名 */
  shapeName: string;
  /** 入口位置の表示名 */
  entranceName: string;
};

export type QueueLayoutViewProps = {
  /** 列の形状 */
  shape: QueueShape;
  /** 列の数 */
  laneCount: number;
  /** 1 列あたりの人数 */
  peoplePerLane: number;
  /** 進行方向 */
  direction: QueueDirection;
  /** 入口がどちら側か */
  entrance: QueueEntrance;
  /** 現在の列内人数 */
  currentCount: number;
  /** 表示ラベル（省略時は日本語） */
  labels?: QueueLayoutLabels;
};

type GridSlot = { gx: number; gy: number };

/** 形状・列数・人数から、待機位置のグリッド座標を待ち順（先頭→最後尾）で生成する */
function computeSlots(
  shape: QueueShape,
  laneCount: number,
  peoplePerLane: number,
): GridSlot[] {
  const slots: GridSlot[] = [];
  switch (shape) {
    case "straight":
      for (let lane = 0; lane < laneCount; lane++) {
        for (let i = 0; i < peoplePerLane; i++) {
          slots.push({ gx: i, gy: lane });
        }
      }
      break;
    case "zigzag":
      // 折り返し（蛇行）。奇数列は逆向きに並べる
      for (let lane = 0; lane < laneCount; lane++) {
        for (let i = 0; i < peoplePerLane; i++) {
          const gx = lane % 2 === 0 ? i : peoplePerLane - 1 - i;
          slots.push({ gx, gy: lane });
        }
      }
      break;
    case "l-shape":
      for (let i = 0; i < peoplePerLane; i++) slots.push({ gx: i, gy: 0 });
      for (let j = 1; j < laneCount; j++) {
        slots.push({ gx: peoplePerLane - 1, gy: j });
      }
      break;
    case "spiral": {
      // 正方形グリッド上を外周から内側へ巻く
      const size = Math.max(laneCount, 2);
      let top = 0;
      let bottom = size - 1;
      let left = 0;
      let right = size - 1;
      while (left <= right && top <= bottom) {
        for (let x = left; x <= right; x++) slots.push({ gx: x, gy: top });
        top++;
        for (let y = top; y <= bottom; y++) slots.push({ gx: right, gy: y });
        right--;
        if (top <= bottom) {
          for (let x = right; x >= left; x--) slots.push({ gx: x, gy: bottom });
          bottom--;
        }
        if (left <= right) {
          for (let y = bottom; y >= top; y--) slots.push({ gx: left, gy: y });
          left++;
        }
      }
      break;
    }
  }
  return slots;
}

const SHAPE_LABEL: Record<QueueShape, string> = {
  zigzag: "ジグザグ",
  straight: "直線",
  "l-shape": "L字",
  spiral: "らせん",
};

const ENTRANCE_LABEL: Record<QueueEntrance, string> = {
  top: "上",
  bottom: "下",
  left: "左",
  right: "右",
};

const CELL = 28;
const RADIUS = 9;
const PAD = 24;

export function QueueLayoutView({
  shape,
  laneCount,
  peoplePerLane,
  direction,
  entrance,
  currentCount,
  labels,
}: QueueLayoutViewProps) {
  const l: QueueLayoutLabels = labels ?? {
    title: "行列の並び方",
    shape: "形状",
    direction: "進行方向",
    entrance: "入口",
    entranceMarker: "入口",
    current: "現在",
    max: "最大",
    people: "人",
    shapeName: SHAPE_LABEL[shape],
    entranceName: ENTRANCE_LABEL[entrance],
  };

  const slots = computeSlots(shape, laneCount, peoplePerLane);

  const maxAlong = slots.reduce((max, s) => Math.max(max, s.gx), 0);
  const maxLane = slots.reduce((max, s) => Math.max(max, s.gy), 0);

  // 進行方向に応じてグリッド座標を画面座標へ写像する
  const toScreen = ({ gx, gy }: GridSlot) => {
    switch (direction) {
      case "ltr":
        return { x: gx, y: gy };
      case "rtl":
        return { x: maxAlong - gx, y: gy };
      case "ttb":
        return { x: gy, y: gx };
      case "btt":
        return { x: maxLane - gy, y: gx };
    }
  };

  const screen = slots.map(toScreen);
  const cols = screen.reduce((max, p) => Math.max(max, p.x), 0);
  const rows = screen.reduce((max, p) => Math.max(max, p.y), 0);
  const width = cols * CELL + PAD * 2;
  const height = rows * CELL + PAD * 2;
  const px = (x: number) => PAD + x * CELL;
  const py = (y: number) => PAD + y * CELL;

  const total = slots.length;
  const occupied = Math.min(Math.max(currentCount, 0), total);

  // 隣接する待機位置どうしを結ぶ線分（列の連なりを示す）
  const segments = slots
    .map((slot, i) => ({ slot, i }))
    .filter(({ slot, i }) => {
      if (i === 0) return false;
      const prev = slots[i - 1];
      return Math.abs(prev.gx - slot.gx) + Math.abs(prev.gy - slot.gy) === 1;
    });

  return (
    <InfoCard title={l.title}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-xl border border-guest-line bg-guest-surface-muted"
        role="img"
        aria-label={l.title}
      >
        {segments.map(({ slot, i }) => {
          const a = screen[i - 1];
          const b = screen[i];
          return (
            <line
              key={`${slots[i - 1].gx}-${slots[i - 1].gy}-${slot.gx}-${slot.gy}`}
              x1={px(a.x)}
              y1={py(a.y)}
              x2={px(b.x)}
              y2={py(b.y)}
              strokeWidth={4}
              strokeLinecap="round"
              className="stroke-guest-line"
            />
          );
        })}

        {slots.map((slot, i) => {
          const p = screen[i];
          // 一番上の横列だけ茶色（accent）で塗る
          const filled = p.y === 0;
          const isEntrance = i === slots.length - 1;
          return (
            <g key={`${slot.gx}-${slot.gy}`}>
              <circle
                cx={px(p.x)}
                cy={py(p.y)}
                r={RADIUS}
                strokeWidth={isEntrance ? 2.5 : 1.5}
                className={
                  filled
                    ? "fill-guest-accent stroke-guest-accent"
                    : isEntrance
                      ? "fill-guest-surface stroke-guest-ink"
                      : "fill-guest-surface stroke-guest-line"
                }
              />
              {isEntrance && (
                <text
                  x={px(p.x)}
                  y={py(p.y) + RADIUS + 11}
                  textAnchor="middle"
                  className="fill-guest-ink text-[9px]"
                >
                  {l.entranceMarker}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p className="mt-3 text-sm text-guest-ink">
        {l.current} <span className="font-bold tabular-nums">{occupied}</span>{" "}
        {l.people} / {l.max} <span className="tabular-nums">{total}</span>{" "}
        {l.people}
      </p>
    </InfoCard>
  );
}
