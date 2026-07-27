import { memo } from "react";

export type BroadcastIndicatorProps = {
  active: boolean;
  edgeId: string | null;
};

function BroadcastIndicatorComponent({
  active,
  edgeId,
}: BroadcastIndicatorProps) {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-1 text-gray-600 text-sm">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block h-2 w-2 rounded-full ${
            active ? "bg-red-500" : "bg-gray-300"
          }`}
        />
        <span>{active ? "配信中" : "停止中"}</span>
      </div>
      {edgeId && <span className="break-all text-xs">edge ID: {edgeId}</span>}
    </div>
  );
}

export const BroadcastIndicator = memo(BroadcastIndicatorComponent);
