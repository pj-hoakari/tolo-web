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
  destinations: GuideMapDestination[];
  /** 選択中の目的地 ID（未選択は null） */
  selectedDestinationId: string | null;
  /** 現在地→目的地の経路（経由点の順序リスト。未選択なら空） */
  route: MapPoint[];
  onSelectDestination: (destinationId: string) => void;
  title?: string;
  hint?: string;
  currentLocationLabel?: string;
};

export function GuideMapView({
  width,
  height,
  rooms,
  waypoints,
  start,
  destinations,
  selectedDestinationId,
  route,
  onSelectDestination,
  title = "案内マップ",
  hint = "目的地を選択すると経路が表示されます",
  currentLocationLabel = "現在地",
}: GuideMapViewProps) {
  const routePoints = route.map((p) => `${p.x},${p.y}`).join(" ");
  const destinationPoint = route.length > 0 ? route[route.length - 1] : null;

  return (
    <InfoCard title={title}>
      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={selectedDestinationId ? [selectedDestinationId] : []}
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (next != null) onSelectDestination(String(next));
        }}
        aria-label="目的地"
        className="mb-4 flex-wrap justify-start gap-2"
      >
        {destinations.map((destination) => (
          <Toggle
            key={destination.id}
            id={destination.id}
            size="sm"
            className="h-auto rounded-full border border-guest-primary/12 bg-guest-secondary px-3 py-1 text-sm text-guest-primary/55 hover:bg-guest-secondary hover:text-guest-accent selected:border-guest-accent selected:bg-guest-accent selected:font-medium selected:text-guest-secondary"
          >
            {destination.name}
          </Toggle>
        ))}
      </ToggleButtonGroup>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full rounded-xl border border-guest-primary/15 bg-guest-primary/12"
        role="img"
        aria-label={title}
      >
        {rooms.map((room) => (
          <g key={room.id}>
            <rect
              x={room.x}
              y={room.y}
              width={room.width}
              height={room.height}
              rx={4}
              strokeWidth={1.5}
              className={cn(
                ROOM_FILL[room.id] ?? "fill-guest-secondary",
                "stroke-guest-primary/25",
              )}
            />
            <text
              x={room.x + room.width / 2}
              y={room.y + room.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-guest-primary/70 text-[10px]"
            >
              {room.label}
            </text>
          </g>
        ))}

        {waypoints.map((waypoint) => (
          <g key={waypoint.id}>
            <circle
              cx={waypoint.point.x}
              cy={waypoint.point.y}
              r={4}
              className="fill-guest-primary/35"
            />
            <text
              x={waypoint.point.x}
              y={waypoint.point.y - 7}
              textAnchor="middle"
              className="fill-guest-primary/65 text-[8px]"
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
            className="stroke-guest-accent"
          />
        )}

        <g>
          <circle
            cx={start.x}
            cy={start.y}
            r={6}
            strokeWidth={2}
            className="fill-guest-primary stroke-guest-secondary"
          />
          <text
            x={start.x}
            y={start.y + 16}
            textAnchor="middle"
            className="fill-guest-primary text-[8px]"
          >
            {currentLocationLabel}
          </text>
        </g>

        {destinationPoint && (
          <circle
            cx={destinationPoint.x}
            cy={destinationPoint.y}
            r={6}
            strokeWidth={2}
            className="fill-guest-accent stroke-guest-secondary"
          />
        )}
      </svg>

      {selectedDestinationId === null && (
        <p className="mt-3 text-sm text-guest-primary/55">{hint}</p>
      )}
    </InfoCard>
  );
}
