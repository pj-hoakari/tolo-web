"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "../../i18n/i18n";
import type { Floor } from "../../type";
import { FoldSection } from "./FoldSection";

// 選んでいる物を、別の階の同じ位置へコピーする（たたんでおき、開くと階を選べる）
export function CopyToFloorFold({
  floors,
  onCopy,
  className,
}: {
  /** コピー先に選べる階（表示中の階は除く） */
  floors: Floor[];
  onCopy: (floorId: string) => void;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <FoldSection
      className={className}
      title={
        <>
          <Copy className="size-3.5" />
          {t("別の階へコピー")}
        </>
      }
    >
      <p className="mb-1.5 leading-relaxed text-muted-foreground">
        {t("選んだ階の同じ位置にコピーします。")}
      </p>
      <div className="flex flex-wrap gap-1">
        {floors.map((f) => (
          <Button
            key={f.id}
            variant="outline"
            size="sm"
            onPress={() => onCopy(f.id)}
            className="h-7 px-2 font-mono text-xs font-normal"
          >
            {t("{floor}へ", { floor: f.name })}
          </Button>
        ))}
      </div>
    </FoldSection>
  );
}
