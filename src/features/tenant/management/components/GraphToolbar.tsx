"use client";

import { NODE_TYPE_DEFS } from "../nodeTypes";
import type { NodeType } from "../type";

type Props = {
  onAddNode: (type: NodeType) => void;
};

export function GraphToolbar({ onAddNode }: Props) {
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
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: def.color }}
              aria-hidden
            />
            {def.label}
          </button>
        ))}
      </div>
    </div>
  );
}
