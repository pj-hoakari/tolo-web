"use client";

import { ChevronDown } from "lucide-react";
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
import { EventStatusBadge } from "./EventStatusBadge";
import { EVENT_ERROR_MESSAGES } from "./errorMessages";
import {
  EVENT_STATUS_TRANSITIONS,
  type EventStatus,
  type TenantEvent,
} from "./type";

export function EventStatusControl({
  event,
  onChanged,
}: {
  event: TenantEvent;
  onChanged: (updated: TenantEvent) => void;
}) {
  const t = useTranslations("TenantManagement");
  const [target, setTarget] = useState<EventStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = t("transition.button", {
    name: event.name,
    status: t(`status.${event.status}`),
  });

  async function change(close: () => void) {
    if (!target || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await orpc.tenant.transitionEventStatus({
        eventId: event.eventId,
        to: target,
      });
      close();
      onChanged(updated);
    } catch (err) {
      setError(t(errorMessageKey(err, EVENT_ERROR_MESSAGES.transition)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <MenuTrigger>
        <Button
          variant="ghost"
          className="h-auto min-h-10 max-w-full rounded-md p-0"
          aria-label={label}
        >
          <EventStatusBadge status={event.status}>
            <ChevronDown aria-hidden className="size-3 shrink-0" />
          </EventStatusBadge>
        </Button>
        <MenuPopover placement="bottom start">
          <Menu aria-label={label}>
            <MenuItem id="draft" isDisabled>
              {t("status.draft")}
            </MenuItem>
            {EVENT_STATUS_TRANSITIONS[event.status].map((status) => (
              <MenuItem
                key={status}
                id={status}
                onAction={() => {
                  setError(null);
                  setTarget(status);
                }}
              >
                {t(`status.${status}`)}
              </MenuItem>
            ))}
          </Menu>
        </MenuPopover>
      </MenuTrigger>
      <DialogOverlay
        isOpen={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
        isDismissable={!submitting}
        isKeyboardDismissDisabled={submitting}
      >
        <DialogContent closeButton={false}>
          {({ close }) => (
            <>
              <DialogHeader>
                <DialogTitle>{t("transition.title")}</DialogTitle>
                <DialogDescription>
                  {target &&
                    t("transition.description", {
                      name: event.name,
                      from: t(`status.${event.status}`),
                      to: t(`status.${target}`),
                    })}
                </DialogDescription>
              </DialogHeader>
              {target === "archived" && (
                <p className="text-muted-foreground text-sm">
                  {t("archive.description", { name: event.name })}
                </p>
              )}
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
                  {t("transition.cancel")}
                </Button>
                <Button
                  variant={target === "archived" ? "destructive" : "default"}
                  onPress={() => change(close)}
                  isDisabled={submitting}
                >
                  {t("transition.confirm")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </DialogOverlay>
    </>
  );
}
