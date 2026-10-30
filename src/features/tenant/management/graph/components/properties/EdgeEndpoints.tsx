import { Button } from "@/components/ui/button";
import type { EdgeDirection } from "../../type";
import {
  edgeDirectionGlyph,
  type GraphElementEntry,
} from "../../utils/relatedElements";

export type EdgeEndpointsProps = {
  source: GraphElementEntry;
  target: GraphElementEntry;
  direction: EdgeDirection;
  onSelect?: (entry: GraphElementEntry) => void;
};

/** ルートの始点・終点と通行方向を1行で示すサマリ */
export function EdgeEndpoints({
  source,
  target,
  direction,
  onSelect,
}: EdgeEndpointsProps) {
  const endpoint = (entry: GraphElementEntry) =>
    onSelect ? (
      <Button
        variant="link"
        className="h-auto min-w-0 p-0 text-left text-xs whitespace-normal underline"
        onPress={() => onSelect(entry)}
      >
        {entry.label}
      </Button>
    ) : (
      <span className="font-medium">{entry.label}</span>
    );

  return (
    <div className="rounded-md bg-muted p-2 text-xs text-foreground">
      <div className="flex items-center gap-2">
        {endpoint(source)}
        <span className="font-mono text-base text-muted-foreground">
          {edgeDirectionGlyph(direction)}
        </span>
        {endpoint(target)}
      </div>
    </div>
  );
}
