import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InfoCard } from "./InfoCard";

export type CongestionLevel = "low" | "mid" | "high";

export type CongestionArea = {
  id: string;
  /** エリア名（表示言語で解決済み） */
  name: string;
  level: CongestionLevel;
  danger: boolean;
  /** その場所を案内マップで見せる（地図に無い場所なら省略） */
  mapAction?: { ariaLabel: string; onPress: () => void };
};

export type CongestionViewProps = {
  areas: CongestionArea[];
  title?: string;
  /** レベルの表示名（省略時は日本語） */
  levelLabels?: Record<CongestionLevel, string>;
  dangerLabel?: string;
  updatedAt?: string;
  message?: string;
};

/** レベルの目印の色（丸）と、チップの下地 */
const LEVEL_STYLE: Record<CongestionLevel, { dot: string; chip: string }> = {
  low: { dot: "bg-guest-calm", chip: "bg-guest-calm/15" },
  mid: { dot: "bg-guest-busy", chip: "bg-guest-busy/20" },
  high: { dot: "bg-guest-crowded", chip: "bg-guest-crowded/15" },
};

const DEFAULT_LEVEL_LABELS: Record<CongestionLevel, string> = {
  low: "低",
  mid: "中",
  high: "高",
};

/** 並べる順：危険 → 高 → 中 → 低（同じ段階は元の順のまま） */
const LEVEL_RANK: Record<CongestionLevel, number> = { high: 0, mid: 1, low: 2 };
const byUrgency = (a: CongestionArea, b: CongestionArea) =>
  Number(b.danger) - Number(a.danger) ||
  LEVEL_RANK[a.level] - LEVEL_RANK[b.level];

export function CongestionView({
  areas,
  title = "混雑状況",
  levelLabels = DEFAULT_LEVEL_LABELS,
  dangerLabel = "危険",
  updatedAt,
  message,
}: CongestionViewProps) {
  return (
    <InfoCard title={title}>
      {message && <p className="text-sm text-primary/70">{message}</p>}
      <ul className="flex flex-col divide-y divide-primary/10">
        {[...areas].sort(byUrgency).map((area) => (
          <li
            key={area.id}
            className="flex min-h-11 items-center gap-2 py-1.5 first:pt-0 last:pb-0"
          >
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-base text-primary">
              {area.name}
              {area.danger && (
                <span className="rounded-full bg-guest-notify px-2 py-0.5 text-xs font-bold text-secondary">
                  {dangerLabel}
                </span>
              )}
            </span>
            <span
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium text-primary",
                LEVEL_STYLE[area.level].chip,
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-2.5 rounded-full",
                  LEVEL_STYLE[area.level].dot,
                )}
              />
              {levelLabels[area.level]}
            </span>
            {area.mapAction ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={area.mapAction.ariaLabel}
                onPress={area.mapAction.onPress}
                className="-mr-2 size-11 shrink-0 rounded-full text-accent hover:bg-accent/10 hover:text-accent"
              >
                <MapPin className="size-4" />
              </Button>
            ) : (
              // 地図で見られない場所も、レベルの位置をそろえる
              <span aria-hidden className="-mr-2 size-11 shrink-0" />
            )}
          </li>
        ))}
      </ul>
      {updatedAt && (
        <p className="mt-3 text-right text-xs text-primary/70">{updatedAt}</p>
      )}
    </InfoCard>
  );
}
