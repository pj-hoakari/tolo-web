"use client";

import { useTranslations } from "next-intl";
import type { KeyboardEvent, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, TextField } from "@/components/ui/textfield";

/**
 * ノード内に表示するラベル。編集コールバックがあるときは、
 * クリックで編集に切り替わる。
 * "inline" はノードのサイズを変えないポップアップ、
 * "box" はボックスがその場で入力欄になるインプレース編集。
 */
export function InlineNodeLabel({
  id,
  kind = "node",
  appearance = "inline",
  label,
  editValue,
  isFallback = false,
  languageName,
  onUpdate,
  onEditStart,
}: {
  id: string;
  /** 編集欄の aria-label をポイント / グループで出し分ける */
  kind?: "node" | "group";
  /**
   * 表示の外観。
   * "inline" はノード内に文字だけを置く既定の見た目、
   * "box" は枠線・背景付きのボックス（グループの枠線に重ねる用途）。
   */
  appearance?: "inline" | "box";
  /** 表示するラベル（フォールバック解決済みの文字列） */
  label: string;
  /**
   * 編集対象の値。フォールバック表示中は label と異なる。
   * 未指定なら label をそのまま編集する
   */
  editValue?: string;
  /** label が編集言語のラベルではなく、他言語からのフォールバックであることを示す */
  isFallback?: boolean;
  /** 編集言語の表示名。指定すると編集欄の aria-label に言語を含める */
  languageName?: string;
  onUpdate: ((id: string, label: string) => void) | undefined;
  /** 編集を開始した瞬間に呼ぶ。ノードの選択状態も合わせたいときに使う */
  onEditStart?: () => void;
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
    onEditStart?.();
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

  // ボックス表示は枠線・背景を持ち、点線コンテナの縁に重ねても読めるようにする
  const isBox = appearance === "box";
  const boxClass = isBox
    ? "w-fit max-w-full whitespace-normal rounded-md border border-border bg-card px-2 py-0.5 shadow-sm"
    : "";
  // ボックスはクリックできることが分かるように、ホバーで枠線と背景を変える
  const boxInteractiveClass = isBox
    ? "hover:border-muted-foreground hover:bg-accent"
    : "";

  if (!onUpdate) {
    return (
      <div className={`text-left text-sm ${boxClass} ${labelClass}`}>
        {label}
      </div>
    );
  }

  const fieldAriaLabel =
    kind === "group"
      ? languageName !== undefined
        ? t("groupLabelFieldWithLanguage", { language: languageName })
        : t("groupLabelField")
      : languageName !== undefined
        ? t("labelFieldWithLanguage", { language: languageName })
        : t("labelField");

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
  };
  const stopPointerDown = (event: PointerEvent<HTMLInputElement>) =>
    event.stopPropagation();

  // ボックス表示は、ポップアップを重ねずにボックス自体を入力欄へ差し替える。
  // 幅は inline-grid のミラー（不可視の span）で内容に追従させ、右方向へ伸ばす。
  // 伸びる上限は親（グループ幅）の max-width に任せ、超えた分は入力内で横スクロールさせる。
  if (isBox && isEditing) {
    return (
      <div className="relative self-start">
        {/* 枠は素の div。TextField は data-rac を持ち、
            focus-within 変種が data-focus-within 待ちになってしまうため */}
        <div
          className={`inline-grid grid-cols-[minmax(0,max-content)] overflow-hidden focus-within:border-ring focus-within:ring-1 focus-within:ring-ring ${boxClass}`}
        >
          <span
            aria-hidden
            className="invisible col-start-1 row-start-1 whitespace-pre text-left font-semibold text-sm"
          >
            {draftLabel || " "}
          </span>
          {/* display: contents で、Input を外側のグリッドの子として扱わせる */}
          <TextField
            value={draftLabel}
            onChange={setDraftLabel}
            className="contents"
          >
            <Input
              aria-label={fieldAriaLabel}
              autoFocus
              // w-0 + min-w-full: 入力欄の既定の固有幅（20 文字分）をグリッドの
              // 幅計算から外し、幅をミラーだけで決めさせたうえでセルいっぱいに広げる
              className="nodrag nowheel col-start-1 row-start-1 h-auto w-0 min-w-full rounded-none border-none bg-transparent p-0 text-left font-semibold text-sm focus:ring-0 focus:ring-offset-0"
              onBlur={() => finishEditing(true)}
              onKeyDown={handleKeyDown}
              onPointerDown={stopPointerDown}
            />
          </TextField>
        </div>
      </div>
    );
  }

  return (
    <div className="relative self-start">
      <Button
        aria-label={t("editLabel", { label })}
        variant="ghost"
        isDisabled={isEditing}
        className={`nodrag nowheel h-auto min-h-0 w-fit max-w-full whitespace-normal rounded-sm px-0 py-0 text-left text-sm ${boxClass} ${boxInteractiveClass} ${labelClass}`}
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
            aria-label={fieldAriaLabel}
            autoFocus
            className="nodrag nowheel h-8 w-full border-none bg-popover px-2 text-left font-semibold text-sm"
            onBlur={() => finishEditing(true)}
            onKeyDown={handleKeyDown}
            onPointerDown={stopPointerDown}
          />
        </TextField>
      ) : null}
    </div>
  );
}
