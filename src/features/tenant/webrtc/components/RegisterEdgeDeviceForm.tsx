"use client";

import { useFormatter, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { JollyTextField } from "@/components/ui/textfield";
import { type ErrorMessageKeys, errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import type { EdgeDevice } from "@/server/router";

type Registration =
  | { kind: "idle" }
  | { kind: "submitting" }
  | {
      kind: "registered";
      device: EdgeDevice;
      path: string;
      url: string;
      copied: boolean;
    }
  | { kind: "failed"; message: string };

const REGISTER_ERRORS: ErrorMessageKeys<
  "invalid" | "eventNotFound" | "failed"
> = {
  byCode: { BAD_REQUEST: "invalid", NOT_FOUND: "eventNotFound" },
  fallback: "failed",
};

const linesOf = (text: string): string[] => [
  ...new Set(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  ),
];

type Props = {
  eventId: string;
  onRegistered: () => void;
};

export function RegisterEdgeDeviceForm({ eventId, onRegistered }: Props) {
  const t = useTranslations("Webrtc.registerEdge");
  const format = useFormatter();
  const [name, setName] = useState("");
  const [points, setPoints] = useState("");
  const [registration, setRegistration] = useState<Registration>({
    kind: "idle",
  });
  const submitting = registration.kind === "submitting";
  const observationPointNames = linesOf(points);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRegistration({ kind: "submitting" });
    try {
      const { device, observationPagePath } =
        await orpc.observation.registerEdgeDevice({
          eventId,
          name,
          observationPointNames,
        });
      setRegistration({
        kind: "registered",
        device,
        path: observationPagePath,
        url: new URL(observationPagePath, window.location.origin).href,
        copied: false,
      });
      setName("");
      setPoints("");
      onRegistered();
    } catch (err) {
      setRegistration({
        kind: "failed",
        message: t(errorMessageKey(err, REGISTER_ERRORS)),
      });
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setRegistration((current) =>
        current.kind === "registered" && current.url === url
          ? { ...current, copied: true }
          : current,
      );
    } catch (err) {
      console.error("failed to copy the issued URL", err);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-3xl flex-col gap-3 rounded-md border p-4"
    >
      <h3 className="text-lg font-semibold">{t("title")}</h3>
      <JollyTextField
        label={t("nameLabel")}
        value={name}
        onChange={setName}
        isDisabled={submitting}
      />
      <JollyTextField
        textArea
        label={t("pointsLabel")}
        description={t("pointsDescription")}
        value={points}
        onChange={setPoints}
        isDisabled={submitting}
      />
      <Button
        type="submit"
        className="self-end"
        isDisabled={
          submitting || !name.trim() || observationPointNames.length === 0
        }
      >
        {t("submit")}
      </Button>
      {registration.kind === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          {registration.message}
        </p>
      )}
      {registration.kind === "registered" && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="text-sm">
            {t("registered", { name: registration.device.name })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("points", {
              names: format.list(
                registration.device.observationPoints.map((p) => p.name),
              ),
            })}
          </p>
          <JollyTextField
            label={t("urlLabel")}
            value={registration.url}
            isReadOnly
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onPress={() => copy(registration.url)}
            >
              {registration.copied ? t("copied") : t("copy")}
            </Button>
            <Link href={registration.path} variant="secondary" size="sm">
              {t("open")}
            </Link>
          </div>
        </div>
      )}
    </form>
  );
}
