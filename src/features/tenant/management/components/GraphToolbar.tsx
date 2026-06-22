import { Button } from "@/components/ui/button";
import { NODE_TYPE_DEFS } from "../nodeTypes";
import type { NodeType } from "../type";
import { NodeTypeIcon } from "./NodeTypeIcon";

type Props = {
  onAddNode: (type: NodeType) => void;
  onSave: () => void;
};

export function GraphToolbar({ onAddNode, onSave }: Props) {
  return (
    <div className="flex items-center justify-between gap-3 border-zinc-200 border-b bg-white px-4 py-2">
      <p className="shrink-0 font-semibold text-sm text-zinc-900">
        会場エディタ
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {NODE_TYPE_DEFS.map((def) => (
          <Button
            key={def.type}
            variant="outline"
            size="sm"
            onPress={() => onAddNode(def.type)}
            aria-label={`${def.label}を追加`}
            className="gap-1.5"
          >
            <span className="text-zinc-400">+</span>
            <NodeTypeIcon type={def.type} />
            {def.label}
          </Button>
        ))}
        <div className="ml-1 border-zinc-200 border-l pl-2">
          <Button size="sm" onPress={onSave}>
            保存
          </Button>
        </div>
      </div>
    </div>
  );
}
