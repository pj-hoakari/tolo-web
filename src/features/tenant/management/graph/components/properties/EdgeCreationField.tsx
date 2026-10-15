import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Key } from "react-aria-components";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import {
  Select,
  SelectItem,
  SelectListBox,
  SelectPopover,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EdgeTarget = { id: string; label: string };

export type EdgeCreationFieldProps = {
  targets: EdgeTarget[];
  onAdd: (target: string) => void;
};

export function EdgeCreationField({ targets, onAdd }: EdgeCreationFieldProps) {
  const t = useTranslations("Graph.properties");
  const [target, setTarget] = useState<Key | null>(null);

  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-3">
      <Select
        placeholder={t("edgeTargetPlaceholder")}
        selectedKey={target}
        onSelectionChange={setTarget}
        isDisabled={targets.length === 0}
        className="flex flex-col gap-1"
      >
        <Label className="text-[11px] text-muted-foreground">
          {t("edgeTarget")}
        </Label>
        <SelectTrigger className="h-auto px-2 py-1 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectPopover>
          <SelectListBox items={targets}>
            {(item) => (
              <SelectItem id={item.id} textValue={`${item.label} (${item.id})`}>
                {item.label}
                <span className="ml-auto pl-2 font-mono text-[10px] text-muted-foreground">
                  {item.id}
                </span>
              </SelectItem>
            )}
          </SelectListBox>
        </SelectPopover>
      </Select>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        isDisabled={target === null}
        onPress={() => {
          if (target !== null) onAdd(String(target));
        }}
      >
        {t("addEdge")}
      </Button>
    </div>
  );
}
