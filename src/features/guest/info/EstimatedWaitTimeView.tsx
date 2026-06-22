import { InfoCard } from "./InfoCard";

export type EstimatedWaitTimeViewProps = {
  minutes: number;
  label?: string;
  prefix?: string;
  unit?: string;
};

export function EstimatedWaitTimeView({
  minutes,
  label = "推定待ち時間",
  prefix = "約",
  unit = "分",
}: EstimatedWaitTimeViewProps) {
  return (
    <InfoCard title={label}>
      <p className="flex items-baseline gap-1 text-guest-ink">
        <span className="text-base text-guest-ink-muted">{prefix}</span>
        <span className="text-4xl font-bold tabular-nums">{minutes}</span>
        <span className="text-base text-guest-ink-muted">{unit}</span>
      </p>
    </InfoCard>
  );
}
