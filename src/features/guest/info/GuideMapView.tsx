"use client";

import {
  Accessibility,
  Baby,
  BriefcaseMedical,
  Cigarette,
  CupSoda,
  DoorOpen,
  Flag,
  Info as InfoIcon,
  Luggage,
  Mars,
  PlugZap,
  Presentation,
  ShoppingBag,
  Sofa,
  Toilet,
  Utensils,
  Venus,
} from "lucide-react";
import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type SVGProps,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bboxOf,
  type ConnectorType,
  type CrowdMap,
  type CrowdState,
  centroidOf,
  floorSize,
  type GuideMapLayoutGroup,
  type MapObject,
  markBoxOf,
  type PlaceObject,
  type Pt,
  pointInPolygon,
  type Rect,
  toPointsAttr,
} from "./guideMapLayout";
import {
  areaPalette,
  buildingAreaOf,
  displayName,
  type PlaceCategory,
  placeCategory,
  placePalette,
  splitName,
} from "./guideMapStyle";
import { InfoCard } from "./InfoCard";

/** 場所に付けるラベル（現在地・目的地・乗り換えなど） */
export type GuideMapMarker = { objectId: string; label: string };

export type GuideMapViewProps = {
  title: string;
  /** 表示中のフロア（広さと下敷き画像に使う） */
  floor: GuideMapLayoutGroup;
  /** 表示中のフロアにあるオブジェクト（title は表示名に解決済み） */
  objects: MapObject[];
  /** 表示中のフロアで歩く経路線（点列の配列） */
  routes: Pt[][];
  markers: GuideMapMarker[];
  /** 選択中の目的地 ID（強調表示する） */
  activeId?: string | null;
  /** 現在地の場所 ID（青い点で示す） */
  currentId?: string | null;
  /** 検索一致の ID。指定時は非該当を薄くする */
  highlightIds?: string[];
  /** 「地図で見る」で見せる場所の ID。地図は動かさず、その場所に広がる波紋を付けて知らせる */
  focusIds?: string[];
  /** 地図の上に差し込む要素（検索欄など） */
  toolbar?: ReactNode;
  /** 地図の下に差し込む要素（道順など） */
  footer?: ReactNode;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  zoomOutHint?: string;
  /** 通行止めエリアの名前に添える文言 */
  closedLabel?: string;
  /**
   * 地図として見せる範囲（地図座標）。省略時はフロア全体。
   * 下敷き画像の無いフロアは白紙が広すぎるので、中身の範囲を渡して大きく見せる
   */
  frame?: Rect;
  /** 混雑（オブジェクト id → 混雑）。混んでいる所を地図に重ねて示す */
  crowd?: CrowdMap;
  /** 混雑の凡例の文言 */
  crowdLegend?: { title: string; mid: string; high: string; danger: string };
};

type GuideMapCanvasProps = Omit<
  GuideMapViewProps,
  "toolbar" | "footer" | "crowdLegend"
> & {
  className?: string;
  boxClassName?: string;
  /** 地図の下の帯の左に出す要素（混雑の凡例） */
  legend?: ReactNode;
  /** 地図の下の帯に付けるクラス（カードの余白に合わせる） */
  barClassName?: string;
};

/** タップで拡大するときの倍率 */
const ZOOM = 2.5;
/** ピンチで拡大できる上限 */
const MAX_ZOOM = 6;
/** これ以上動いたらタップではなくドラッグとみなす（px） */
const TAP_SLOP = 8;
/** ズームのアニメーション時間（ms） */
const ZOOM_MS = 220;
/** 経路線・ラベルの色（ゲスト画面のアクセント色にそろえる） */
const ROUTE_COLOR = "var(--guest-accent)";
/** ラベル（現在地・目的地など）の文字色 */
const PILL_TEXT = "var(--guest-secondary)";
/** 地図の下地＝建物の外（ライト / ダークで切り替わる） */
const GROUND = "var(--guest-map-ground)";
/** 建物の中の床＝歩ける通路（部屋より明るく / ダークでは部屋より暗くして区別する） */
const FLOOR = "var(--guest-map-floor)";
/** 建物の外枠の壁 */
const WALL = "var(--guest-map-wall)";
/** 階段・エレベーターの札の下地と記号 */
const CONNECTOR_FILL = "var(--guest-map-connector-fill)";
const CONNECTOR_INK = "var(--guest-map-connector-ink)";
/** 大きな階段・エレベーターの区画の下地（塗りつぶすと地図を占めてしまうので淡くする） */
const CONNECTOR_SOFT = "var(--guest-map-connector-soft)";
/** 現在地の点 */
const YOU = "var(--guest-map-you)";
/** 経路線の上を流れる点（進む向きを示す） */
const ROUTE_FLOW = "var(--guest-map-route-flow)";

/** 場所の種類ごとのアイコン（普通の部屋は無し） */
const CATEGORY_ICON: Partial<
  Record<PlaceCategory, ComponentType<SVGProps<SVGSVGElement>>>
> = {
  "toilet-men": Mars,
  "toilet-women": Venus,
  toilet: Toilet,
  "toilet-accessible": Accessibility,
  food: Utensils,
  shop: ShoppingBag,
  vending: CupSoda,
  rest: Sofa,
  nursing: Baby,
  "first-aid": BriefcaseMedical,
  info: InfoIcon,
  locker: Luggage,
  charging: PlugZap,
  smoking: Cigarette,
  entrance: DoorOpen,
  meeting: Flag,
  exhibit: Presentation,
};

