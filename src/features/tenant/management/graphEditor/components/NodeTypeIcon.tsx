import { getNodeTypeDef } from "../nodeTypes";
import type { NodeType } from "../type";

type Props = {
  type: NodeType;
  size?: number;
  className?: string;
};

export function NodeTypeIcon({ type, size = 12, className }: Props) {
  const def = getNodeTypeDef(type);
  const { color, icon } = def;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {icon.kind === "circle" ? (
        <circle cx="50" cy="50" r={icon.r} fill={color} />
      ) : (
        <polygon points={icon.points} fill={color} />
      )}
    </svg>
  );
}
