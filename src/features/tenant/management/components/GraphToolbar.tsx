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
          <button
            key={def.type}
            type="button"
            onClick={() => onAddNode(def.type)}
            title={`${def.label}を追加`}
            className="flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 font-medium text-xs text-zinc-700 shadow-sm hover:bg-zinc-50"
          >
            <span className="text-zinc-400">+</span>
            <NodeTypeIcon type={def.type} />
            {def.label}
          </button>
        ))}
        <div className="ml-1 border-zinc-200 border-l pl-2">
          <button
            type="button"
            onClick={onSave}
            className="rounded-md bg-sky-600 px-3 py-1.5 font-medium text-white text-xs shadow-sm hover:bg-sky-500"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
