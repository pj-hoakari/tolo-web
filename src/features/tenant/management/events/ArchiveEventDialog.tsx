"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { orpc } from "@/lib/orpc";
import { serverErrorMessage } from "./serverErrorMessage";
import type { TenantEvent } from "./type";

type Props = {
  event: TenantEvent;
  onArchived: () => void;
};

export function ArchiveEventDialog({ event, onArchived }: Props) {
  const t = useTranslations("TenantManagement.archive");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archive(close: () => void) {
    setSubmitting(true);
    setError(null);
    try {
      await orpc.tenant.archiveEvent({ eventId: event.eventId });
      close();
      onArchived();
    } catch (err) {
      setError(serverErrorMessage(err) ?? t("failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogTrigger onOpenChange={(open) => open && setError(null)}>
      <Button variant="outline" size="sm">
        {t("button")}
      </Button>
      <DialogOverlay isDismissable={!submitting}>
        <DialogContent role="alertdialog" closeButton={false}>
          {({ close }) => (
            <>
              <DialogHeader>
                <DialogTitle>{t("title")}</DialogTitle>
                <DialogDescription>
                  {t("description", { name: event.name })}
                </DialogDescription>
              </DialogHeader>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onPress={close}
                  isDisabled={submitting}
                >
                  {t("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onPress={() => archive(close)}
                  isDisabled={submitting}
                >
                  {t("confirm")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </DialogOverlay>
    </DialogTrigger>
  );
}
