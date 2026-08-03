import { Panel } from "@xyflow/react";
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
  return (
    <Panel position="top-center">
      <div className="flex items-center rounded-md border border-primary bg-card px-3 py-2 text-foreground text-sm shadow-sm">
        <div>
          {fromNode
            ? "ルートを追加: 終点にするポイントをクリック"
            : "ルートを追加: ポイントから別のポイントへドラッグ"}
          <span className="ml-2 text-muted-foreground text-xs">
            Esc でキャンセル
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="ml-3 h-7"
          onPress={onEnd}
        >
          ルート追加を終了
        </Button>
      </div>
    </Panel>
  );
}
