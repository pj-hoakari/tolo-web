"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import { EVENT_ERROR_MESSAGES } from "./errorMessages";
import type { TenantEvent } from "./type";

type Props = {
  event: TenantEvent;
  onRestored: () => void;
};

export function RestoreEventButton({ event, onRestored }: Props) {
  const t = useTranslations("TenantManagement.restore");
  const tError = useTranslations("TenantManagement");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setSubmitting(true);
    setError(null);
    try {
      await orpc.tenant.restoreEvent({ eventId: event.eventId });
      onRestored();
    } catch (err) {
      setError(tError(errorMessageKey(err, EVENT_ERROR_MESSAGES.restore)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        onPress={restore}
        isDisabled={submitting}
      >
        {t("button")}
      </Button>
    </div>
  );
}
