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
      <p className="flex items-baseline gap-1 text-primary">
        <span className="text-base text-primary/55">{prefix}</span>
        <span className="font-bold text-4xl tabular-nums">{minutes}</span>
        <span className="text-base text-primary/55">{unit}</span>
      </p>
    </InfoCard>
  );
}
