import { Network, SquareDashed } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DEFAULT_NODE_TYPE } from "../nodeTypes";
import type { NodeType } from "../type";
import { type LabelLocaleBindings, LabelLocaleMenu } from "./LabelLocaleMenu";
import { NodeTypeIcon } from "./NodeTypeIcon";

export type GraphEditorToolbarProps = LabelLocaleBindings & {
  onAddNode: (type: NodeType) => void;
  onAddGroup: () => void;
  onAutoAlign: () => void;
  onSave: () => void;
  saveStatus: "idle" | "saving" | "saved" | "failed";
};

/**
 * グラフ構造を編集するときのツールバー
 * （ポイント・グループ追加・ラベル言語・自動整列・保存）
 */
export function GraphEditorToolbar({
  onAddNode,
  onAddGroup,
  onAutoAlign,
  onSave,
  saveStatus,
  labelLocale,
  onChangeLabelLocale,
  labelCounts,
  labelTargetCount,
}: GraphEditorToolbarProps) {
  const t = useTranslations("Graph.editor");
  const tType = useTranslations("Graph.nodeType");

  return (
    <div className="flex items-center justify-between gap-3 border-border border-b bg-card px-4 py-2">
      <p className="shrink-0 font-semibold text-foreground text-sm">
        {t("title")}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {(
          [
            { type: DEFAULT_NODE_TYPE, label: t("point") },
            { type: "EXTERNAL", label: tType("EXTERNAL") },
          ] as const
        ).map(({ type, label }) => (
          <Button
            key={type}
            variant="outline"
            size="sm"
            onPress={() => onAddNode(type)}
            aria-label={t("addNode", { type: label })}
            className="gap-1.5"
          >
            <span className="text-muted-foreground">+</span>
            <NodeTypeIcon type={type} />
            {label}
          </Button>
        ))}
        <Button
          variant="outline"
          size="sm"
          onPress={onAddGroup}
          className="gap-1.5"
        >
          <span className="text-muted-foreground">+</span>
          <SquareDashed aria-hidden className="size-4 shrink-0" />
          {t("addGroup")}
        </Button>
        <div className="ml-1 flex items-center gap-2 border-border border-l pl-2">
          <LabelLocaleMenu
            labelLocale={labelLocale}
            onChangeLabelLocale={onChangeLabelLocale}
            labelCounts={labelCounts}
            labelTargetCount={labelTargetCount}
          />
          <Button
            variant="outline"
            size="sm"
            onPress={onAutoAlign}
            className="gap-1.5"
          >
            <Network aria-hidden className="size-4 shrink-0" />
            {t("autoAlign")}
          </Button>
          <span role="status" className="text-muted-foreground text-sm">
            {saveStatus === "saved" && t("saved")}
          </span>
          <Button
            size="sm"
            onPress={onSave}
            isPending={saveStatus === "saving"}
          >
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
