import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
import { getNodeTypeDef } from "../../nodeTypes";
import type { GraphNotice, NodeType } from "../../type";
import { NodeTypeIcon } from "../NodeTypeIcon";
import type { NodeTypeOption } from "./nodeTypeOptions";
import { PropertyNotice } from "./PropertyNotice";

export type NodeTypeSelectorProps = {
  value: NodeType;
  /** 各タイプの選択可否（`buildNodeTypeOptions` の結果） */
  options: NodeTypeOption[];
  /** 選択中のタイプに紐づく通知（強調表示用） */
  notices?: GraphNotice[];
  onChange: (type: NodeType) => void;
};

/** ノードタイプを1つ選ぶトグル群。選択できないタイプにはその理由を添える */
export function NodeTypeSelector({
  value,
  options,
  notices,
  onChange,
}: NodeTypeSelectorProps) {
  return (
    <div>
      <p className="mb-1 font-medium text-[11px] text-muted-foreground">
        タイプ
      </p>
      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const next = [...keys][0] as NodeType | undefined;
          if (next) onChange(next);
        }}
        className="flex-col items-stretch gap-1"
      >
        {options.map((option) => {
          const def = getNodeTypeDef(option.type);
          const selected = option.type === value;
          return (
            <div key={option.type} className="space-y-0.5">
              <Toggle
                id={option.type}
                variant="outline"
                isDisabled={!option.assignable}
                className="h-auto w-full flex-col items-start gap-0.5 selected:border-primary selected:bg-accent px-2 py-1.5 text-left"
              >
                <span className="flex items-center gap-1.5 font-medium text-foreground text-xs">
                  <NodeTypeIcon type={def.type} />
                  {def.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {def.description}
                </span>
              </Toggle>
              {option.disabledReason ? (
                <PropertyNotice message={option.disabledReason} />
              ) : null}
              {selected
                ? notices?.map((notice) => (
                    <PropertyNotice
                      className="mt-2"
                      key={notice.message}
                      level={notice.level}
                      message={notice.message}
                    />
                  ))
                : null}
            </div>
          );
        })}
      </ToggleButtonGroup>
    </div>
  );
}
