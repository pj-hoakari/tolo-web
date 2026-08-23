import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/field";
import { Input, TextField } from "@/components/ui/textfield";
import { type Locale, localeLabels } from "@/i18n/locale";
import type { GroupNodeType } from "../../type";
import { resolveLabel } from "../../utils/labels";
import { SelectionHeader } from "./SelectionHeader";

export type GroupPropertiesProps = {
  group: GroupNodeType;
  /** ラベルの編集言語（ポイントと共通） */
  labelLocale: Locale;
  /** 編集言語のラベルを更新する（空文字はその言語のラベル削除） */
  onChangeLabel: (label: string) => void;
};

/**
 * グループ（論理グルーピング）を選択しているときの編集フォーム。
 * グループはエンジンへ渡すポイントではないため、編集できるのはラベルのみ。
 */
export function GroupProperties({
  group,
  labelLocale,
  onChangeLabel,
}: GroupPropertiesProps) {
  const t = useTranslations("Graph.properties");

  const fallback = resolveLabel(group.data.labels, labelLocale);

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <SelectionHeader kind="group" id={group.id} />

      <TextField
        value={group.data.labels[labelLocale] ?? ""}
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

      <p className="text-muted-foreground text-xs">{t("groupHint")}</p>
    </div>
  );
}
