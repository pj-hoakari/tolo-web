import { cn } from "@/lib/utils";
import { getNodeTypeDef } from "../nodeTypes";
import type { NodeType } from "../type";

type Props = {
  type: NodeType;
  className?: string;
};

export function NodeTypeIcon({ type, className }: Props) {
  const def = getNodeTypeDef(type);
  const { color, icon } = def;
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={cn("size-3 shrink-0", className)}
    >
      {icon.kind === "circle" ? (
        <circle cx="50" cy="50" r={icon.r} fill={color} />
      ) : (
        <polygon points={icon.points} fill={color} />
      )}
    </svg>
  );
}
