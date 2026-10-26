"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function EventId({ id, name }: { id: string; name: string }) {
  const t = useTranslations("TenantManagement.list");
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">(
    "idle",
  );

  async function copy() {
    setStatus("copying");
    try {
      await navigator.clipboard.writeText(id);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="sr-only">{t("idLabel")}: </span>
        <code className="min-w-0 select-text break-all font-mono text-xs not-italic">
          {id}
        </code>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 md:size-6"
          aria-label={t("copyId", { name })}
          onPress={copy}
          isDisabled={status === "copying"}
        >
          {status === "copied" ? (
            <Check aria-hidden className="size-3.5" />
          ) : (
            <Copy aria-hidden className="size-3.5" />
          )}
        </Button>
      </div>
      {status === "copied" && (
        <span role="status" className="sr-only">
          {t("idCopied", { name })}
        </span>
      )}
      {status === "error" && (
        <p role="alert" className="mt-1 text-destructive text-xs">
          {t("copyFailed")}
        </p>
      )}
    </div>
  );
}
