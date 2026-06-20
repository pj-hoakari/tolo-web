"use client";

type Props = {
  hasSelection: boolean;
  onAddNode: () => void;
  onDeleteSelection: () => void;
};

export function GraphToolbar({
  hasSelection,
  onAddNode,
  onDeleteSelection,
}: Props) {
  return (
    <div className="flex items-center justify-between border-zinc-200 border-b bg-white px-4 py-2">
      <p className="font-semibold text-sm text-zinc-900">会場エディタ</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onAddNode}
          className="rounded-md bg-sky-600 px-3 py-1.5 font-medium text-white text-xs shadow-sm hover:bg-sky-500"
        >
          + ノードを追加
        </button>
        <button
          type="button"
          onClick={onDeleteSelection}
          disabled={!hasSelection}
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-xs text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          選択を削除
        </button>
      </div>
    </div>
  );
}
