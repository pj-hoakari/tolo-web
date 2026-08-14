"use client";

import { Minus, Plus } from "lucide-react";
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";
import { InfoCard } from "./InfoCard";

/** 部屋 id ごとの淡いタイント色（未定義の部屋はクリームのまま） */
const ROOM_FILL: Record<string, string> = {
  hall: "fill-guest-room-amber",
  goods: "fill-guest-room-rose",
  cafe: "fill-guest-room-sage",
  exit: "fill-guest-room-sky",
};

export type MapPoint = { x: number; y: number };

/** 部屋・通路など、フロアマップの描画に必要な形状（簡易表現） */
export type GuideMapRoom = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** 塗り色クラス。未指定なら id ごとの既定色を使う */
  fill?: string;
  /** 形状（circle は角丸を最大にして円・楕円として描く） */
  shape?: "rect" | "circle";
  /** 中心を軸にした回転角（度） */
  rotation?: number;
};

/** 階段・エレベーターなどの経由地点 */
export type GuideMapWaypoint = {
  id: string;
  label: string;
  point: MapPoint;
};

/** 選択可能な目的地 */
export type GuideMapDestination = {
  id: string;
  name: string;
};

export type GuideMapViewProps = {
  width: number;
  height: number;
  rooms: GuideMapRoom[];
  waypoints: GuideMapWaypoint[];
  /** QR コード読み取り地点（現在地） */
  start: MapPoint;
  /** 目的地の選択ボタン。省略（または空）なら選択 UI を出さず、渡された経路だけを描く */
  destinations?: GuideMapDestination[];
  /** 選択中の目的地 ID（未選択は null） */
  selectedDestinationId?: string | null;
  /** 現在地→目的地の経路（経由点の順序リスト。未選択なら空） */
  route: MapPoint[];
  onSelectDestination?: (destinationId: string) => void;
  title?: string;
  hint?: string;
  currentLocationLabel?: string;
  /** 目的地選択グループの aria-label */
  destinationsLabel?: string;
  /** 拡大ボタンの aria-label */
  expandLabel?: string;
  /** 縮小ボタンの aria-label */
  collapseLabel?: string;
  /** 経路を流れる破線にするクラス（例: "route-flow route-flow-normal"） */
  routeFlowClassName?: string;
  /** 流れる速さ（animation-duration。例: "1.1s"） */
  routeFlowDuration?: string;
  /** 検索一致などで強調する部屋 ID。指定時は非該当を薄くする */
  highlightIds?: string[];
  /** 選択中の目的地（部屋）ID。脈動リングで強調する */
  activeRoomId?: string | null;
  /** 地図の上に差し込む要素（検索欄など） */
  toolbar?: ReactNode;
};

