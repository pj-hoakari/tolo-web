"use client";

import {
  Building2,
  CircleHelp,
  FileUp,
  Sparkles,
  Trees,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18n } from "../../i18n/i18n";

// 始め方のカード：白紙の地図を開いたときに、地図の真ん中に出す。
// 初めての人が「何から始めればいいか」で迷わないよう、始め方を 4 つと、地図ができるまでの 4 ステップだけを見せる。
// 何かを描く・見本を開く・閉じるで消える
export function StartCard({
  onSample,
  onBuilding,
  onSingle,
  onImport,
  onHelp,
  onClose,
}: {
  onSample: () => void;
  onBuilding: () => void;
  onSingle: () => void;
  onImport: () => void;
  onHelp: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const starts = [
    {
      key: "sample",
      title: t("見本から始める"),
      text: t("できあがった地図（KCG本館）を開いて、さわりながら覚えます"),
      Icon: Sparkles,
      run: onSample,
    },
    {
      key: "building",
      title: t("建物を白紙から作る"),
      text: t("校舎やビルなど。1F から階を増やしていきます"),
      Icon: Building2,
      run: onBuilding,
    },
    {
      key: "single",
      title: t("階のない会場を作る"),
      text: t("屋外のお祭り会場や広場など、1枚の地図で作ります"),
      Icon: Trees,
      run: onSingle,
    },
    {
      key: "import",
      title: t("ファイルを読み込む"),
      text: t("前に書き出した地図の続きを作ります"),
      Icon: FileUp,
      run: onImport,
    },
  ];
  const steps = [
    t("部屋を描く"),
    t("名前を付ける"),
    t("階段・エレベーターを置く"),
    t("書き出す"),
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-6">
      <section
        aria-labelledby="start-card-title"
        className="studio-fade pointer-events-auto relative w-full max-w-xl rounded-xl border bg-card p-6 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.3)]"
      >
        <Button
          variant="ghost"
          size="icon"
          onPress={onClose}
          aria-label={t("閉じる")}
          className="absolute top-3 right-3 size-8 text-muted-foreground"
        >
          <X className="size-4" />
        </Button>
        <h2 id="start-card-title" className="text-base font-medium">
          {t("案内マップを作りましょう")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("まず、どこから始めるか選んでください。")}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {starts.map(({ key, title, text, Icon, run }) => (
            <Button
              key={key}
              variant="outline"
              onPress={run}
              className={cn(
                "h-auto items-start justify-start gap-3 p-3 text-left whitespace-normal",
                key === "sample" && "border-primary",
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{title}</span>
                <span className="block text-xs leading-relaxed font-normal text-muted-foreground">
                  {text}
                </span>
              </span>
            </Button>
          ))}
        </div>
        <ol className="mt-5 grid grid-cols-4 gap-2 text-center text-xs">
          {steps.map((s, i) => (
            <li key={s} className="flex flex-col items-center gap-1">
              <span className="flex size-6 items-center justify-center rounded-full bg-accent font-mono text-[11px] text-primary">
                {i + 1}
              </span>
              <span className="leading-tight">{s}</span>
            </li>
          ))}
        </ol>
        <Button
          variant="link"
          onPress={onHelp}
          className="mt-3 h-auto gap-1 p-0 text-xs"
        >
          <CircleHelp className="size-3.5" />
          {t("わからないときは「使い方（Q&A）」を見る")}
        </Button>
      </section>
    </div>
  );
}
