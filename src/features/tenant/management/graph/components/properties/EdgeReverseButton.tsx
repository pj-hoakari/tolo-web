import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PropertyNotice } from "./PropertyNotice";

export type EdgeReverseButtonProps = {
  isDisabled?: boolean;
  /** 反転できない理由。表示不要なら null */
  reason?: string | null;
  onPress: () => void;
};

/** 片方向ルートの始点と終点を入れ替えるボタン */
export function EdgeReverseButton({
  isDisabled = false,
  reason = null,
  onPress,
}: EdgeReverseButtonProps) {
  const t = useTranslations("Graph.properties");

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        onPress={onPress}
        isDisabled={isDisabled}
        className="w-full"
      >
        {t("reverse")}
      </Button>
      {reason ? <PropertyNotice message={reason} /> : null}
    </div>
  );
}
