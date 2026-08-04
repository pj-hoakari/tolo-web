import { Panel } from "@xyflow/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/** ルート追加モード中に操作方法を案内するパネル。 */
export function EasyConnectPanel({
  fromNode,
  onEnd,
}: {
  /** 始点固定モードかどうか（案内文言が変わる） */
  fromNode: boolean;
  onEnd: () => void;
}) {
  const t = useTranslations("Graph.easyConnect");

  return (
    <Panel position="top-center">
      <div className="flex items-center rounded-md border border-primary bg-card px-3 py-2 text-foreground text-sm shadow-sm">
        <div>
          {fromNode ? t("fromNode") : t("fromCanvas")}
          <span className="ml-2 text-muted-foreground text-xs">
            {t("cancelHint")}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-3 h-7"
          onPress={onEnd}
        >
          {t("end")}
        </Button>
      </div>
    </Panel>
  );
}
