"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type GraphLoadStateProps = {
  status: "loading" | "error";
  onRetry: () => void;
};

/** グラフ取得中 / 失敗時にキャンバスの代わりに出す表示 */
export function GraphLoadState({ status, onRetry }: GraphLoadStateProps) {
  const t = useTranslations("Graph.load");
  return (
    <div
      role="status"
      className="flex h-full w-full flex-col items-center justify-center gap-3 text-muted-foreground text-sm"
    >
      <p>{t(status)}</p>
      {status === "error" && (
        <Button variant="outline" size="sm" onPress={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}
