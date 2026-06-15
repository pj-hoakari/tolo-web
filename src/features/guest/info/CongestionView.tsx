import { InfoCard } from "./InfoCard";

export type CongestionLevel = "low" | "mid" | "high";

export type CongestionArea = {
  id: string;
  /** エリア名（表示言語で解決済み） */
  name: string;
  level: CongestionLevel;
};

export type CongestionViewProps = {
  areas: CongestionArea[];
  title?: string;
  /** レベルの表示名（省略時は日本語） */
  levelLabels?: Record<CongestionLevel, string>;
};

const LEVEL_DOT: Record<CongestionLevel, string> = {
  low: "bg-calm",
  mid: "bg-busy",
  high: "bg-crowded",
};

const DEFAULT_LEVEL_LABELS: Record<CongestionLevel, string> = {
  low: "低",
  mid: "中",
  high: "高",
};

export function CongestionView({
  areas,
  title = "混雑状況",
  levelLabels = DEFAULT_LEVEL_LABELS,
}: CongestionViewProps) {
  return (
    <InfoCard title={title}>
      <ul className="flex flex-col gap-2.5">
        {areas.map((area) => (
          <li key={area.id} className="flex items-center justify-between">
            <span className="text-sm text-ink">{area.name}</span>
            <span className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${LEVEL_DOT[area.level]}`}
              />
              <span className="w-8 text-right text-sm font-medium text-ink-muted">
                {levelLabels[area.level]}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </InfoCard>
  );
}
