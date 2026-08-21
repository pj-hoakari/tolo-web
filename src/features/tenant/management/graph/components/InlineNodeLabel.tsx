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
  editValue,
  isFallback = false,
  languageName,
  onUpdate,
}: {
  id: string;
  /** 表示するラベル（多言語のポイントではフォールバック解決済みの文字列） */
  label: string;
  /**
   * 編集対象の値。フォールバック表示中は label と異なる。
   * 未指定なら label をそのまま編集する（グループなど言語を持たないラベル）
   */
  editValue?: string;
  /** label が編集言語のラベルではなく、他言語からのフォールバックであることを示す */
  isFallback?: boolean;
  /** 編集言語の表示名。指定すると編集欄の aria-label に言語を含める */
  languageName?: string;
  onUpdate: ((id: string, label: string) => void) | undefined;
}) {
  const editingValue = editValue ?? label;
  const [isEditing, setIsEditing] = useState(false);
  const [draftLabel, setDraftLabel] = useState(editingValue);
  const isFinishing = useRef(false);
  const t = useTranslations("Graph.node");

  useEffect(() => {
    if (!isEditing) setDraftLabel(editingValue);
  }, [isEditing, editingValue]);

  const startEditing = () => {
    isFinishing.current = false;
    setDraftLabel(editingValue);
    setIsEditing(true);
  };

  const finishEditing = (commit: boolean) => {
    if (isFinishing.current) return;
    isFinishing.current = true;
    if (commit && draftLabel !== editingValue) onUpdate?.(id, draftLabel);
    setIsEditing(false);
  };

  // 編集言語のラベルが未設定（フォールバック表示）のときは控えめに表示する
  const labelClass = isFallback
    ? "font-normal text-muted-foreground italic"
    : "font-semibold text-foreground";

  if (!onUpdate) {
    return <div className={`text-left text-sm ${labelClass}`}>{label}</div>;
  }

  return (
    <div className="relative self-start">
      <Button
        aria-label={t("editLabel", { label })}
        variant="ghost"
        isDisabled={isEditing}
        className={`nodrag nowheel h-auto min-h-0 w-fit max-w-full whitespace-normal rounded-sm px-0 py-0 text-left text-sm ${labelClass}`}
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
            aria-label={
              languageName !== undefined
                ? t("labelFieldWithLanguage", { language: languageName })
                : t("labelField")
            }
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
