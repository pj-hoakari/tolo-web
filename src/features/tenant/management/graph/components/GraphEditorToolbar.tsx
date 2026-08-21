import { Network, SquareDashed } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { NODE_TYPE_DEFS } from "../nodeTypes";
import type { NodeType } from "../type";
import { type LabelLocaleBindings, LabelLocaleMenu } from "./LabelLocaleMenu";
import { NodeTypeIcon } from "./NodeTypeIcon";

export type GraphEditorToolbarProps = LabelLocaleBindings & {
  onAddNode: (type: NodeType) => void;
  onAddGroup: () => void;
  onAutoAlign: () => void;
  onSave: () => void;
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
  labelLocale,
  onChangeLabelLocale,
  labelCounts,
  pointCount,
}: GraphEditorToolbarProps) {
  const t = useTranslations("Graph.editor");
  const tType = useTranslations("Graph.nodeType");

  return (
    <div className="flex items-center justify-between gap-3 border-border border-b bg-card px-4 py-2">
      <p className="shrink-0 font-semibold text-foreground text-sm">
        {t("title")}
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {NODE_TYPE_DEFS.map((def) => (
          <Button
            key={def.type}
            variant="outline"
            size="sm"
            onPress={() => onAddNode(def.type)}
            aria-label={t("addNode", { type: tType(def.type) })}
            className="gap-1.5"
          >
            <span className="text-muted-foreground">+</span>
            <NodeTypeIcon type={def.type} />
            {tType(def.type)}
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
            pointCount={pointCount}
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
          <Button size="sm" onPress={onSave}>
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
