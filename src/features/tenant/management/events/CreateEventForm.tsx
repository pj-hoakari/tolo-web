"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { JollyTextField } from "@/components/ui/textfield";
import { errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import { EVENT_ERROR_MESSAGES } from "./errorMessages";

type Props = {
  tenantId: string;
  onCreated: () => void;
};

export function CreateEventForm({ tenantId, onCreated }: Props) {
  const t = useTranslations("TenantManagement.create");
  const tError = useTranslations("TenantManagement");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await orpc.tenant.createEvent({ tenantId, name });
      setName("");
      onCreated();
    } catch (err) {
      setError(tError(errorMessageKey(err, EVENT_ERROR_MESSAGES.create)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <JollyTextField
          label={t("label")}
          value={name}
          onChange={setName}
          isDisabled={submitting}
          className="flex-1"
        />
        <Button type="submit" isDisabled={submitting || !name.trim()}>
          {t("submit")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
