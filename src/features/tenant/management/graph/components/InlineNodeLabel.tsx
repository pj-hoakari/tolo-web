"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, TextField } from "@/components/ui/textfield";

/**
 * ノード内に表示するラベル。編集コールバックがあるときは、
 * クリックでノードのサイズを変えないポップアップ編集に切り替わる。
 */
export function InlineNodeLabel({
  id,
  label,
  onUpdate,
}: {
  id: string;
  label: string;
  onUpdate: ((id: string, label: string) => void) | undefined;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(label);
  const isFinishing = useRef(false);
  const t = useTranslations("Graph.node");

  useEffect(() => {
    if (!isEditing) setDraftLabel(label);
  }, [isEditing, label]);

  const startEditing = () => {
    isFinishing.current = false;
    setDraftLabel(label);
    setIsEditing(true);
  };

  const finishEditing = (commit: boolean) => {
    if (isFinishing.current) return;
    isFinishing.current = true;
    if (commit && draftLabel !== label) onUpdate?.(id, draftLabel);
    setIsEditing(false);
  };

  if (!onUpdate) {
    return (
      <div className="text-left font-semibold text-foreground text-sm">
        {label}
      </div>
    );
  }

  return (
    <div className="relative self-start">
      <Button
        aria-label={t("editLabel", { label })}
        variant="ghost"
        isDisabled={isEditing}
        className="nodrag nowheel h-auto min-h-0 w-fit max-w-full whitespace-normal rounded-sm px-0 py-0 text-left font-semibold text-foreground text-sm"
        onPointerDown={(event) => event.stopPropagation()}
        onPress={startEditing}
      >
        {label}
      </Button>
      {isEditing ? (
        <TextField
          value={draftLabel}
          onChange={setDraftLabel}
          className="absolute top-1/2 left-1/2 z-10 w-56 -translate-x-1/2 -translate-y-1/2"
        >
          <Input
            aria-label={t("labelField")}
            autoFocus
            className="nodrag nowheel h-8 w-full border-none bg-popover px-2 text-left font-semibold text-sm"
            onBlur={() => finishEditing(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                finishEditing(true);
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                finishEditing(false);
              }
            }}
            onPointerDown={(event) => event.stopPropagation()}
          />
        </TextField>
      ) : null}
    </div>
  );
}