type BoxPlace = { x: number; y: number; w: number; h: number };
const insideBox = (b: BoxPlace, p: Pt) =>
  Math.abs(p.x - b.x) <= b.w / 2 && Math.abs(p.y - b.y) <= b.h / 2;

/** 経路の終わりが部屋の中に入り込む分を、部屋の縁で切る（線が部屋の名前に刺さらないように） */
function trimRouteEnd(points: Pt[], box: BoxPlace): Pt[] {
  const pts = [...points];
  let inner = pts.pop();
  while (pts.length > 1 && inner && insideBox(box, pts[pts.length - 1]))
    inner = pts.pop();
  const outer = pts[pts.length - 1];
  if (!inner || !outer || insideBox(box, outer)) return points;
  // 外の点から中の点へ進み、縁にかかる所を二分探索で求める
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const at = {
      x: outer.x + (inner.x - outer.x) * mid,
      y: outer.y + (inner.y - outer.y) * mid,
    };
    if (insideBox(box, at)) hi = mid;
    else lo = mid;
  }
  return [
    ...pts,
    {
      x: outer.x + (inner.x - outer.x) * lo,
      y: outer.y + (inner.y - outer.y) * lo,
    },
  ];
}

function trimRoute(points: Pt[], rooms: BoxPlace[]): Pt[] {
  if (points.length < 2) return points;
  let pts = points;
  const end = rooms.find((r) => insideBox(r, pts[pts.length - 1]));
  if (end) pts = trimRouteEnd(pts, end);
  const start = rooms.find((r) => insideBox(r, pts[0]));
  if (start) pts = trimRouteEnd([...pts].reverse(), start).reverse();
  return pts.length >= 2 ? pts : points;
}
/** 混雑の重ね表示の色（中・高。危険は高と同じ色で枠を太くする） */
const CROWD_MID = "var(--guest-map-crowd-mid)";
const CROWD_HIGH = "var(--guest-map-crowd-high)";
/** 混雑したピンのまわり・部屋のまわりに広げる範囲（経路探索の混雑範囲と同じ） */
const CROWD_PIN_RADIUS = 64;
const CROWD_PAD = 32;

/** 混雑を地図に重ねるか（低は出さない） */
const crowdShown = (s: CrowdState | undefined): s is CrowdState =>
  Boolean(s && (s.danger || s.level !== "low"));

type View = { zoom: number; cx: number; cy: number };

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** 文字幅のおおよその見積もり（全角 1 文字＝フォントサイズ、半角は 0.6 倍） */
function textWidth(text: string, size: number) {
  let w = 0;
  for (const ch of text) w += (ch.codePointAt(0) ?? 0) < 0x100 ? 0.6 : 1;
  return w * size;
}

/** 幅に収まらない名前は末尾を「…」で省略する */
function fitText(text: string, maxWidth: number, size: number) {
  if (textWidth(text, size) <= maxWidth) return text;
  let out = "";
  for (const ch of text) {
    if (textWidth(`${out}${ch}…`, size) > maxWidth) break;
    out += ch;
  }
  return `${out}…`;
}

/** ピン（しずく型）の輪郭。26×34 の箱で、先端が (13, 33) */
const PIN_PATH =
  "M13 33C13 33 24 20.5 24 12.5C24 5.6 19 1 13 1C7 1 2 5.6 2 12.5C2 20.5 13 33 13 33Z";

/** 階移動の手段ごとのアイコン（24×24 の線画） */
const CONNECTOR_ICON: Record<ConnectorType, string> = {
  stairs: "M3 20h5v-5h5v-5h5V5h3",
  escalator: "M3 19h4l9-11h5",
  elevator:
    "M6.5 3h11A1.5 1.5 0 0 1 19 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3ZM9.5 9.5 12 7l2.5 2.5M9.5 14.5 12 17l2.5-2.5",
};

