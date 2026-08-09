import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/field";
import { Input, TextField } from "@/components/ui/textfield";
import type { GroupNodeData, GroupNodeType } from "../../type";
import { SelectionHeader } from "./SelectionHeader";

export type GroupPropertiesProps = {
  group: GroupNodeType;
  onChange: (patch: Partial<GroupNodeData>) => void;
};

/**
 * グループ（論理グルーピング）を選択しているときの編集フォーム。
 * グループはエンジンへ渡すポイントではないため、編集できるのはラベルのみ。
 */
export function GroupProperties({ group, onChange }: GroupPropertiesProps) {
  const t = useTranslations("Graph.properties");

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <SelectionHeader kind="group" id={group.id} />

      <TextField
        value={group.data.label}
        onChange={(value) => onChange({ label: value })}
        className="flex flex-col gap-1"
      >
        <Label className="text-[11px] text-muted-foreground">
          {t("label")}
        </Label>
        <Input className="h-auto px-2 py-1 text-xs" />
      </TextField>

      <p className="text-muted-foreground text-xs">{t("groupHint")}</p>
    </div>
  );
}
