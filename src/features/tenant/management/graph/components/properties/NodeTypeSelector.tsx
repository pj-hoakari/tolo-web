import { useTranslations } from "next-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { GraphNotice, NodeType } from "../../type";
import type { NodeTypeOption } from "./nodeTypeOptions";
import { PropertyNotice } from "./PropertyNotice";

export type NodeTypeSelectorProps = {
  /** 各フラグの状態と切り替え可否（`buildNodeTypeOptions` の結果） */
  options: NodeTypeOption[];
  /** 選択中のタイプに紐づく通知（強調表示用） */
  notices?: GraphNotice[];
  onChange: (type: NodeType) => void;
};

/** ノードタイプを「停滞を許容するか」「目的地か」のフラグで切り替える。切り替えられないときはその理由を添える */
export function NodeTypeSelector({
  options,
  notices,
  onChange,
}: NodeTypeSelectorProps) {
  const t = useTranslations("Graph.properties");
  const tFlag = useTranslations("Graph.nodeTypeFlag");
  const tDescription = useTranslations("Graph.nodeTypeFlagDescription");
  const tNotice = useTranslations("Graph.notices");

  return (
    <div>
      <p className="mb-1 text-[11px] font-medium text-muted-foreground">
        {t("type")}
      </p>
      <div className="space-y-1.5">
        {options.map((option) => (
          <div
            key={option.flag}
            className={cn(
              "space-y-0.5",
              option.flag === "destination" && "ml-6",
            )}
          >
            <Checkbox
              isSelected={option.checked}
              isDisabled={!option.assignable}
              onChange={() => onChange(option.next)}
              className="items-start"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">
                  {tFlag(option.flag)}
                </span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  {tDescription(option.flag)}
                </span>
              </span>
            </Checkbox>
            {option.disabledReason ? (
              <PropertyNotice message={option.disabledReason} />
            ) : null}
          </div>
        ))}
      </div>
      {notices?.map((notice) => (
        <PropertyNotice
          className="mt-2"
          key={notice.messageKey}
          level={notice.level}
          message={tNotice(notice.messageKey)}
        />
      ))}
    </div>
  );
}
