"use client";

import { Archive, Ellipsis } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Menu, MenuItem, MenuPopover, MenuTrigger } from "@/components/ui/menu";
import { errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import { EVENT_ERROR_MESSAGES } from "./errorMessages";
import type { TenantEvent } from "./type";

type Props = {
  event: TenantEvent;
  onArchived: () => void;
  actionsLabel: string;
};

export function ArchiveEventDialog({ event, onArchived, actionsLabel }: Props) {
  const t = useTranslations("TenantManagement.archive");
  const tError = useTranslations("TenantManagement");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  async function archive(close: () => void) {
    setSubmitting(true);
    setError(null);
    try {
      await orpc.tenant.archiveEvent({ eventId: event.eventId });
      close();
      onArchived();
    } catch (err) {
      setError(tError(errorMessageKey(err, EVENT_ERROR_MESSAGES.archive)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <MenuTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label={actionsLabel}
        >
          <Ellipsis aria-hidden className="size-4" />
        </Button>
        <MenuPopover placement="bottom end">
          <Menu aria-label={actionsLabel}>
            <MenuItem
              textValue={t("button")}
              onAction={() => {
                setError(null);
                setIsOpen(true);
              }}
            >
              <Archive aria-hidden className="size-4" />
              {t("button")}
            </MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>
      <DialogOverlay
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        isDismissable={!submitting}
      >
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
    </>
  );
}
