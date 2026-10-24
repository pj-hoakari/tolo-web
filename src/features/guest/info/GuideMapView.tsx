"use client";

import {
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InfoCard } from "./InfoCard";
import {
  bboxOf,
  type ConnectorType,
  type CrowdMap,
  type CrowdState,
  centroidOf,
  type Floor,
  floorSize,
  type MapObject,
  mapColorOf,
  markBoxOf,
  type PlaceObject,
  type Pt,
  type Rect,
  toPointsAttr,
} from "./venueMapDoc";

/** 場所に付けるラベル（現在地・目的地・乗り換えなど） */
export type GuideMapMarker = { objectId: string; label: string };

export type GuideMapViewProps = {
  title: string;
  /** 表示中のフロア（広さと下敷き画像に使う） */
  floor: Floor;
  /** 表示中のフロアにあるオブジェクト（title は表示名に解決済み） */
  objects: MapObject[];
  /** 表示中のフロアで歩く誘導線（点列の配列） */
  routes: Pt[][];
  markers: GuideMapMarker[];
  /** 選択中の目的地 ID（強調表示する） */
  activeId?: string | null;
  /** 検索一致の ID。指定時は非該当を薄くする */
  highlightIds?: string[];
  /** 地図の上に差し込む要素（検索欄など） */
  toolbar?: ReactNode;
  /** 地図の下に差し込む要素（道順など） */
  footer?: ReactNode;
  zoomInLabel?: string;
  zoomOutLabel?: string;
  zoomInHint?: string;
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

/** タップで拡大するときの倍率 */
const ZOOM = 2.5;
/** これ以上動いたらタップではなくドラッグとみなす（px） */
const TAP_SLOP = 8;
/** ズームのアニメーション時間（ms） */
const ZOOM_MS = 220;
/** 誘導線・ラベルの色（ゲスト画面のアクセント色にそろえる） */
const ROUTE_COLOR = "var(--guest-accent)";
/** ラベル（現在地・目的地など）の文字色 */
const PILL_TEXT = "var(--guest-secondary)";
/** 地図の下地（カードより少し沈んだ暖色。ライト / ダークで切り替わる） */
const GROUND = "var(--guest-map-ground)";
/** 混雑の重ね表示の色（中・高。危険は高と同じ色で枠を太くする） */
const CROWD_MID = "var(--guest-map-crowd-mid)";
const CROWD_HIGH = "var(--guest-map-crowd-high)";
/** 混雑したピンのまわり・部屋のまわりに広げる範囲（経路探索の混雑範囲と同じ） */
const CROWD_PIN_RADIUS = 64;
const CROWD_PAD = 32;

/** 混雑を地図に重ねるか（低は出さない） */
const crowdShown = (s: CrowdState | undefined): s is CrowdState =>
  Boolean(s && (s.danger || s.level !== "low"));
const crowdColor = (s: CrowdState) =>
  s.danger || s.level === "high" ? CROWD_HIGH : CROWD_MID;

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
  elevator: "M8 10l4-4 4 4M8 14l4 4 4-4",
};

