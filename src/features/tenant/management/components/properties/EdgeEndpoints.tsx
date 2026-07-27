import type { EdgeDirection } from "../../type";

export type EdgeEndpointsProps = {
  sourceLabel: string;
  targetLabel: string;
  direction: EdgeDirection;
};

/** ルートの始点・終点と通行方向を1行で示すサマリ */
export function EdgeEndpoints({
  sourceLabel,
  targetLabel,
  direction,
}: EdgeEndpointsProps) {
  return (
    <div className="rounded-md bg-muted p-2 text-foreground text-xs">
      <div className="flex items-center gap-2">
        <span className="font-medium">{sourceLabel}</span>
        <span className="font-mono text-base text-muted-foreground">
          {direction === "both" ? "⇌" : "→"}
        </span>
        <span className="font-medium">{targetLabel}</span>
      </div>
    </div>
  );
}