export function GuideMapView({
  width,
  height,
  rooms,
  waypoints,
  start,
  destinations = [],
  selectedDestinationId = null,
  route,
  onSelectDestination,
  title = "案内マップ",
  hint = "目的地を選択すると経路が表示されます",
  currentLocationLabel = "現在地",
  destinationsLabel = "目的地",
  expandLabel = "地図を拡大",
  collapseLabel = "地図を縮小",
  routeFlowClassName,
  routeFlowDuration,
  highlightIds,
  activeRoomId = null,
  toolbar,
}: GuideMapViewProps) {
  // 右上の＋ボタンで拡大表示に切り替える（拡大中は横スクロールで全体を見る）
  const [expanded, setExpanded] = useState(false);

  // 拡大中はドラッグでも左右に動かせるようにする
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerX: number; scrollLeft: number } | null>(null);

  function handleDragStart(event: ReactPointerEvent<HTMLDivElement>) {
    const element = scrollRef.current;
    if (!expanded || !element) return;
    element.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerX: event.clientX,
      scrollLeft: element.scrollLeft,
    };
  }

  function handleDragMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const element = scrollRef.current;
    if (!drag || !element) return;
    element.scrollLeft = drag.scrollLeft - (event.clientX - drag.pointerX);
  }

  function handleDragEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    scrollRef.current?.releasePointerCapture(event.pointerId);
  }

  const routePoints = route.map((p) => `${p.x},${p.y}`).join(" ");
  const destinationPoint = route.length > 0 ? route[route.length - 1] : null;

  // SVG は高さ固定で描くため、文字・マーカーは viewBox の高さに比例させて
  // 実際の見た目のサイズが一定になるようにする
  const labelSize = Math.round(height * 0.0375);
  const subLabelSize = Math.round(height * 0.03);
  const markerRadius = Math.round(height * 0.022);
  const waypointRadius = Math.round(height * 0.014);

  return (
    <InfoCard title={title}>
      {destinations.length > 0 && (
        <ToggleButtonGroup
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={selectedDestinationId ? [selectedDestinationId] : []}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next != null) onSelectDestination?.(String(next));
          }}
          aria-label={destinationsLabel}
          className="mb-4 flex-wrap justify-start gap-2"
        >
          {destinations.map((destination) => (
            <Toggle
              key={destination.id}
              id={destination.id}
              size="sm"
              className="h-auto rounded-full border border-primary/12 selected:border-accent bg-secondary selected:bg-accent px-3 py-1 selected:font-medium selected:text-secondary text-primary/55 text-sm hover:bg-secondary hover:text-accent"
            >
              {destination.name}
            </Toggle>
          ))}
        </ToggleButtonGroup>
      )}

      {toolbar}

      <div className="relative">
        {/* 右上の拡大／縮小ボタン */}
        <Button
          size="icon"
          variant="secondary"
          aria-label={expanded ? collapseLabel : expandLabel}
          onPress={() => setExpanded((current) => !current)}
          className="absolute top-2 right-2 z-10 size-8 rounded-full border border-primary/15 bg-secondary/85 text-primary/70 shadow-sm backdrop-blur-sm hover:bg-secondary hover:text-primary"
        >
          {expanded ? (
            <Minus className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
        </Button>

        <div
          ref={scrollRef}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          className={cn(
            "rounded-xl border border-primary/15 bg-primary/12",
            // 拡大中は高さを伸ばし、はみ出す分は横スクロール／ドラッグで見る
            expanded &&
              "cursor-grab select-none overflow-x-auto active:cursor-grabbing",
          )}
        >
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className={cn(
              expanded
                ? "h-[clamp(280px,60vh,480px)] w-auto min-w-full"
                : "h-auto w-full",
            )}
            role="img"
            aria-label={title}
          >
            {rooms.map((room) => {
              const cx = room.x + room.width / 2;
              const cy = room.y + room.height / 2;
              // 検索中は非該当を薄く、該当を強調。選択中は脈動リング。
              const searching = highlightIds && highlightIds.length > 0;
              const matched = !searching || highlightIds?.includes(room.id);
              const active = activeRoomId === room.id;
              const emphasized = active || (searching && matched);
              return (
                <g
                  key={room.id}
                  transform={
                    room.rotation
                      ? `rotate(${room.rotation} ${cx} ${cy})`
                      : undefined
                  }
                  className={cn(!matched && "opacity-30")}
                >
                  {active && (
                    <rect
                      x={room.x - 3}
                      y={room.y - 3}
                      width={room.width + 6}
                      height={room.height + 6}
                      rx={
                        room.shape === "circle"
                          ? Math.min(room.width, room.height) / 2 + 3
                          : 6
                      }
                      fill="none"
                      strokeWidth={2.5}
                      className="animate-pulse stroke-accent"
                    />
                  )}
                  <rect
                    x={room.x}
                    y={room.y}
                    width={room.width}
                    height={room.height}
                    rx={
                      room.shape === "circle"
                        ? Math.min(room.width, room.height) / 2
                        : 4
                    }
                    strokeWidth={emphasized ? 2.5 : 1.5}
                    className={cn(
                      room.fill ?? ROOM_FILL[room.id] ?? "fill-secondary",
                      emphasized ? "stroke-accent" : "stroke-primary/25",
                    )}
                  />
                  <text
                    x={cx}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={labelSize}
                    className="fill-primary/70"
                  >
                    {room.label}
                  </text>
                </g>
              );
            })}

            {waypoints.map((waypoint) => (
              <g key={waypoint.id}>
                <circle
                  cx={waypoint.point.x}
                  cy={waypoint.point.y}
                  r={waypointRadius}
                  className="fill-primary/35"
                />
                <text
                  x={waypoint.point.x}
                  y={waypoint.point.y - waypointRadius - 4}
                  textAnchor="middle"
                  fontSize={subLabelSize}
                  className="fill-primary/65"
                >
                  {waypoint.label}
                </text>
              </g>
            ))}

            {route.length > 1 && (
              <polyline
                points={routePoints}
                fill="none"
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
                className={cn("stroke-accent", routeFlowClassName)}
                style={
                  routeFlowDuration
                    ? { animationDuration: routeFlowDuration }
                    : undefined
                }
              />
            )}

            <g>
              <circle
                cx={start.x}
                cy={start.y}
                r={markerRadius}
                strokeWidth={2}
                className="fill-primary stroke-secondary"
              />
              <text
                x={start.x}
                y={start.y + markerRadius + subLabelSize}
                textAnchor="middle"
                fontSize={subLabelSize}
                className="fill-primary"
              >
                {currentLocationLabel}
              </text>
            </g>

            {destinationPoint && (
              <circle
                cx={destinationPoint.x}
                cy={destinationPoint.y}
                r={markerRadius}
                strokeWidth={2}
                className="fill-accent stroke-secondary"
              />
            )}
          </svg>
        </div>
      </div>

      {destinations.length > 0 && selectedDestinationId === null && (
        <p className="mt-3 text-primary/55 text-sm">{hint}</p>
      )}
    </InfoCard>
  );
}
