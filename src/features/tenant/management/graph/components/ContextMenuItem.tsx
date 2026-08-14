import type { LucideIcon } from "lucide-react";
import { isValidElement, type ReactElement } from "react";
import { Text } from "react-aria-components";
import { MenuItem } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { useContextMenuClose } from "./ContextMenuPopover";

export type ContextMenuItemProps = {
  id: string;
  /** Lucide アイコンはコンポーネントのまま渡すと標準サイズで描画する。自前描画の要素も渡せる */
  icon: LucideIcon | ReactElement;
  label: string;
  /** 無効時の理由など、ラベルの下に添える説明 */
  description?: string | null;
  isDisabled?: boolean;
  /** destructive は削除系の操作に付ける見た目 */
  variant?: "default" | "destructive";
  onAction: () => void;
};

/**
 * コンテキストメニュー共通の項目。
 * アイコン付きラベルの描画と、操作後にメニューを閉じる処理をまとめる。
 * ContextMenuPopover の配下に置くこと。
 */
export function ContextMenuItem({
  id,
  icon,
  label,
  description,
  isDisabled,
  variant = "default",
  onAction,
}: ContextMenuItemProps) {
  const close = useContextMenuClose();

  return (
    <MenuItem
      id={id}
      textValue={label}
      isDisabled={isDisabled}
      className={cn(
        variant === "destructive" &&
          "text-destructive focus:bg-destructive/10 focus:text-destructive",
      )}
      onAction={() => {
        onAction();
        close();
      }}
    >
      {renderIcon(icon)}
      <div className="flex min-w-0 flex-col gap-0.5">
        <Text slot="label">{label}</Text>
        {description ? (
          <Text slot="description" className="text-muted-foreground text-xs">
            {description}
          </Text>
        ) : null}
      </div>
    </MenuItem>
  );
}

function renderIcon(icon: LucideIcon | ReactElement) {
  if (isValidElement(icon)) return icon;
  const Icon = icon;
  return <Icon aria-hidden className="size-4 shrink-0" />;
}
