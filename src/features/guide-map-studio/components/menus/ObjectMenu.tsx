"use client";

import { Copy, Lock, LockOpen, Trash2 } from "lucide-react";
import { useI18n } from "../../i18n/i18n";
import type { Floor, PaletteKey } from "../../type";
import { PALETTE_KEYS } from "../../utils/guideMapDoc";
import { ColorSwatch } from "../parts/ColorSwatch";
import { PopupMenu } from "../parts/PopupMenu";

// 地図の物の右クリックメニュー：複製・削除・固定・別の階へコピー・色を変える
export function ObjectMenu({
  x,
  y,
  count,
  allLocked,
  otherFloors,
  selectedColor,
  onClose,
  onDuplicate,
  onDelete,
  onLock,
  onCopyToFloor,
  onColor,
}: {
  x: number;
  y: number;
  /** 選んでいる物の数 */
  count: number;
  /** 選んでいる物が全部固定されているか */
  allLocked: boolean;
  /** コピー先にできる、ほかの階 */
  otherFloors: Floor[];
  selectedColor: PaletteKey | null | undefined;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLock: (locked: boolean) => void;
  onCopyToFloor: (floorId: string) => void;
  onColor: (color: PaletteKey) => void;
}) {
  const { t } = useI18n();
  const countLabel = count > 1 ? t("（{n}件）", { n: count }) : "";
  return (
    <PopupMenu x={x} y={y} onClose={onClose} className="w-48">
      <button
        type="button"
        onClick={onDuplicate}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
      >
        <Copy className="size-3.5" />
        {t("複製")}
        {countLabel}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
      >
        <Trash2 className="size-3.5" />
        {t("削除")}
        {countLabel}
      </button>
      {allLocked ? (
        <button
          type="button"
          onClick={() => onLock(false)}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
        >
          <LockOpen className="size-3.5" />
          {t("固定を外す")}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onLock(true)}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
        >
          <Lock className="size-3.5" />
          {t("固定する（動かないようにする）")}
        </button>
      )}
      {otherFloors.length > 0 && (
        <>
          <div className="my-1 border-t" />
          <div className="px-2 pt-1 pb-0.5 text-muted-foreground">
            {t("別の階へコピー")}
          </div>
          {otherFloors.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onCopyToFloor(f.id)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
            >
              <Copy className="size-3.5" />
              {t("{floor}へコピー", { floor: f.name })}
            </button>
          ))}
        </>
      )}
      <div className="my-1 border-t" />
      <div className="px-2 py-1">
        <span className="text-muted-foreground">{t("色を変える")}</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {PALETTE_KEYS.map((k) => (
            <ColorSwatch
              key={k}
              k={k}
              selected={selectedColor === k}
              aria-pressed={selectedColor === k}
              onClick={() => onColor(k)}
              className="size-5"
            />
          ))}
        </div>
      </div>
    </PopupMenu>
  );
}
