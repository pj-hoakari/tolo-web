"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { JollyTextField } from "@/components/ui/textfield";
import { errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import { MEMBER_ERROR_MESSAGES } from "./errorMessages";

type Props = {
  tenantId: string;
  onCreated: () => void;
};

export function CreateInvitationForm({ tenantId, onCreated }: Props) {
  const t = useTranslations("TenantMembers");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setUrl(null);
    try {
      const { invitationToken } = await orpc.tenant.createInvitation({
        tenantId,
        displayName,
      });
      setUrl(
        `${location.origin}/invitation?token=${encodeURIComponent(invitationToken)}`,
      );
      setCopied(false);
      setDisplayName("");
      onCreated();
    } catch (err) {
      setError(t(errorMessageKey(err, MEMBER_ERROR_MESSAGES.createInvitation)));
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <JollyTextField
            label={t("invite.label")}
            value={displayName}
            onChange={setDisplayName}
            maxLength={64}
            isDisabled={submitting}
            className="flex-1"
          />
          <Button type="submit" isDisabled={submitting || !displayName.trim()}>
            {t("invite.submit")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">{t("invite.staffOnly")}</p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
      {url && (
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <div className="flex items-end gap-2">
            <JollyTextField
              label={t("invite.url")}
              value={url}
              isReadOnly
              className="flex-1"
            />
            <Button variant="outline" onPress={() => copy(url)}>
              {copied ? t("invite.copied") : t("invite.copy")}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t("invite.urlOnce")}</p>
        </div>
      )}
    </div>
  );
}
