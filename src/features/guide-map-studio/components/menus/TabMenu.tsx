"use client";

import { ArrowLeft, ArrowRight, Copy, Pencil, Trash2 } from "lucide-react";
import { useI18n } from "../../i18n/i18n";
import { PopupMenu } from "../parts/PopupMenu";

// タブ（マップのタブ・階のタブ）の右クリックメニュー：名前を変更・左右へ移動・複製・削除
export function TabMenu({
  x,
  y,
  index,
  count,
  deleteBlockedTitle,
  onClose,
  onRename,
  onMove,
  onDuplicate,
  onDelete,
}: {
  x: number;
  y: number;
  /** そのタブの並び順（0 から） */
  index: number;
  /** タブの数 */
  count: number;
  /** 最後の 1 つで削除できないときの説明 */
  deleteBlockedTitle: string;
  onClose: () => void;
  onRename: () => void;
  /** 指定した位置の前へ移す（右へ 1 つ動かすときは index + 2） */
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <PopupMenu x={x} y={y} onClose={onClose} className="w-44">
      <button
        type="button"
        onClick={onRename}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
      >
        <Pencil className="size-3.5" />
        {t("名前を変更")}
      </button>
      <button
        type="button"
        disabled={index <= 0}
        onClick={() => onMove(index - 1)}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent disabled:opacity-40"
      >
        <ArrowLeft className="size-3.5" />
        {t("左へ移動")}
      </button>
      <button
        type="button"
        disabled={index >= count - 1}
        onClick={() => onMove(index + 2)}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent disabled:opacity-40"
      >
        <ArrowRight className="size-3.5" />
        {t("右へ移動")}
      </button>
      <button
        type="button"
        onClick={onDuplicate}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
      >
        <Copy className="size-3.5" />
        {t("複製")}
      </button>
      <button
        type="button"
        disabled={count <= 1}
        onClick={onDelete}
        title={count <= 1 ? deleteBlockedTitle : undefined}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent disabled:opacity-40"
      >
        <Trash2 className="size-3.5" />
        {t("削除")}
      </button>
    </PopupMenu>
  );
}
