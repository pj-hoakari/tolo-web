import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxGroup } from "@/components/ui/checkbox";
import type { AliveEdgesStatus } from "@/features/tenant/webrtc/hooks/useAliveEdges";
import type { AliveEdge } from "@/features/tenant/webrtc/type";
import { cn } from "@/lib/utils";
import { buildObservationPointRows } from "./observationPointRows";

export type ObservationPointPickerProps = {
  /** この要素に紐づけ済みの観測点 ID */
  linkedIds: string[];
  /** 現在接続中の観測点 */
  available: AliveEdge[];
  status?: AliveEdgesStatus;
  /** いずれかの要素で使用中（＝他では選択不可）の観測点 ID 集合 */
  usedIds: ReadonlySet<string>;
  onRefresh?: () => void;
  onChange: (ids: string[]) => void;
};

/**
 * 観測点（接続中のエッジ）をノード/ルートに紐づけるピッカー
 * 接続中の観測点+紐づけ済みだが現在オフラインの観測点
 * いずれかの要素で使用中の観測点は、この要素で未選択なら選択不可
 */
export function ObservationPointPicker({
  linkedIds,
  available,
  status,
  usedIds,
  onRefresh,
  onChange,
}: ObservationPointPickerProps) {
  const rows = buildObservationPointRows(linkedIds, available);
  const loading = status === "loading";

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="font-medium text-[11px] text-muted-foreground">
          観測点{linkedIds.length > 0 ? `（${linkedIds.length}）` : ""}
        </p>
        {onRefresh ? (
          <Button
            variant="link"
            onPress={onRefresh}
            isDisabled={loading}
            className="h-auto px-1 py-0 text-[10px]"
          >
            更新
          </Button>
        ) : null}
      </div>

      {status === "error" ? (
        <p className="text-[10px] text-destructive">
          観測点の取得に失敗しました
        </p>
      ) : rows.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          {loading ? "読み込み中…" : "接続中の観測点がありません"}
        </p>
      ) : (
        <CheckboxGroup
          aria-label="観測点"
          value={linkedIds}
          onChange={onChange}
          className="space-y-1"
        >
          {rows.map((row) => {
            const checked = linkedIds.includes(row.id);
            // 自分で選択済みは解除可。他で使用中の未選択のみ選択不可
            const disabled = !checked && usedIds.has(row.id);
            return (
              <Checkbox
                key={row.id}
                value={row.id}
                isDisabled={disabled}
                className="w-full items-start rounded-md border border-border selected:border-primary selected:bg-accent px-2 py-1.5 font-normal hover:bg-accent"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span
                      aria-hidden
                      title={row.online ? "接続中" : "オフライン"}
                      className={cn(
                        "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                        row.online
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/40",
                      )}
                    />
                    <span className="break-all font-mono text-[10px] text-muted-foreground">
                      {row.id}
                    </span>
                  </span>
                  {disabled ? (
                    <span className="block text-[9px] text-amber-600 dark:text-amber-400">
                      他のポイント / ルートで使用中
                    </span>
                  ) : !row.online ? (
                    <span className="block text-[9px] text-muted-foreground">
                      オフライン
                    </span>
                  ) : null}
                </span>
              </Checkbox>
            );
          })}
        </CheckboxGroup>
      )}
    </div>
  );
}