export function GuideMapView({
  title,
  floor,
  objects,
  routes,
  markers,
  activeId = null,
  highlightIds,
  toolbar,
  footer,
  zoomInLabel = "地図を拡大",
  zoomOutLabel = "地図を縮小",
  zoomInHint = "地図をタップで拡大",
  zoomOutHint = "ドラッグで移動・タップで全体表示",
  closedLabel = "（通行止め）",
  frame,
  crowd,
  crowdLegend = { title: "混雑", mid: "中", high: "高", danger: "危険" },
}: GuideMapViewProps) {
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

  const [view, setView] = useState<View>({
    zoom: 1,
    cx: X0 + W / 2,
    cy: Y0 + H / 2,
  });
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

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  // 表示窓（viewBox）。拡大中も地図の外へははみ出さないよう中心を寄せる
  const keepInside = (v: View): View => {
    const vw = W / v.zoom;
    const vh = H / v.zoom;
    return {
      zoom: v.zoom,
      cx: clamp(v.cx, X0 + vw / 2, X0 + W - vw / 2),
      cy: clamp(v.cy, Y0 + vh / 2, Y0 + H - vh / 2),
    };
  };
  const shown = keepInside(view);
  const vbW = W / shown.zoom;
  const vbH = H / shown.zoom;
  const vbX = shown.cx - vbW / 2;
  const vbY = shown.cy - vbH / 2;
  const zoomed = shown.zoom > 1;

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
    gestureRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      cx: shown.cx,
      cy: shown.cy,
      moved: false,
    };
    // 拡大中は指を離すまで地図が受け取る（ページのスクロールに奪われない）
    if (zoomed) event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) > TAP_SLOP) gesture.moved = true;
    if (!gesture.moved || !zoomed) return;
    // 拡大中だけ、指の動きに合わせて上下左右に地図を動かす
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
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
    const gesture = gestureRef.current;
    gestureRef.current = null;
    if (!gesture || gesture.id !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!gesture.moved) toggleZoom(toWorld(event.clientX, event.clientY));
  }

  function handlePointerCancel() {
    gestureRef.current = null;
  }

  const searching = highlightIds !== undefined && highlightIds.length > 0;
  const dim = (id: string) => searching && !highlightIds?.includes(id);
  const byId = new Map(objects.map((o) => [o.id, o]));

  // 線と点の大きさ（作成ツールの太さ 5・点線 2 9 と同じ比率）
  const routeWidth = 10 * u;
  const routeCycle = 2.2 * routeWidth;
  const routeStyle = {
    stroke: ROUTE_COLOR,
    "--route-cycle": `${routeCycle}px`,
  } as CSSProperties;

  // 表示中のフロアに出ている混雑の段階（凡例に出す分だけ）
  const crowdOnFloor = [
    ...new Set(
      objects.flatMap((o) => {
        const s = crowd?.get(o.id);
        if (!crowdShown(s)) return [];
        return [s.danger ? "danger" : s.level];
      }),
    ),
  ];

  const placeFont = 26 * u;
  const pinFont = 24 * u;
  const pillFont = 22 * u;
  const pinScale = 1.6 * u;

  /** 階移動マークの大きさ。ピン型は作成ツールの指定があればそれ、無ければ押しやすい既定の正方形 */
  const connectorBox = (o: PlaceObject) => {
    if (o.shape === "pin") return markBoxOf(o, 44 * u);
    const side = Math.min(o.w, o.h);
    return { w: side, h: side };
  };

  /** ラベル（現在地・目的地など）を付ける位置：場所の真下 */
  const markerAnchor = (o: PlaceObject): Pt =>
    o.shape === "pin" && !o.connector
      ? { x: o.x, y: o.y + 8 * u }
      : {
          x: o.x,
          y: o.y + (o.connector ? connectorBox(o).h / 2 : o.h / 2) + 8 * u,
        };

  return (
    <InfoCard title={title}>
      {toolbar}

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
            "w-full overflow-hidden rounded-xl border border-primary/15 select-none",
            zoomed ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
          )}
          style={{
            background: GROUND,
            aspectRatio: `${W} / ${H}`,
            // 拡大中は 1 本指で地図を動かす。等倍のときは縦スクロールをページに譲る
            touchAction: zoomed ? "none" : "pan-y",
          }}
        >
          <svg
            viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
            preserveAspectRatio="xMidYMid meet"
            className="block h-full w-full"
            role="img"
            aria-label={title}
          >
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

            {/* エリア（芝生広場など） */}
            {objects.map((o) => {
              if (o.kind !== "area" || o.points.length < 3) return null;
              const pal = mapColorOf(o.color);
              const box = bboxOf(o.points);
              const name = o.title
                ? `${o.title}${o.closed ? closedLabel : ""}`
                : "";
              return (
                <g key={o.id} opacity={dim(o.id) ? 0.3 : 1}>
                  <polygon
                    points={toPointsAttr(o.points)}
                    style={{ fill: pal.fill, stroke: pal.stroke }}
                    fillOpacity={o.closed ? 0.6 : 0.45}
                    strokeWidth={2 * u}
                    strokeDasharray={
                      o.closed ? `${8 * u} ${5 * u}` : `${2 * u} ${6 * u}`
                    }
                  />
                  {name && (
                    <text
                      x={centroidOf(o.points).x}
                      y={box.y + placeFont + 12 * u}
                      textAnchor="middle"
                      fontSize={placeFont}
                      fontWeight={700}
                      style={{ fill: pal.ink, stroke: GROUND }}
                      strokeWidth={4 * u}
                      paintOrder="stroke"
                    >
                      {name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* 混雑（混んでいる所を色で重ねる。誘導線はここを避ける） */}
            {objects.map((o) => {
              const s = crowd?.get(o.id);
              if (!crowdShown(s)) return null;
              const color = crowdColor(s);
              const outline = {
                fill: color,
                stroke: color,
                fillOpacity: 0.28,
                strokeWidth: (s.danger ? 3 : 1.5) * u,
                strokeDasharray: `${6 * u} ${4 * u}`,
              };
              if (o.kind === "area" && o.points.length >= 3)
                return (
                  <polygon
                    key={`crowd-${o.id}`}
                    points={toPointsAttr(o.points)}
                    style={outline}
                  />
                );
              if (o.kind === "route" && o.points.length >= 2)
                return (
                  <polyline
                    key={`crowd-${o.id}`}
                    points={toPointsAttr(o.points)}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      stroke: color,
                      strokeOpacity: 0.35,
                      strokeWidth: o.width + CROWD_PAD * 2,
                    }}
                  />
                );
              if (o.kind !== "place") return null;
              if (o.shape === "pin" && !o.connector)
                return (
                  <circle
                    key={`crowd-${o.id}`}
                    cx={o.x}
                    cy={o.y}
                    r={CROWD_PIN_RADIUS}
                    style={outline}
                  />
                );
              const box =
                o.connector && o.shape === "pin"
                  ? markBoxOf(o, 28)
                  : { w: o.w, h: o.h };
              return (
                <rect
                  key={`crowd-${o.id}`}
                  x={o.x - box.w / 2 - CROWD_PAD}
                  y={o.y - box.h / 2 - CROWD_PAD}
                  width={box.w + CROWD_PAD * 2}
                  height={box.h + CROWD_PAD * 2}
                  rx={CROWD_PAD / 2}
                  style={outline}
                />
              );
            })}

            {/* 誘導線（点が進行方向へ流れる） */}
            {routes.map((points, i) =>
              points.length >= 2 ? (
                <polyline
                  // biome-ignore lint/suspicious/noArrayIndexKey: 区間の並びは経路の順番そのもので入れ替わらない
                  key={i}
                  points={toPointsAttr(points)}
                  fill="none"
                  strokeWidth={routeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={`${0.4 * routeWidth} ${1.8 * routeWidth}`}
                  className="route-anim"
                  style={routeStyle}
                />
              ) : null,
            )}

            {/* 場所（部屋・屋台・ピン・階移動ポイント） */}
            {objects.map((o) => {
              if (o.kind !== "place") return null;
              const pal = mapColorOf(o.color);
              const active = o.id === activeId;
              const name = o.title ?? "";
              const opacity = dim(o.id) ? 0.3 : 1;

              if (o.connector) {
                const { w: boxW, h: boxH } = connectorBox(o);
                const iconScale = (Math.min(boxW, boxH) * 0.6) / 24;
                return (
                  <g key={o.id} opacity={opacity}>
                    <rect
                      x={o.x - boxW / 2}
                      y={o.y - boxH / 2}
                      width={boxW}
                      height={boxH}
                      rx={Math.min(boxW, boxH) * 0.22}
                      style={{ fill: pal.fill, stroke: pal.stroke }}
                      strokeWidth={1.5 * u}
                    />
                    <path
                      d={CONNECTOR_ICON[o.connector]}
                      transform={`translate(${o.x - 12 * iconScale} ${o.y - 12 * iconScale}) scale(${iconScale})`}
                      fill="none"
                      style={{ stroke: pal.ink }}
                      strokeWidth={2.2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <text
                      x={o.x}
                      y={o.y - boxH / 2 - 8 * u}
                      textAnchor="middle"
                      fontSize={pinFont * 0.85}
                      fontWeight={500}
                      style={{ fill: pal.ink, stroke: GROUND }}
                      strokeWidth={4 * u}
                      paintOrder="stroke"
                    >
                      {name}
                    </text>
                  </g>
                );
              }

              if (o.shape === "pin") {
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
                      style={{ fill: pal.fill, stroke: pal.stroke }}
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={o.x}
                      cy={o.y - 21.5 * pinScale}
                      r={4.5 * pinScale}
                      style={{ fill: pal.ink }}
                    />
                    <text
                      x={o.x}
                      y={o.y - pinH - 8 * u}
                      textAnchor="middle"
                      fontSize={pinFont}
                      fontWeight={600}
                      style={{ fill: pal.ink, stroke: GROUND }}
                      strokeWidth={4 * u}
                      paintOrder="stroke"
                    >
                      {name}
                    </text>
                  </g>
                );
              }

              const round = o.shape === "circle";
              // 長い名前は少し小さくして収める（それでも入らなければ省略）
              const roomFont = Math.max(
                placeFont * 0.72,
                Math.min(placeFont, (o.w * 0.88) / (textWidth(name, 1) || 1)),
              );
              return (
                <g key={o.id} opacity={opacity}>
                  {active && (
                    <rect
                      x={o.x - o.w / 2 - 8 * u}
                      y={o.y - o.h / 2 - 8 * u}
                      width={o.w + 16 * u}
                      height={o.h + 16 * u}
                      rx={round ? Math.min(o.w, o.h) : 14 * u}
                      fill="none"
                      style={{ stroke: ROUTE_COLOR }}
                      strokeWidth={4 * u}
                      className="animate-pulse"
                    />
                  )}
                  <rect
                    x={o.x - o.w / 2}
                    y={o.y - o.h / 2}
                    width={o.w}
                    height={o.h}
                    rx={round ? Math.min(o.w, o.h) / 2 : 10 * u}
                    style={{
                      fill: pal.fill,
                      stroke: active ? ROUTE_COLOR : pal.stroke,
                    }}
                    strokeWidth={(active ? 3 : 1.5) * u}
                  />
                  <text
                    x={o.x}
                    y={o.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={roomFont}
                    fontWeight={600}
                    style={{ fill: pal.ink }}
                  >
                    {fitText(name, o.w * 0.88, roomFont)}
                  </text>
                </g>
              );
            })}

            {/* 文字（フロアの見出しなど） */}
            {objects.map((o) =>
              o.kind === "text" && o.title ? (
                <text
                  key={o.id}
                  x={o.x}
                  y={o.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={o.size * 1.2 * u}
                  fontWeight={600}
                  style={{ fill: mapColorOf(o.color).ink }}
                  opacity={searching ? 0.3 : 0.7}
                >
                  {o.title}
                </text>
              ) : null,
            )}

            {/* 現在地・目的地・乗り換えのラベル */}
            {markers.map((m) => {
              const o = byId.get(m.objectId);
              if (o?.kind !== "place") return null;
              const at = markerAnchor(o);
              const padX = pillFont * 0.6;
              const width = textWidth(m.label, pillFont) + padX * 2;
              const height = pillFont * 1.6;
              return (
                <g key={`${m.objectId}-${m.label}`}>
                  <rect
                    x={at.x - width / 2}
                    y={at.y}
                    width={width}
                    height={height}
                    rx={height / 2}
                    style={{ fill: ROUTE_COLOR }}
                  />
                  <text
                    x={at.x}
                    y={at.y + height / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={pillFont}
                    fontWeight={600}
                    style={{ fill: PILL_TEXT }}
                  >
                    {m.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {crowdOnFloor.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-primary/60">
            <span>{crowdLegend.title}</span>
            {crowdOnFloor.includes("mid") && (
              <span className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-3 rounded-sm"
                  style={{ background: CROWD_MID, opacity: 0.6 }}
                />
                {crowdLegend.mid}
              </span>
            )}
            {crowdOnFloor.includes("high") && (
              <span className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-3 rounded-sm"
                  style={{ background: CROWD_HIGH, opacity: 0.6 }}
                />
                {crowdLegend.high}
              </span>
            )}
            {crowdOnFloor.includes("danger") && (
              <span className="flex items-center gap-1">
                <span
                  aria-hidden
                  className="size-3 rounded-sm border-2"
                  style={{ borderColor: CROWD_HIGH }}
                />
                {crowdLegend.danger}
              </span>
            )}
          </div>
        )}

        <p className="mt-2 text-center text-xs text-primary/45">
          {zoomed ? zoomOutHint : zoomInHint}
        </p>
      </div>

      {footer}
    </InfoCard>
  );
}
