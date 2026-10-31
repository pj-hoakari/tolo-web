"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Key } from "react-aria-components";
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
import { JollySelect, SelectItem } from "@/components/ui/select";
import { errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import type { TenantEvent } from "../events/type";
import { MEMBER_ERROR_MESSAGES } from "./errorMessages";
import type { TenantMember } from "./type";

type Props = {
  member: TenantMember;
  events: TenantEvent[];
  onChanged: () => void;
};

export function EventRolesDialog({ member, events, onChanged }: Props) {
  const t = useTranslations("TenantMembers");
  const [selected, setSelected] = useState<Key | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventName = (eventId: string) =>
    events.find((e) => e.eventId === eventId)?.name ?? eventId;
  const assignable = events.filter(
    (e) =>
      e.status !== "archived" &&
      !member.eventRoles.some((r) => r.eventId === e.eventId),
  );

  async function change(
    run: () => Promise<unknown>,
    messages: (typeof MEMBER_ERROR_MESSAGES)[
      | "grantEventRole"
      | "revokeEventRole"],
  ) {
    setSubmitting(true);
    setError(null);
    try {
      await run();
      setSelected(null);
      onChanged();
    } catch (err) {
      setError(t(errorMessageKey(err, messages)));
    } finally {
      setSubmitting(false);
    }
  }

  const grant = (eventId: string) =>
    change(
      () =>
        orpc.tenant.grantEventRole({
          eventId,
          userId: member.userId,
          role: member.role,
        }),
      MEMBER_ERROR_MESSAGES.grantEventRole,
    );
  const revoke = (eventId: string) =>
    change(
      () => orpc.tenant.revokeEventRole({ eventId, userId: member.userId }),
      MEMBER_ERROR_MESSAGES.revokeEventRole,
    );

  return (
    <DialogTrigger
      onOpenChange={(open) => {
        if (open) {
          setError(null);
          setSelected(null);
        }
      }}
    >
      <Button variant="outline" size="sm">
        {t("eventRoles.button")}
      </Button>
      <DialogOverlay isDismissable={!submitting}>
        <DialogContent closeButton={false}>
          {({ close }) => (
            <>
              <DialogHeader>
                <DialogTitle>
                  {t("eventRoles.title", { name: member.displayName })}
                </DialogTitle>
                <DialogDescription>
                  {t("eventRoles.description", {
                    role: t(`roles.${member.role}`),
                  })}
                </DialogDescription>
              </DialogHeader>
              {member.eventRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("eventRoles.empty")}
                </p>
              ) : (
                <ul
                  aria-label={t("eventRoles.assigned")}
                  className="divide-y rounded-md border"
                >
                  {member.eventRoles.map((r) => (
                    <li
                      key={r.eventId}
                      className="flex items-center justify-between gap-4 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span>{eventName(r.eventId)}</span>
                        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                          {t(`roles.${r.role}`)}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => revoke(r.eventId)}
                        isDisabled={submitting}
                      >
                        {t("eventRoles.revoke")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex items-end gap-2">
                <JollySelect
                  label={t("eventRoles.event")}
                  placeholder={t("eventRoles.choose")}
                  items={assignable}
                  selectedKey={selected}
                  onSelectionChange={setSelected}
                  isDisabled={submitting || assignable.length === 0}
                  className="flex-1"
                >
                  {(event) => (
                    <SelectItem id={event.eventId}>{event.name}</SelectItem>
                  )}
                </JollySelect>
                <Button
                  onPress={() => selected && grant(String(selected))}
                  isDisabled={submitting || !selected}
                >
                  {t("eventRoles.grant")}
                </Button>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onPress={close}
                  isDisabled={submitting}
                >
                  {t("eventRoles.close")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </DialogOverlay>
    </DialogTrigger>
  );
}
