import { useTranslations } from "next-intl";
import { memo } from "react";

export type BroadcastIndicatorProps = {
  active: boolean;
  edgeId: string | null;
};

function BroadcastIndicatorComponent({
  active,
  edgeId,
}: BroadcastIndicatorProps) {
  const t = useTranslations("Webrtc.broadcast");

  return (
    <div className="flex w-full max-w-3xl flex-col gap-1 text-sm text-muted-foreground">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`inline-block h-2 w-2 rounded-full ${
            active ? "bg-red-500" : "bg-muted-foreground/40"
          }`}
        />
        <span>{active ? t("active") : t("inactive")}</span>
      </div>
      {edgeId && <span className="text-xs break-all">edge ID: {edgeId}</span>}
    </div>
  );
}

export const BroadcastIndicator = memo(BroadcastIndicatorComponent);
