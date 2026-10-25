import { useTranslations } from "next-intl";
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
import type { EdgeDirection } from "../../type";
import { PropertyNotice } from "./PropertyNotice";

export type EdgeDirectionFieldProps = {
  value: EdgeDirection | null;
  bothDisabled?: boolean;
  onewayDisabled?: boolean;
  /** 方向を変更できない理由。表示不要なら null */
  reason?: string | null;
  onChange: (direction: EdgeDirection) => void;
};

/** ルートの通行方向（両通行 / 片方向）を切り替えるトグル */
export function EdgeDirectionField({
  value,
  bothDisabled = false,
  onewayDisabled = false,
  reason = null,
  onChange,
}: EdgeDirectionFieldProps) {
  const t = useTranslations("Graph.properties");

  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">
        {t("direction")}
      </p>
      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={value ? [value] : []}
        onSelectionChange={(keys) => {
          const next = [...keys][0] as EdgeDirection | undefined;
          if (next) onChange(next);
        }}
        className="w-full gap-1 rounded-md bg-muted p-1"
      >
        <Toggle
          id="both"
          isDisabled={bothDisabled}
          className="selected:bg-background selected:text-foreground selected:shadow-sm h-auto flex-1 rounded-sm px-2 py-1 text-xs font-medium"
        >
          {t("both")}
        </Toggle>
        <Toggle
          id="oneway"
          isDisabled={onewayDisabled}
          className="selected:bg-background selected:text-foreground selected:shadow-sm h-auto flex-1 rounded-sm px-2 py-1 text-xs font-medium"
        >
          {t("oneway")}
        </Toggle>
      </ToggleButtonGroup>
      {reason ? (
        <div className="mt-1">
          <PropertyNotice message={reason} />
        </div>
      ) : null}
    </div>
  );
}