/** 地図そのもの（描画と、タップ・ドラッグ・ピンチの操作） */
function GuideMapCanvas({
  title,
  floor,
  objects,
  routes,
  markers,
  activeId = null,
  highlightIds,
  focusIds,
  zoomInLabel = "地図を拡大",
  zoomOutLabel = "地図を縮小",
  zoomOutHint = "ドラッグで移動・タップで全体表示",
  closedLabel = "（通行止め）",
  frame,
  crowd,
  className,
  boxClassName,
  legend,
  barClassName,
  currentId = null,
}: GuideMapCanvasProps) {
  const base = floorSize(floor);
  // 見せる範囲（左上 X0, Y0・幅 W・高さ H）
  const {
    x: X0,
    y: Y0,
    w: W,
    h: H,
  } = frame ?? {
    x: 0,
    y: 0,
    w: base.w,
    h: base.h,
  };
  // 文字や線の太さは、地図の広さに比例させる（1200px 幅の地図を基準にする）
  const u = Math.max(base.w, base.h) / 1200;

  const boxRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const gestureRef = useRef<{
    id: number;
    x: number;
    y: number;
    cx: number;
    cy: number;
    moved: boolean;
  } | null>(null);
  // 画面に触れている指（2 本でピンチ）
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; zoom: number; world: Pt } | null>(
    null,
  );

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // 枠の大きさ。見せる範囲（viewBox）を枠と同じ縦横比にして、拡大・移動の計算を合わせる
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0)
        setBox({ w: rect.width, h: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const aspect = box ? box.w / box.h : W / H;
  // 等倍（zoom 1）で見せる範囲の大きさ：地図全体が枠に入る大きさ
  const wider = aspect > W / H;
  const fitW = wider ? H * aspect : W;
  const fitH = wider ? H : W / aspect;

  const [view, setView] = useState<View>({
    zoom: 1,
    cx: X0 + W / 2,
    cy: Y0 + H / 2,
  });

  // 表示窓（viewBox）。地図の外へははみ出さないよう中心を寄せる（地図より広い向きは真ん中に置く）
  const keepInside = (v: View): View => {
    const axis = (c: number, lo: number, size: number, win: number) =>
      win >= size ? lo + size / 2 : clamp(c, lo + win / 2, lo + size - win / 2);
    return {
      zoom: v.zoom,
      cx: axis(v.cx, X0, W, fitW / v.zoom),
      cy: axis(v.cy, Y0, H, fitH / v.zoom),
    };
  };
  const shown = keepInside(view);
  const vbW = fitW / shown.zoom;
  const vbH = fitH / shown.zoom;
  const vbX = shown.cx - vbW / 2;
  const vbY = shown.cy - vbH / 2;
  const zoomed = shown.zoom > 1;
  // 地図の一部しか見えていない（ドラッグで動かせる）
  const pannable = vbW < W - 0.5 || vbH < H - 0.5;

  function animateTo(target: View) {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    const from = shown;
    const to = keepInside(target);
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / ZOOM_MS);
      const e = 1 - (1 - t) ** 3;
      setView({
        zoom: from.zoom + (to.zoom - from.zoom) * e,
        cx: from.cx + (to.cx - from.cx) * e,
        cy: from.cy + (to.cy - from.cy) * e,
      });
      frameRef.current = t < 1 ? requestAnimationFrame(tick) : null;
    };
    frameRef.current = requestAnimationFrame(tick);
  }

  function toggleZoom(at?: Pt) {
    if (zoomed) animateTo({ zoom: 1, cx: X0 + W / 2, cy: Y0 + H / 2 });
    else
      animateTo({ zoom: ZOOM, cx: at?.x ?? shown.cx, cy: at?.y ?? shown.cy });
  }

  // タップ位置（画面座標）→ 地図座標
  function toWorld(clientX: number, clientY: number): Pt | undefined {
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return undefined;
    return {
      x: vbX + ((clientX - rect.left) / rect.width) * vbW,
      y: vbY + ((clientY - rect.top) / rect.height) * vbH,
    };
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const pointers = pointersRef.current;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      // 2 本目の指：ピンチの始まり。指の間の地点を中心に拡大・縮小する
      const [a, b] = [...pointers.values()];
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        zoom: shown.zoom,
        world: toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) ?? {
          x: shown.cx,
          y: shown.cy,
        },
      };
      gestureRef.current = null;
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (pointers.size > 2) return;
    gestureRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      cx: shown.cx,
      cy: shown.cy,
      moved: false,
    };
    // 動かせるときは指を離すまで地図が受け取る（ページのスクロールに奪われない）
    if (pannable) event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    const pinch = pinchRef.current;
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const zoom = clamp(
        (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.dist,
        1,
        MAX_ZOOM,
      );
      // 指の間にある地図上の地点が、指の間に留まるように中心をずらす
      const perPx = fitW / zoom / rect.width;
      const midX = (a.x + b.x) / 2 - rect.left - rect.width / 2;
      const midY = (a.y + b.y) / 2 - rect.top - rect.height / 2;
      setView(
        keepInside({
          zoom,
          cx: pinch.world.x - midX * perPx,
          cy: pinch.world.y - midY * perPx,
        }),
      );
      return;
    }

    const gesture = gestureRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) > TAP_SLOP) gesture.moved = true;
    if (!gesture.moved || !pannable) return;
    // 指の動きに合わせて上下左右に地図を動かす
    const perPx = vbW / rect.width;
    setView(
      keepInside({
        zoom: shown.zoom,
        cx: gesture.cx - dx * perPx,
        cy: gesture.cy - dy * perPx,
      }),
    );
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const pointers = pointersRef.current;
    pointers.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (pinchRef.current) {
      // ピンチの後に指を離してもタップにはしない
      if (pointers.size < 2) pinchRef.current = null;
      return;
    }
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture || gesture.id !== event.pointerId) return;
    if (!gesture.moved) toggleZoom(toWorld(event.clientX, event.clientY));
  }

  function handlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    gestureRef.current = null;
  }

  const searching = highlightIds !== undefined && highlightIds.length > 0;
  const dim = (id: string) => searching && !highlightIds?.includes(id);
  const byId = new Map(objects.map((o) => [o.id, o]));

  // 線と点の大きさ（案内マップエディタの太さ 5・点線 2 9 と同じ比率）
  const routeWidth = 10 * u;
  const routeCycle = 2.2 * routeWidth;
  const routeStyle = {
    stroke: ROUTE_COLOR,
    "--route-cycle": `${routeCycle}px`,
  } as CSSProperties;

  const placeFont = 26 * u;
  const pinFont = 24 * u;
  const pillFont = 22 * u;
  const pinScale = 1.6 * u;

  /** 階移動マークの大きさ。ピン型は案内マップエディタの指定があればそれ、無ければ押しやすい既定の正方形 */
  const connectorBox = (o: PlaceObject) => {
    if (o.shape === "pin") return markBoxOf(o, 44 * u);
    const side = Math.min(o.w, o.h);
    return { w: side, h: side };
  };

  // 同じ画面に地図が複数あっても、影やぼかしの id がぶつからないようにする
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const shadowId = `${uid}-shadow`;
  const softId = `${uid}-soft`;
  const insideId = `${uid}-inside`;

  // 建物の外枠。床（通路）として明るく塗り、縁を壁として描く。名前は出さない
  const building = buildingAreaOf(objects);

  // 部屋（四角・丸）。経路線はその縁で止める
  const rooms = objects.filter(
    (o): o is PlaceObject =>
      o.kind === "place" && o.shape !== "pin" && !o.connector,
  );
  const shownRoutes = routes.map((points) => trimRoute(points, rooms));

  /** 場所の上下の端（ラベルの吹き出しを付ける位置に使う） */
  const extentOf = (o: PlaceObject) => {
    if (o.connector) {
      const { h } = connectorBox(o);
      return { top: o.y - h / 2, bottom: o.y + h / 2 };
    }
    if (o.shape === "pin")
      return o.id === currentId
        ? { top: o.y - 12 * u, bottom: o.y + 12 * u }
        : { top: o.y - 34 * pinScale, bottom: o.y };
    return { top: o.y - o.h / 2, bottom: o.y + o.h / 2 };
  };
  /** 吹き出しを場所の上に出すか。経路が下から来るなら上に出して、線と重ねない */
  const calloutAbove = (o: PlaceObject) => {
    let nearest: Pt | undefined;
    let best = Number.POSITIVE_INFINITY;
    for (const pts of shownRoutes)
      for (const p of [pts[0], pts[pts.length - 1]]) {
        if (!p) continue;
        const d = Math.hypot(p.x - o.x, p.y - o.y);
        if (d < best) {
          best = d;
          nearest = p;
        }
      }
    return nearest ? nearest.y > o.y : false;
  };

  // 階移動マークの名前が、ほかの名前やほかのマークに重なるとき（エレベーターが縦に並ぶなど）は出さない
  const hiddenConnectorLabels = new Set<string>();
  const placedLabels: Rect[] = [];
  const connectorMarks = objects.flatMap((o) => {
    if (o.kind !== "place" || !o.connector) return [];
    const { w, h } = connectorBox(o);
    return [{ id: o.id, x: o.x - w / 2, y: o.y - h / 2, w, h }];
  });
  for (const o of objects) {
    if (o.kind !== "place" || !o.connector || !o.title) continue;
    const size = pinFont * 0.8;
    const w = textWidth(displayName(o.title), size);
    // くっつきすぎも重なりとみなすよう、名前の周りに少し余白を足して判定する
    const pad = 6 * u;
    const label = {
      x: o.x - w / 2 - pad,
      y: o.y - connectorBox(o).h / 2 - 8 * u - size - pad,
      w: w + pad * 2,
      h: size + pad * 2,
    };
    const hits = (p: Rect) =>
      p.x < label.x + label.w &&
      label.x < p.x + p.w &&
      p.y < label.y + label.h &&
      label.y < p.y + p.h;
    if (
      placedLabels.some(hits) ||
      connectorMarks.some((m) => m.id !== o.id && hits(m))
    )
      hiddenConnectorLabels.add(o.id);
    else placedLabels.push(label);
  }

  // 混雑の範囲（エリアはその中、線は線のまわり、場所はそのまわり）。段階ごとにまとめて塗る
  const crowdShape = (o: MapObject) => {
    if (o.kind === "area" && o.points.length >= 3)
      return <polygon key={o.id} points={toPointsAttr(o.points)} />;
    if (o.kind === "line" && o.points.length >= 2)
      return (
        <polyline
          key={o.id}
          points={toPointsAttr(o.points)}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: "currentColor" }}
          strokeWidth={o.width + CROWD_PAD * 2}
        />
      );
    if (o.kind !== "place") return null;
    if (o.shape === "pin" && !o.connector)
      return <circle key={o.id} cx={o.x} cy={o.y} r={CROWD_PIN_RADIUS} />;
    const box =
      o.connector && o.shape === "pin" ? connectorBox(o) : { w: o.w, h: o.h };
    return (
      <rect
        key={o.id}
        x={o.x - box.w / 2 - CROWD_PAD}
        y={o.y - box.h / 2 - CROWD_PAD}
        width={box.w + CROWD_PAD * 2}
        height={box.h + CROWD_PAD * 2}
        rx={CROWD_PAD}
      />
    );
  };
  const crowdOf = (level: "mid" | "high") =>
    objects.filter((o) => {
      const s = crowd?.get(o.id);
      if (!crowdShown(s)) return false;
      return (s.danger || s.level === "high") === (level === "high");
    });
  const dangerIds = new Set(
    objects.filter((o) => crowd?.get(o.id)?.danger).map((o) => o.id),
  );

  // 操作の案内：拡大中だけ「ドラッグで移動・タップで全体表示」と出す
  const hint = zoomed ? zoomOutHint : null;

  /** 部屋の名前とアイコンの並べ方（1 行 → 2 行 → アイコンだけ → 省略、の順に収まる形を選ぶ） */
  const roomLabel = (o: PlaceObject, name: string, hasIcon: boolean) => {
    const availW = o.w * 0.86;
    const availH = o.h * 0.82;
    const icon = hasIcon ? clamp(Math.min(o.w, o.h) * 0.34, 18 * u, 46 * u) : 0;
    const gap = hasIcon ? 6 * u : 0;
    const fits = (lines: string[], size: number) =>
      lines.every((l) => textWidth(l, size) <= availW) &&
      icon + gap + lines.length * size * 1.2 <= availH;
    const sizeFor = (lines: string[]) =>
      Math.min(
        placeFont,
        availW / Math.max(...lines.map((l) => textWidth(l, 1) || 1)),
      );
    if (!name) return { icon, lines: [] as string[], size: placeFont };
    const one = [name];
    const oneSize = sizeFor(one);
    if (oneSize >= placeFont * 0.62 && fits(one, oneSize))
      return { icon, lines: one, size: oneSize };
    const two = splitName(name);
    const twoSize = sizeFor(two);
    if (twoSize >= placeFont * 0.5 && fits(two, twoSize))
      return { icon, lines: two, size: twoSize };
    if (hasIcon)
      return {
        icon: clamp(Math.min(o.w, o.h) * 0.5, 18 * u, 56 * u),
        lines: [] as string[],
        size: placeFont,
      };
    const size = placeFont * 0.62;
    return { icon, lines: [fitText(name, availW, size)], size };
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="relative">
        {/* キーボード・読み上げ向けの拡大切替（画面には出さない。地図そのものはタップで切り替わる） */}
        <Button
          size="sm"
          variant="secondary"
          aria-pressed={zoomed}
          aria-label={zoomed ? zoomOutLabel : zoomInLabel}
          onPress={() => toggleZoom()}
          className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:right-2 focus-visible:z-10"
        >
          {zoomed ? zoomOutLabel : zoomInLabel}
        </Button>

        <div
          ref={boxRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          className={cn(
            "w-full overflow-hidden select-none",
            pannable ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
            boxClassName,
          )}
          style={{
            background: GROUND,
            aspectRatio: `${W} / ${H}`,
            // 動かせるときは 1 本指で地図を動かす。等倍のときは縦スクロールをページに譲る
            touchAction: pannable ? "none" : "pan-y",
          }}
        >
          <svg
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-full w-full"
            role="img"
            aria-label={title}
          >
            <defs>
              {/* 部屋を床から少し浮かせる影 */}
              <filter
                id={shadowId}
                x="-10%"
                y="-10%"
                width="120%"
                height="135%"
              >
                <feDropShadow
                  dx="0"
                  dy={2 * u}
                  stdDeviation={2 * u}
                  style={{ floodColor: "var(--guest-map-shadow)" }}
                />
              </filter>
              {/* 混雑の範囲をやわらかくにじませる */}
              <filter id={softId} x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation={10 * u} />
              </filter>
              {building && (
                <clipPath id={insideId}>
                  <polygon points={toPointsAttr(building.points)} />
                </clipPath>
              )}
            </defs>

            <rect x={X0} y={Y0} width={W} height={H} style={{ fill: GROUND }} />
            {floor.image && (
              <image
                href={floor.image.src}
                x={0}
                y={0}
                width={base.w}
                height={base.h}
                preserveAspectRatio="none"
              />
            )}

            {/* 建物の床（歩ける通路） */}
            {building && (
              <polygon
                points={toPointsAttr(building.points)}
                style={{ fill: FLOOR }}
              />
            )}

            {/* エリア（芝生広場など。建物の外枠は除く） */}
            {objects.map((o) => {
              if (o.kind !== "area" || o.points.length < 3 || o === building)
                return null;
              const pal = areaPalette(o.color);
              const box = bboxOf(o.points);
              const name = o.title
                ? `${displayName(o.title)}${o.closed ? closedLabel : ""}`
                : "";
              return (
                <g key={o.id} opacity={dim(o.id) ? 0.3 : 1}>
                  <polygon
                    points={toPointsAttr(o.points)}
                    style={{ fill: pal.fill, stroke: pal.stroke }}
                    fillOpacity={o.closed ? 0.7 : 0.55}
                    strokeWidth={1.5 * u}
                    strokeDasharray={o.closed ? `${8 * u} ${5 * u}` : undefined}
                  />
                  {name && (
                    <text
                      x={centroidOf(o.points).x}
                      y={box.y + placeFont + 12 * u}
                      textAnchor="middle"
                      fontSize={placeFont * 0.9}
                      fontWeight={700}
                      style={{ fill: pal.ink, stroke: FLOOR }}
                      strokeWidth={4 * u}
                      paintOrder="stroke"
                    >
                      {name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* 建物の外枠の壁（場所の名前より下に描き、名前に線がかからないようにする） */}
            {building && (
              <polygon
                points={toPointsAttr(building.points)}
                fill="none"
                style={{ stroke: WALL }}
                strokeWidth={3 * u}
                strokeLinejoin="round"
              />
            )}

            {/* 混雑（段階ごとに 1 枚にまとめてにじませ、重なっても濃くならないようにする。建物の外へははみ出さない） */}
            {(["mid", "high"] as const).map((level) => {
              const shapes = crowdOf(level);
              if (shapes.length === 0) return null;
              return (
                <g
                  key={level}
                  clipPath={building ? `url(#${insideId})` : undefined}
                >
                  <g
                    opacity={level === "high" ? 0.3 : 0.36}
                    filter={`url(#${softId})`}
                    style={{
                      fill: level === "high" ? CROWD_HIGH : CROWD_MID,
                      color: level === "high" ? CROWD_HIGH : CROWD_MID,
                    }}
                  >
                    {shapes.map(crowdShape)}
                  </g>
                </g>
              );
            })}

            {/* 経路線（縁取り＋太い線＋進む向きに流れる点） */}
            {shownRoutes.map((points, i) =>
              points.length >= 2 ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: 区間の並びは経路の順番そのもので入れ替わらない
                <g key={i}>
                  <polyline
                    points={toPointsAttr(points)}
                    fill="none"
                    strokeWidth={routeWidth * 1.9}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ stroke: FLOOR }}
                  />
                  <polyline
                    points={toPointsAttr(points)}
                    fill="none"
                    strokeWidth={routeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ stroke: ROUTE_COLOR }}
                  />
                  <polyline
                    points={toPointsAttr(points)}
                    fill="none"
                    strokeWidth={routeWidth * 0.36}
                    strokeLinecap="round"
                    strokeDasharray={`0.01 ${routeCycle * 2}`}
                    className="route-anim"
                    style={{ ...routeStyle, stroke: ROUTE_FLOW }}
                  />
                </g>
              ) : null,
            )}

            {/* 場所（部屋・屋台・ピン・階移動手段） */}
            {objects.map((o) => {
              if (o.kind !== "place") return null;
              const active = o.id === activeId;
              const name = displayName(o.title);
              const opacity = dim(o.id) ? 0.3 : 1;

              if (o.connector) {
                const { w: boxW, h: boxH } = connectorBox(o);
                const side = Math.min(boxW, boxH);
                // 小さな印は濃い札、部屋ほどの大きさの区画は淡い下地＋縁にする
                const large = side > 56 * u;
                const iconScale =
                  Math.min(side * (large ? 0.42 : 0.62), 64 * u) / 24;
                return (
                  <g key={o.id} opacity={opacity}>
                    <rect
                      x={o.x - boxW / 2}
                      y={o.y - boxH / 2}
                      width={boxW}
                      height={boxH}
                      rx={large ? 10 * u : side * 0.26}
                      style={
                        large
                          ? { fill: CONNECTOR_SOFT, stroke: CONNECTOR_FILL }
                          : { fill: CONNECTOR_FILL }
                      }
                      strokeWidth={large ? 1.5 * u : undefined}
                      filter={`url(#${shadowId})`}
                    />
                    <path
                      d={CONNECTOR_ICON[o.connector]}
                      transform={`translate(${o.x - 12 * iconScale} ${o.y - 12 * iconScale}) scale(${iconScale})`}
                      fill="none"
                      style={{ stroke: large ? CONNECTOR_FILL : CONNECTOR_INK }}
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {!hiddenConnectorLabels.has(o.id) && (
                      <text
                        x={o.x}
                        y={o.y - boxH / 2 - 8 * u}
                        textAnchor="middle"
                        fontSize={pinFont * 0.8}
                        fontWeight={600}
                        style={{
                          fill: "var(--guest-map-room-ink)",
                          stroke: FLOOR,
                        }}
                        strokeWidth={4 * u}
                        paintOrder="stroke"
                      >
                        {name}
                      </text>
                    )}
                  </g>
                );
              }

              if (o.shape === "pin") {
                // 現在地は、地図アプリと同じ青い点と波紋で示す
                if (o.id === currentId)
                  return (
                    <g key={o.id} opacity={opacity}>
                      <circle
                        cx={o.x}
                        cy={o.y}
                        r={30 * u}
                        style={{ fill: YOU }}
                        opacity={0.18}
                        className="map-you-halo"
                      />
                      <circle
                        cx={o.x}
                        cy={o.y}
                        r={11 * u}
                        style={{ fill: YOU, stroke: "#fff" }}
                        strokeWidth={4 * u}
                        filter={`url(#${shadowId})`}
                      />
                    </g>
                  );
                const pal = placePalette(
                  o.color,
                  placeCategory(o.title, o.color),
                );
                const pinW = 26 * pinScale;
                const pinH = 34 * pinScale;
                return (
                  <g key={o.id} opacity={opacity}>
                    {active && (
                      <circle
                        cx={o.x}
                        cy={o.y - pinH / 2}
                        r={pinW}
                        fill="none"
                        style={{ stroke: ROUTE_COLOR }}
                        strokeWidth={3 * u}
                        className="animate-pulse"
                      />
                    )}
                    <path
                      d={PIN_PATH}
                      transform={`translate(${o.x - 13 * pinScale} ${o.y - 33 * pinScale}) scale(${pinScale})`}
                      style={{
                        fill: active ? ROUTE_COLOR : pal.stroke,
                        stroke: "#fff",
                      }}
                      strokeWidth={1.5}
                      filter={`url(#${shadowId})`}
                    />
                    <circle
                      cx={o.x}
                      cy={o.y - 21.5 * pinScale}
                      r={4.5 * pinScale}
                      style={{ fill: "#fff" }}
                    />
                    {name && (
                      <text
                        x={o.x}
                        y={o.y - pinH - 8 * u}
                        textAnchor="middle"
                        fontSize={pinFont}
                        fontWeight={700}
                        style={{
                          fill: "var(--guest-map-room-ink)",
                          stroke: FLOOR,
                        }}
                        strokeWidth={4 * u}
                        paintOrder="stroke"
                      >
                        {name}
                      </text>
                    )}
                  </g>
                );
              }

              const category = placeCategory(o.title, o.color);
              const pal = placePalette(o.color, category);
              const Icon = CATEGORY_ICON[category];
              const label = roomLabel(o, name, Boolean(Icon));
              const lineH = label.size * 1.2;
              const total =
                (Icon ? label.icon : 0) +
                (Icon && label.lines.length > 0 ? 6 * u : 0) +
                label.lines.length * lineH;
              let cursor = o.y - total / 2;
              const round = o.shape === "circle";
              const radius = round ? Math.min(o.w, o.h) / 2 : 8 * u;
              return (
                <g key={o.id} opacity={opacity}>
                  {active && (
                    <rect
                      x={o.x - o.w / 2 - 7 * u}
                      y={o.y - o.h / 2 - 7 * u}
                      width={o.w + 14 * u}
                      height={o.h + 14 * u}
                      rx={radius + 7 * u}
                      fill="none"
                      style={{ stroke: ROUTE_COLOR }}
                      strokeWidth={3 * u}
                      opacity={0.45}
                      className="animate-pulse"
                    />
                  )}
                  <rect
                    x={o.x - o.w / 2}
                    y={o.y - o.h / 2}
                    width={o.w}
                    height={o.h}
                    rx={radius}
                    style={{
                      fill: pal.fill,
                      stroke: active ? ROUTE_COLOR : pal.stroke,
                    }}
                    strokeWidth={(active ? 3 : 1.2) * u}
                    filter={`url(#${shadowId})`}
                  />
                  {active && (
                    <rect
                      x={o.x - o.w / 2}
                      y={o.y - o.h / 2}
                      width={o.w}
                      height={o.h}
                      rx={radius}
                      style={{ fill: ROUTE_COLOR }}
                      opacity={0.12}
                    />
                  )}
                  {/* 部屋そのものが混んでいるときは、部屋にも混雑の色を薄く重ねる（まわりのにじみは部屋に隠れるため） */}
                  {crowdShown(crowd?.get(o.id)) && (
                    <rect
                      x={o.x - o.w / 2}
                      y={o.y - o.h / 2}
                      width={o.w}
                      height={o.h}
                      rx={radius}
                      style={{
                        fill:
                          crowd?.get(o.id)?.danger ||
                          crowd?.get(o.id)?.level === "high"
                            ? CROWD_HIGH
                            : CROWD_MID,
                      }}
                      opacity={0.24}
                    />
                  )}
                  {Icon &&
                    (() => {
                      const top = cursor;
                      cursor +=
                        label.icon + (label.lines.length > 0 ? 6 * u : 0);
                      return (
                        <Icon
                          x={o.x - label.icon / 2}
                          y={top}
                          width={label.icon}
                          height={label.icon}
                          strokeWidth={2}
                          style={{ color: pal.ink }}
                          aria-hidden
                        />
                      );
                    })()}
                  {label.lines.map((line, i) => {
                    const y = cursor + lineH * i + lineH / 2;
                    return (
                      <text
                        // biome-ignore lint/suspicious/noArrayIndexKey: 名前を分けた行の順番は変わらない
                        key={i}
                        x={o.x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={label.size}
                        fontWeight={600}
                        style={{ fill: pal.ink }}
                      >
                        {line}
                      </text>
                    );
                  })}
                </g>
              );
            })}

            {/* 「地図で見る」で見せている場所：時間差で広がる 2 重の波紋＋縁 */}
            {objects.map((o) => {
              if (o.kind !== "place" || !focusIds?.includes(o.id)) return null;
              const box = o.connector
                ? connectorBox(o)
                : o.shape === "pin"
                  ? { w: 40 * u, h: 40 * u }
                  : { w: o.w, h: o.h };
              const pad = 9 * u;
              const ring = {
                x: o.x - box.w / 2 - pad,
                y: o.y - box.h / 2 - pad,
                width: box.w + pad * 2,
                height: box.h + pad * 2,
                rx: Math.min(box.w, box.h) * 0.3 + pad,
                fill: "none",
              };
              return (
                <g key={`focus-${o.id}`} pointerEvents="none">
                  <rect
                    {...ring}
                    style={{ stroke: ROUTE_COLOR }}
                    strokeWidth={3 * u}
                    className="map-focus-ripple"
                  />
                  <rect
                    {...ring}
                    style={{ stroke: ROUTE_COLOR }}
                    strokeWidth={3 * u}
                    className="map-focus-ripple map-focus-ripple-late"
                  />
                  <rect
                    {...ring}
                    style={{ stroke: ROUTE_COLOR }}
                    strokeWidth={3 * u}
                  />
                </g>
              );
            })}

            {/* 危険な混雑の場所：細い赤い縁＋外へ広がって消える波紋（2 重・時間差）＋角に「!」の印 */}
            {objects.map((o) => {
              if (o.kind !== "place" || !dangerIds.has(o.id)) return null;
              const box = o.connector
                ? connectorBox(o)
                : o.shape === "pin"
                  ? { w: 40 * u, h: 40 * u }
                  : { w: o.w, h: o.h };
              const pad = 5 * u;
              const ring = {
                x: o.x - box.w / 2 - pad,
                y: o.y - box.h / 2 - pad,
                width: box.w + pad * 2,
                height: box.h + pad * 2,
                rx: Math.min(box.w, box.h) * 0.3 + pad,
                fill: "none",
              };
              const badge = 9 * u;
              const bx = o.x + box.w / 2 + pad * 0.4;
              const by = o.y - box.h / 2 - pad * 0.4;
              return (
                <g key={`danger-${o.id}`} pointerEvents="none">
                  <rect
                    {...ring}
                    style={{ stroke: CROWD_HIGH }}
                    strokeWidth={2.5 * u}
                    className="map-danger-ripple"
                  />
                  <rect
                    {...ring}
                    style={{ stroke: CROWD_HIGH }}
                    strokeWidth={2.5 * u}
                    className="map-danger-ripple map-danger-ripple-late"
                  />
                  <rect
                    {...ring}
                    style={{ stroke: CROWD_HIGH }}
                    strokeWidth={1.5 * u}
                    opacity={0.9}
                  />
                  <g filter={`url(#${shadowId})`}>
                    <circle
                      cx={bx}
                      cy={by}
                      r={badge}
                      style={{ fill: CROWD_HIGH, stroke: FLOOR }}
                      strokeWidth={2 * u}
                    />
                    <text
                      x={bx}
                      y={by}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={badge * 1.35}
                      fontWeight={800}
                      style={{ fill: "#fff" }}
                    >
                      !
                    </text>
                  </g>
                </g>
              );
            })}

            {/* 文字（建物の中にあるものだけ。外に置いたフロアの見出しは階の切り替えと重なるので出さない） */}
            {objects.map((o) =>
              o.kind === "text" &&
              o.title &&
              (!building ||
                pointInPolygon({ x: o.x, y: o.y }, building.points)) ? (
                <text
                  key={o.id}
                  x={o.x}
                  y={o.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={o.size * 1.1 * u}
                  fontWeight={600}
                  style={{ fill: "var(--guest-map-room-ink)" }}
                  opacity={searching ? 0.3 : 0.55}
                >
                  {displayName(o.title)}
                </text>
              ) : null,
            )}

            {/* 現在地・目的地・乗り換えの吹き出し（経路と反対側に出す） */}
            {markers.map((m) => {
              const o = byId.get(m.objectId);
              if (o?.kind !== "place") return null;
              const above = calloutAbove(o);
              const { top, bottom } = extentOf(o);
              const padX = pillFont * 0.7;
              const width = textWidth(m.label, pillFont) + padX * 2;
              const height = pillFont * 1.65;
              const tip = 7 * u;
              const gap = 6 * u;
              const y = above ? top - gap - tip - height : bottom + gap + tip;
              const tipY = above ? y + height : y;
              return (
                <g
                  key={`${m.objectId}-${m.label}`}
                  filter={`url(#${shadowId})`}
                >
                  <rect
                    x={o.x - width / 2}
                    y={y}
                    width={width}
                    height={height}
                    rx={height / 2}
                    style={{ fill: ROUTE_COLOR }}
                  />
                  <path
                    d={
                      above
                        ? `M${o.x - tip} ${tipY - 0.5}L${o.x} ${tipY + tip}L${o.x + tip} ${tipY - 0.5}Z`
                        : `M${o.x - tip} ${tipY + 0.5}L${o.x} ${tipY - tip}L${o.x + tip} ${tipY + 0.5}Z`
                    }
                    style={{ fill: ROUTE_COLOR }}
                  />
                  <text
                    x={o.x}
                    y={y + height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={pillFont}
                    fontWeight={700}
                    style={{ fill: PILL_TEXT }}
                  >
                    {m.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* 凡例と操作の案内は地図の外（下の帯）に置き、地図の中身を隠さない */}
      {(legend || hint) && (
        <div
          className={cn(
            "flex min-h-12 items-center gap-2 py-1.5",
            barClassName,
          )}
        >
          <div className="shrink-0">{legend}</div>
          <p className="min-w-0 flex-1 truncate text-center text-xs text-primary/70">
            {hint}
          </p>
        </div>
      )}
    </div>
  );
}

/** 表示中のフロアに出ている混雑の段階（凡例に出す分だけ） */
function crowdLevelsOn(objects: MapObject[], crowd: CrowdMap | undefined) {
  return [
    ...new Set(
      objects.flatMap((o) => {
        const s = crowd?.get(o.id);
        if (!crowdShown(s)) return [];
        return [s.danger ? "danger" : s.level];
      }),
    ),
  ];
}

/** 混雑の凡例（地図の左下に重ねる） */
function CrowdLegend({
  levels,
  labels,
}: {
  levels: string[];
  labels: { title: string; mid: string; high: string; danger: string };
}) {
  return (
    <div className="flex items-center gap-2.5 text-xs text-primary/80">
      <span className="font-medium">{labels.title}</span>
      {levels.includes("mid") && (
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-3 rounded-sm"
            style={{ background: CROWD_MID, opacity: 0.6 }}
          />
          {labels.mid}
        </span>
      )}
      {levels.includes("high") && (
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-3 rounded-sm"
            style={{ background: CROWD_HIGH, opacity: 0.6 }}
          />
          {labels.high}
        </span>
      )}
      {levels.includes("danger") && (
        <span className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-3 rounded-sm border-2"
            style={{ borderColor: CROWD_HIGH }}
          />
          {labels.danger}
        </span>
      )}
    </div>
  );
}

/** 階移動の手段のアイコン（道順の表示などで使う） */
export function ConnectorIcon({
  type,
  className,
}: {
  type: ConnectorType;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={CONNECTOR_ICON[type]} />
    </svg>
  );
}

/** 案内マップのカード。地図はカードの左右いっぱいに広げ、凡例と操作の案内は地図の下の帯に出す */
export function GuideMapView({
  toolbar,
  footer,
  crowdLegend = { title: "混雑", mid: "中", high: "高", danger: "危険" },
  ...canvas
}: GuideMapViewProps) {
  const levels = crowdLevelsOn(canvas.objects, canvas.crowd);
  const legend =
    levels.length > 0 ? (
      <CrowdLegend levels={levels} labels={crowdLegend} />
    ) : null;

  return (
    <InfoCard title={canvas.title}>
      {toolbar}

      <GuideMapCanvas
        // フロアを切り替えたら拡大を解いて全体から見せる
        key={canvas.floor.groupId}
        {...canvas}
        className="-mx-5 sm:-mx-6"
        boxClassName="border-y border-primary/12"
        barClassName="px-5 sm:px-6"
        legend={legend}
      />

      {footer}
    </InfoCard>
  );
}
