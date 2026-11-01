"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useEffect, useState } from "react";
import { Text } from "react-aria-components";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { JollySelect, SelectItem } from "@/components/ui/select";
import { Input, TextField } from "@/components/ui/textfield";
import { type ErrorMessageKeys, errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import { EVENT_TYPES, type EventType, type ObservationSettings } from "./type";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; settings: ObservationSettings };

type Save =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "failed"; message: string };

const UPDATE_ERRORS: ErrorMessageKeys<"invalid" | "failed"> = {
  byCode: { BAD_REQUEST: "invalid" },
  fallback: "failed",
};

type Props = {
  eventId: string;
};

export function ObservationSettingsSection({ eventId }: Props) {
  const t = useTranslations("ObservationSettings");
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [request, setRequest] = useState({ eventId });

  useEffect(() => {
    let active = true;
    orpc.observation.getSettings(request).then(
      (settings) => {
        if (active) setLoad({ status: "ready", settings });
      },
      () => {
        if (active) setLoad({ status: "error" });
      },
    );
    return () => {
      active = false;
    };
  }, [request]);

  return (
    <section
      aria-labelledby="observation-settings-heading"
      className="flex flex-col gap-3 rounded-lg border p-4"
    >
      <h3 id="observation-settings-heading" className="text-lg font-semibold">
        {t("heading")}
      </h3>
      {load.status === "loading" && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
      {load.status === "error" && (
        <div role="alert" className="flex items-center gap-2">
          <p className="text-sm text-destructive">{t("loadFailed")}</p>
          <Button
            variant="outline"
            size="sm"
            onPress={() => {
              setLoad({ status: "loading" });
              setRequest({ eventId });
            }}
          >
            {t("retry")}
          </Button>
        </div>
      )}
      {load.status === "ready" && (
        <ObservationSettingsForm
          eventId={eventId}
          saved={load.settings}
          onSaved={(settings) => setLoad({ status: "ready", settings })}
        />
      )}
    </section>
  );
}

function ObservationSettingsForm({
  eventId,
  saved,
  onSaved,
}: {
  eventId: string;
  saved: ObservationSettings;
  onSaved: (settings: ObservationSettings) => void;
}) {
  const t = useTranslations("ObservationSettings");
  const [eventType, setEventType] = useState<EventType | null>(saved.eventType);
  const [days, setDays] = useState(String(saved.historyWindowDays));
  const [save, setSave] = useState<Save>({ kind: "idle" });
  const saving = save.kind === "saving";
  const historyWindowDays = Number(days);
  const valid =
    eventType !== null &&
    Number.isInteger(historyWindowDays) &&
    historyWindowDays >= 1;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (eventType === null) return;
    setSave({ kind: "saving" });
    try {
      const settings = await orpc.observation.updateSettings({
        eventId,
        historyWindowDays,
        eventType,
      });
      setSave({ kind: "saved" });
      onSaved(settings);
    } catch (err) {
      setSave({
        kind: "failed",
        message: t(errorMessageKey(err, UPDATE_ERRORS)),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {saved.eventType === null && (
        <p className="text-sm text-destructive">{t("unsetNotice")}</p>
      )}
      <div className="flex flex-wrap items-end gap-4">
        <JollySelect<{ id: EventType }>
          label={t("eventType.label")}
          placeholder={t("eventType.unset")}
          items={EVENT_TYPES.map((id) => ({ id }))}
          selectedKey={eventType}
          onSelectionChange={(key) => setEventType(key as EventType)}
          isDisabled={saving}
          className="w-80"
        >
          {({ id }) => (
            <SelectItem
              id={id}
              textValue={t(`eventType.${id}.name`)}
              className="flex-col items-start"
            >
              <Text slot="label">{t(`eventType.${id}.name`)}</Text>
              <Text slot="description" className="text-muted-foreground">
                {t(`eventType.${id}.criterion`)}
              </Text>
            </SelectItem>
          )}
        </JollySelect>
        <TextField className="flex w-40 flex-col gap-2" isDisabled={saving}>
          <Label>{t("historyWindowDays")}</Label>
          <Input
            type="number"
            min={1}
            step={1}
            value={days}
            onChange={(event) => setDays(event.currentTarget.value)}
          />
        </TextField>
        <Button type="submit" isDisabled={saving || !valid}>
          {t("save")}
        </Button>
      </div>
      {save.kind === "saved" && (
        <p role="status" className="text-sm text-muted-foreground">
          {t("saved")}
        </p>
      )}
      {save.kind === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {save.message}
        </p>
      )}
    </form>
  );
}
