"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import { CreateInvitationForm } from "./CreateInvitationForm";
import { MEMBER_ERROR_MESSAGES } from "./errorMessages";
import { formatDateTime } from "./formatDateTime";
import { MEMBER_ACTIONS, MemberActionDialog } from "./MemberActionDialog";
import type { TenantInvitation } from "./type";
import { type Remote, useTenantMembers } from "./useTenantMembers";

type Props = {
  tenantId: string;
};

export function TenantMembers({ tenantId }: Props) {
  const t = useTranslations("TenantMembers");
  const locale = useLocale();
  const { members, invitations, refresh } = useTenantMembers(tenantId);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t("invite.heading")}</h3>
        <CreateInvitationForm tenantId={tenantId} onCreated={refresh} />
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{t("invitations.heading")}</h3>
        <RemoteList
          remote={invitations}
          label={t("invitations.heading")}
          empty={t("invitations.empty")}
          error={t("invitations.error")}
          retry={refresh}
        >
          {(invitation) => (
            <li
              key={invitation.invitationId}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="font-medium">{invitation.displayName}</span>
                {invitation.expiresAt && (
                  <span className="text-sm text-muted-foreground">
                    {t("invitations.expiresAt", {
                      expiresAt: formatDateTime(invitation.expiresAt, locale),
                    })}
                  </span>
                )}
              </div>
              <RevokeInvitationButton
                tenantId={tenantId}
                invitation={invitation}
                onRevoked={refresh}
              />
            </li>
          )}
        </RemoteList>
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold">{t("members.heading")}</h3>
        <RemoteList
          remote={members}
          label={t("members.heading")}
          empty={t("members.empty")}
          error={t("members.error")}
          retry={refresh}
        >
          {(member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{member.displayName}</span>
                  <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                    {t(`roles.${member.role}`)}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {t("members.joinedAt", {
                    joinedAt: member.joinedAt
                      ? formatDateTime(member.joinedAt, locale)
                      : t("members.joinedAtUnknown"),
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {MEMBER_ACTIONS[member.role].map((action) => (
                  <MemberActionDialog
                    key={action}
                    action={action}
                    tenantId={tenantId}
                    member={member}
                    onDone={refresh}
                  />
                ))}
              </div>
            </li>
          )}
        </RemoteList>
      </section>
    </div>
  );
}

function RemoteList<T>({
  remote,
  label,
  empty,
  error,
  retry,
  children,
}: {
  remote: Remote<T[]>;
  label: string;
  empty: string;
  error: string;
  retry: () => void;
  children: (item: T) => React.ReactNode;
}) {
  const t = useTranslations("TenantMembers");
  switch (remote.status) {
    case "loading":
      return <p className="text-sm text-muted-foreground">{t("loading")}</p>;
    case "error":
      return (
        <div role="alert" className="flex items-center gap-2">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onPress={retry}>
            {t("retry")}
          </Button>
        </div>
      );
    case "ready":
      return remote.value.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul aria-label={label} className="divide-y rounded-md border">
          {remote.value.map(children)}
        </ul>
      );
  }
}

function RevokeInvitationButton({
  tenantId,
  invitation,
  onRevoked,
}: {
  tenantId: string;
  invitation: TenantInvitation;
  onRevoked: () => void;
}) {
  const t = useTranslations("TenantMembers");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    setSubmitting(true);
    setError(null);
    try {
      await orpc.tenant.revokeInvitation({
        tenantId,
        invitationId: invitation.invitationId,
      });
      onRevoked();
    } catch (err) {
      setError(t(errorMessageKey(err, MEMBER_ERROR_MESSAGES.revokeInvitation)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        onPress={revoke}
        isDisabled={submitting}
      >
        {t("invitations.revoke")}
      </Button>
    </div>
  );
}
