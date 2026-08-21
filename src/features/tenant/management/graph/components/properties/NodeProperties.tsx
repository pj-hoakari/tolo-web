import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/field";
import { Input, TextField } from "@/components/ui/textfield";
import { type Locale, localeLabels } from "@/i18n/locale";
import type { GraphNodeData, GraphNodeType } from "../../type";
import { resolveLabel } from "../../utils/labels";
import { NodeTypeSelector } from "./NodeTypeSelector";
import type { NodeTypeOption } from "./nodeTypeOptions";
import { SelectionHeader } from "./SelectionHeader";

export type NodePropertiesProps = {
  node: GraphNodeType;
  /** 各ノードタイプの選択可否（`buildNodeTypeOptions` の結果） */
  typeOptions: NodeTypeOption[];
  /** ラベルの編集言語 */
  labelLocale: Locale;
  onChange: (patch: Partial<GraphNodeData>) => void;
  /** 編集言語のラベルを更新する（空文字はその言語のラベル削除） */
  onChangeLabel: (label: string) => void;
};

/**
 * ポイント（ノード）を選択しているときの編集フォーム。
 * 扱うのはグラフ構造そのものだけで、観測点の紐づけは表示側
 * （`ObservationLinkPanel`）が担当する。
 */
export function NodeProperties({
  node,
  typeOptions,
  labelLocale,
  onChange,
  onChangeLabel,
}: NodePropertiesProps) {
  const t = useTranslations("Graph.properties");

  const fallback = resolveLabel(node.data.labels, labelLocale);

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <SelectionHeader kind="node" id={node.id} />

      <TextField
        value={node.data.labels[labelLocale] ?? ""}
        onChange={onChangeLabel}
        className="flex flex-col gap-1"
      >
        <Label className="text-[11px] text-muted-foreground">
          {t("labelWithLanguage", { language: localeLabels[labelLocale] })}
        </Label>
        <Input
          className="h-auto px-2 py-1 text-xs"
          // 編集言語のラベルが未設定のときは、フォールバック表示中の値を目印に出す
          placeholder={fallback.isFallback ? fallback.text : undefined}
        />
      </TextField>

      <NodeTypeSelector
        value={node.data.nodeType}
        options={typeOptions}
        notices={node.data.notices}
        onChange={(nodeType) => onChange({ nodeType })}
      />
    </div>
  );
}
