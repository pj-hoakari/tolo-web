import { InfoCard } from "./InfoCard";

export type CongestionLevel = "low" | "mid" | "high";

export type CongestionArea = {
  id: string;
  /** エリア名（表示言語で解決済み） */
  name: string;
  level: CongestionLevel;
  danger: boolean;
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

const LEVEL_DOT: Record<CongestionLevel, string> = {
  low: "bg-guest-calm",
  mid: "bg-guest-busy",
  high: "bg-guest-crowded",
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
  dangerLabel = "危険",
  updatedAt,
  message,
}: CongestionViewProps) {
  return (
    <InfoCard title={title}>
      {message && <p className="text-sm text-primary/55">{message}</p>}
      <ul className="flex flex-col gap-2.5">
        {areas.map((area) => (
          <li key={area.id} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-primary">
              {area.name}
              {area.danger && (
                <span className="rounded-full bg-guest-notify px-2 py-0.5 text-xs font-bold text-secondary">
                  {dangerLabel}
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${LEVEL_DOT[area.level]}`}
              />
              <span className="w-8 text-right text-sm font-medium text-primary/55">
                {levelLabels[area.level]}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {updatedAt && (
        <p className="mt-3 text-right text-xs text-primary/55">{updatedAt}</p>
      )}
    </InfoCard>
  );
}
