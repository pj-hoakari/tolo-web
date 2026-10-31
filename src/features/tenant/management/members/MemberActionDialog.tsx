"use client";

import { useLocale, useTranslations } from "next-intl";
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
import { errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import { MEMBER_ERROR_MESSAGES } from "./errorMessages";
import { formatDateTime } from "./formatDateTime";
import type { TenantMember, TenantRole } from "./type";

export type MemberAction = "promote" | "demote" | "remove";

export const MEMBER_ACTIONS: Record<TenantRole, MemberAction[]> = {
  owner: ["demote", "remove"],
  staff: ["promote", "remove"],
};

const RUN: Record<
  MemberAction,
  (input: { tenantId: string; userId: string }) => Promise<unknown>
> = {
  promote: (input) => orpc.tenant.changeMemberRole({ ...input, role: "owner" }),
  demote: (input) => orpc.tenant.changeMemberRole({ ...input, role: "staff" }),
  remove: (input) => orpc.tenant.removeMember(input),
};

type Props = {
  action: MemberAction;
  tenantId: string;
  member: TenantMember;
  onDone: () => void;
};

export function MemberActionDialog({
  action,
  tenantId,
  member,
  onDone,
}: Props) {
  const t = useTranslations("TenantMembers");
  const locale = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(close: () => void) {
    setSubmitting(true);
    setError(null);
    try {
      await RUN[action]({ tenantId, userId: member.userId });
      close();
      onDone();
    } catch (err) {
      setError(t(errorMessageKey(err, MEMBER_ERROR_MESSAGES[action])));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogTrigger onOpenChange={(open) => open && setError(null)}>
      <Button variant="outline" size="sm">
        {t(`actions.${action}.button`)}
      </Button>
      <DialogOverlay isDismissable={!submitting}>
        <DialogContent role="alertdialog" closeButton={false}>
          {({ close }) => (
            <>
              <DialogHeader>
                <DialogTitle>{t(`actions.${action}.title`)}</DialogTitle>
                <DialogDescription>
                  {t(`actions.${action}.description`, {
                    name: member.displayName,
                    joinedAt: member.joinedAt
                      ? formatDateTime(member.joinedAt, locale)
                      : t("members.joinedAtUnknown"),
                  })}
                </DialogDescription>
              </DialogHeader>
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
                  {t("actions.cancel")}
                </Button>
                <Button
                  variant={action === "remove" ? "destructive" : "default"}
                  onPress={() => run(close)}
                  isDisabled={submitting}
                >
                  {t(`actions.${action}.confirm`)}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </DialogOverlay>
    </DialogTrigger>
  );
}
