"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ReactNode, useState } from "react";

import { cn } from "@/lib/utils";

export type GuestInfoTile = {
  /** タイルを一意に識別する id（並び替えの単位・React のキー） */
  id: string;
  /** グリッド上の横幅。full は 2 列ぶち抜き、half は 1 列。 */
  span: "full" | "half";
  /** サーバー側で描画済みのモジュールノード */
  node: ReactNode;
};

export type ReorderableGuestInfoContainerProps = {
  tiles: GuestInfoTile[];
};

/**
 * ゲスト情報モジュールを iPhone のホーム画面のように
 * 「長押しで掴んでドラッグ＆ドロップ」で並び替えできるグリッド。
 * 並び順は画面内 state でのみ保持する（リロードで初期順に戻る）。
 */
export function ReorderableGuestInfoContainer({
  tiles: initialTiles,
}: ReorderableGuestInfoContainerProps) {
  const [tiles, setTiles] = useState(initialTiles);
  const [isDragging, setIsDragging] = useState(false);

  // 長押し（250ms）で掴む。指でのスクロールと区別するため移動許容量を持たせる。
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(_event: DragStartEvent) {
    setIsDragging(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTiles((prev) => {
      const from = prev.findIndex((t) => t.id === active.id);
      const to = prev.findIndex((t) => t.id === over.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setIsDragging(false)}
    >
      <SortableContext
        items={tiles.map((t) => t.id)}
        strategy={rectSortingStrategy}
      >
        <ul className="grid grid-cols-2 gap-4">
          {tiles.map((tile) => (
            <SortableTile key={tile.id} tile={tile} jiggle={isDragging} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableTile({
  tile,
  jiggle,
}: {
  tile: GuestInfoTile;
  jiggle: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id });

  return (
    <li
      ref={setNodeRef}
      data-tile-id={tile.id}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        // touch-action は none にしない: 長押し(delay)で掴むため、
        // 通常のスワイプはページスクロールに使えるようにする。
        "list-none outline-none",
        tile.span === "full" ? "col-span-2" : "col-span-1",
        // 掴んでいるタイルは最前面に持ち上げる
        isDragging && "z-10",
      )}
      {...attributes}
      {...listeners}
    >
      {/* 揺れ／持ち上げは内側の要素に当て、dnd-kit の移動 transform と衝突させない */}
      <div
        className={cn(
          "h-full",
          isDragging
            ? "scale-105 opacity-90 shadow-2xl"
            : jiggle && "animate-guest-jiggle",
        )}
      >
        {tile.node}
      </div>
    </li>
  );
}
