"use client";

import { useFormatter, useTranslations } from "next-intl";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { JollySelect, SelectItem } from "@/components/ui/select";
import { JollyTextField } from "@/components/ui/textfield";
import { type ErrorMessageKeys, errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";
import type { EdgeDevice, EdgeDeviceKind } from "@/server/router";
import type { EdgeDeviceItem } from "../type";
import { CameraProvisioningDialog } from "./CameraProvisioningDialog";

type Registration =
  | { kind: "idle" }
  | { kind: "submitting" }
  | {
      kind: "registered";
      device: EdgeDevice;
      path: string | null;
      url: string | null;
      copied: boolean;
    }
  | { kind: "failed"; message: string };

const REGISTER_ERRORS: ErrorMessageKeys<
  "invalid" | "eventNotFound" | "failed"
> = {
  byCode: { BAD_REQUEST: "invalid", NOT_FOUND: "eventNotFound" },
  fallback: "failed",
};

const REGISTER_KINDS: EdgeDeviceKind[] = ["observation_page", "camera"];

const linesOf = (text: string): string[] => [
  ...new Set(
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  ),
];

type CameraPointOption = {
  id: string;
  label: string;
};

function cameraPointOptions(edges: EdgeDeviceItem[]): CameraPointOption[] {
  const linkedPointIds = new Set(
    edges.flatMap((edge) =>
      edge.cameraLinks.map((link) => link.observationPointId),
    ),
  );
  return edges.flatMap((edge) => {
    if (edge.kind !== "observation_page") return [];
    const deviceName = edge.name || edge.edgeDeviceId;
    return edge.observationPoints
      .filter((point) => !linkedPointIds.has(point.observationPointId))
      .map((point) => ({
        id: point.observationPointId,
        label: `${deviceName} / ${point.name}`,
      }));
  });
}

type Props = {
  eventId: string;
  onRegistered: () => void;
  edges?: EdgeDeviceItem[];
};

const NO_EDGES: EdgeDeviceItem[] = [];

export function RegisterEdgeDeviceForm({
  eventId,
  onRegistered,
  edges = NO_EDGES,
}: Props) {
  const t = useTranslations("Webrtc.registerEdge");
  const format = useFormatter();
  const [kind, setKind] = useState<EdgeDeviceKind>("observation_page");
  const [name, setName] = useState("");
  const [points, setPoints] = useState("");
  const [linkedPointId, setLinkedPointId] = useState<string | null>(null);
  const [registration, setRegistration] = useState<Registration>({
    kind: "idle",
  });
  const submitting = registration.kind === "submitting";
  const observationPointNames = linesOf(points);
  const options = useMemo(() => cameraPointOptions(edges), [edges]);
  const selectedPoint = options.find((option) => option.id === linkedPointId);
  const valid =
    kind === "camera"
      ? selectedPoint !== undefined
      : observationPointNames.length > 0;

  function changeKind(next: EdgeDeviceKind) {
    setKind(next);
    if (next === "camera") {
      setPoints("");
    } else {
      setLinkedPointId(null);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid) return;
    setRegistration({ kind: "submitting" });
    try {
      const { device, observationPagePath } =
        await orpc.observation.registerEdgeDevice({
          eventId,
          name,
          kind,
          observationPointNames: kind === "camera" ? [] : observationPointNames,
          linkedObservationPointId:
            kind === "camera" ? (linkedPointId ?? undefined) : undefined,
        });
      const isCamera = device.kind === "camera";
      setRegistration({
        kind: "registered",
        device,
        path: isCamera ? null : observationPagePath,
        url: isCamera
          ? null
          : new URL(observationPagePath, window.location.origin).href,
        copied: false,
      });
      setName("");
      setPoints("");
      setLinkedPointId(null);
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
      <JollySelect<{ id: EdgeDeviceKind }>
        label={t("kindLabel")}
        items={REGISTER_KINDS.map((id) => ({ id }))}
        selectedKey={kind}
        onSelectionChange={(key) => {
          if (key) changeKind(key as EdgeDeviceKind);
        }}
        isDisabled={submitting}
      >
        {({ id }) => (
          <SelectItem id={id} textValue={t(`kind.${id}`)}>
            {t(`kind.${id}`)}
          </SelectItem>
        )}
      </JollySelect>
      {kind === "camera" ? (
        <>
          <JollySelect<CameraPointOption>
            label={t("cameraPointLabel")}
            description={t("cameraPointDescription")}
            placeholder={t("cameraPointPlaceholder")}
            items={options}
            selectedKey={linkedPointId}
            onSelectionChange={(key) =>
              setLinkedPointId(key ? String(key) : null)
            }
            isDisabled={submitting || options.length === 0}
          >
            {(option) => (
              <SelectItem id={option.id} textValue={option.label}>
                {option.label}
              </SelectItem>
            )}
          </JollySelect>
          {options.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("noCameraPoints")}
            </p>
          )}
        </>
      ) : (
        <JollyTextField
          textArea
          label={t("pointsLabel")}
          description={t("pointsDescription")}
          value={points}
          onChange={setPoints}
          isDisabled={submitting}
        />
      )}
      <Button
        type="submit"
        className="self-end"
        isDisabled={submitting || !name.trim() || !valid}
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
          {registration.device.kind === "camera" ? (
            <>
              <p className="text-sm">
                {t("cameraRegistered", { name: registration.device.name })}
              </p>
              <JollyTextField
                label={t("edgeDeviceIdLabel")}
                value={registration.device.edgeDeviceId}
                isReadOnly
              />
              <div className="flex justify-end">
                <CameraProvisioningDialog
                  eventId={eventId}
                  edgeDeviceId={registration.device.edgeDeviceId}
                  edgeName={registration.device.name}
                  triggerLabel={t("openProvisioning")}
                  triggerVariant="secondary"
                  triggerSize="sm"
                />
              </div>
            </>
          ) : (
            <>
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
                value={registration.url ?? ""}
                isReadOnly
              />
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    if (registration.url) void copy(registration.url);
                  }}
                >
                  {registration.copied ? t("copied") : t("copy")}
                </Button>
                {registration.path && (
                  <Link href={registration.path} variant="secondary" size="sm">
                    {t("open")}
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </form>
  );
}
