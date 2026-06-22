"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type GuestInfoComponent,
  getGuestInfoComponentId,
} from "@/features/guest/info/type";
import { cn } from "@/lib/utils";

/** 1 行に並べるモジュール。配列で渡すとその行は横並び（グリッド）になる */
export type GuestInfoRow = GuestInfoComponent | GuestInfoComponent[];

export type GuestInfoContainerProps = {
  tenantId: string;
  eventId: string;
  rows: GuestInfoRow[];
};

function getRowKey(row: GuestInfoRow): string {
  return Array.isArray(row)
    ? row.map(getGuestInfoComponentId).join("-")
    : getGuestInfoComponentId(row);
}

type SortableRowProps = {
  id: string;
  components: GuestInfoComponent[];
  isGrid: boolean;
  tenantId: string;
  eventId: string;
};

function SortableRow({
  id,
  components,
  isGrid,
  tenantId,
  eventId,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-stretch gap-2",
        isDragging && "z-10 opacity-80",
      )}
    >
      <div className={cn("min-w-0 flex-1", isGrid && "grid grid-cols-2 gap-4")}>
        {components.map((Component) => (
          <div key={getGuestInfoComponentId(Component)} className="w-full">
            <Component tenantId={tenantId} eventId={eventId} />
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="ドラッグして並び替え"
        className="cursor-grab touch-none self-center active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical />
      </Button>
    </div>
  );
}

export function GuestInfoContainer({
  tenantId,
  eventId,
  rows,
}: GuestInfoContainerProps) {
  const [order, setOrder] = useState<GuestInfoRow[]>(rows);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const oldIndex = prev.findIndex((row) => getRowKey(row) === active.id);
      const newIndex = prev.findIndex((row) => getRowKey(row) === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const itemIds = order.map(getRowKey);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-4">
          {order.map((row) => (
            <SortableRow
              key={getRowKey(row)}
              id={getRowKey(row)}
              components={Array.isArray(row) ? row : [row]}
              isGrid={Array.isArray(row)}
              tenantId={tenantId}
              eventId={eventId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
