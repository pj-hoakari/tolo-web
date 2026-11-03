import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoCard } from "./InfoCard";

export type QueueSummary = {
  id: string;
  name: string;
  waitTime: string;
  recommendedGates?: string;
  /** おすすめの入口を案内マップで見せる（地図に無い入口なら省略） */
  mapAction?: { label: string; ariaLabel: string; onPress: () => void };
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
      {message && <p className="text-sm text-primary/70">{message}</p>}
      <ul className="flex flex-col divide-y divide-primary/10">
        {queues.map((queue) => (
          <li
            key={queue.id}
            className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-base text-primary">{queue.name}</span>
              <span className="shrink-0 text-lg font-bold text-primary tabular-nums">
                {queue.waitTime}
              </span>
            </div>
            {(queue.recommendedGates || queue.mapAction) && (
              <div className="flex items-center justify-between gap-3">
                {queue.recommendedGates && (
                  <p className="min-w-0 text-sm text-primary/70">
                    {queue.recommendedGates}
                  </p>
                )}
                {queue.mapAction && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={queue.mapAction.ariaLabel}
                    onPress={queue.mapAction.onPress}
                    className="-mr-2 h-11 shrink-0 gap-1.5 rounded-full px-3 text-sm font-medium text-accent hover:bg-accent/10 hover:text-accent"
                  >
                    <MapPin className="size-4" />
                    {queue.mapAction.label}
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </InfoCard>
  );
}
