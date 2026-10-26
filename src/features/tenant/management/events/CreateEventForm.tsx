"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { JollyTextField } from "@/components/ui/textfield";
import { errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";
import { EVENT_ERROR_MESSAGES } from "./errorMessages";

type Props = {
  tenantId: string;
  onCreated: () => void;
  triggerClassName?: string;
};

export function CreateEventForm({
  tenantId,
  onCreated,
  triggerClassName,
}: Props) {
  const t = useTranslations("TenantManagement.create");
  const tError = useTranslations("TenantManagement");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting || !name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await orpc.tenant.createEvent({ tenantId, name });
      setName("");
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(tError(errorMessageKey(err, EVENT_ERROR_MESSAGES.create)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(value) => {
        if (submitting) return;
        setOpen(value);
        if (value) {
          setName("");
          setError(null);
        }
      }}
    >
      <Button className={cn("h-10 gap-2", triggerClassName)}>
        <Plus aria-hidden className="size-4" />
        {t("open")}
      </Button>
      <DialogOverlay
        isDismissable={!submitting}
        isKeyboardDismissDisabled={submitting}
      >
        <DialogContent closeButton={false}>
          <DialogHeader>
            <DialogTitle>{t("open")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <JollyTextField
              label={t("label")}
              value={name}
              onChange={setName}
              isDisabled={submitting}
            />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onPress={() => setOpen(false)}
                isDisabled={submitting}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" isDisabled={submitting || !name.trim()}>
                {t("submit")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </DialogOverlay>
    </DialogTrigger>
  );
}
