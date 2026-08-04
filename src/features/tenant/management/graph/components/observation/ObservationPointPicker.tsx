import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Checkbox, CheckboxGroup } from "@/components/ui/checkbox";
import type { AliveEdgesStatus } from "@/features/tenant/webrtc/hooks/useAliveEdges";
import type { AliveEdge } from "@/features/tenant/webrtc/type";
import { cn } from "@/lib/utils";
import { buildObservationPointRows } from "./observationPointRows";

/**
 * 観測点ピッカーに渡す選択肢データ一式。
 * 中間層はこの1つを受け取ってそのまま展開する（`{...observationPoints}`）。
 */
export type ObservationPointsSource = {
  /** 現在接続中の観測点 */
  available: AliveEdge[];
  status?: AliveEdgesStatus;
  /** いずれかの要素で使用中（＝他では選択不可）の観測点 ID 集合 */
  usedIds: ReadonlySet<string>;
  onRefresh?: () => void;
};

export type ObservationPointPickerProps = ObservationPointsSource & {
  /** この要素に紐づけ済みの観測点 ID */
  linkedIds: string[];
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
  const t = useTranslations("Graph.observationPoints");

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <p className="font-medium text-[11px] text-muted-foreground">
          {linkedIds.length > 0
            ? t("titleWithCount", { count: linkedIds.length })
            : t("title")}
        </p>
        {onRefresh ? (
          <Button
            variant="link"
            onPress={onRefresh}
            isDisabled={loading}
            className="h-auto px-1 py-0 text-[10px]"
          >
            {t("refresh")}
          </Button>
        ) : null}
      </div>

      {status === "error" ? (
        <p className="text-[10px] text-destructive">{t("error")}</p>
      ) : rows.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          {loading ? t("loading") : t("empty")}
        </p>
      ) : (
        <CheckboxGroup
          aria-label={t("title")}
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
                      title={row.online ? t("online") : t("offline")}
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
                      {t("usedByOther")}
                    </span>
                  ) : !row.online ? (
                    <span className="block text-[9px] text-muted-foreground">
                      {t("offline")}
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
