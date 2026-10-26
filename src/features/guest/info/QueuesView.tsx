import { InfoCard } from "./InfoCard";

export type QueueSummary = {
  id: string;
  name: string;
  waitTime: string;
  recommendedGates?: string;
};

export type QueuesViewProps = {
  queues: QueueSummary[];
  title?: string;
  message?: string;
};

export function QueuesView({
  queues,
  title = "行列の待ち時間",
  message,
}: QueuesViewProps) {
  return (
    <InfoCard title={title}>
      {message && <p className="text-sm text-primary/55">{message}</p>}
      <ul className="flex flex-col gap-3">
        {queues.map((queue) => (
          <li key={queue.id} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-primary">{queue.name}</span>
              <span className="shrink-0 text-sm font-bold text-primary tabular-nums">
                {queue.waitTime}
              </span>
            </div>
            {queue.recommendedGates && (
              <p className="text-xs text-primary/55">
                {queue.recommendedGates}
              </p>
            )}
          </li>
        ))}
      </ul>
    </InfoCard>
  );
}
