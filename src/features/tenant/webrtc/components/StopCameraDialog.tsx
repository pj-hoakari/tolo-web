"use client";

import { useTranslations } from "next-intl";
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
import { type ErrorMessageKeys, errorMessageKey } from "@/lib/errorMessageKey";
import { orpc } from "@/lib/orpc";

type Stopping =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "failed"; message: string };

const STOP_ERRORS: ErrorMessageKeys<"stale" | "failed"> = {
  byCode: {
    NOT_FOUND: "stale",
    PRECONDITION_FAILED: "stale",
    FORBIDDEN: "stale",
  },
  fallback: "failed",
};

type Props = {
  eventId: string;
  edgeDeviceId: string;
  name: string;
  onStopped: () => void;
};

export function StopCameraDialog({
  eventId,
  edgeDeviceId,
  name,
  onStopped,
}: Props) {
  const t = useTranslations("Webrtc.stopCamera");
  const tList = useTranslations("Webrtc.aliveEdges");
  const [stopping, setStopping] = useState<Stopping>({ kind: "idle" });
  const submitting = stopping.kind === "submitting";

  async function stop(close: () => void) {
    setStopping({ kind: "submitting" });
    try {
      await orpc.camera.stopDeviceAuthorization({ eventId, edgeDeviceId });
      setStopping({ kind: "idle" });
      close();
      onStopped();
    } catch (err) {
      setStopping({
        kind: "failed",
        message: t(errorMessageKey(err, STOP_ERRORS)),
      });
    }
  }

  return (
    <DialogTrigger
      onOpenChange={(open) => open && setStopping({ kind: "idle" })}
    >
      <Button
        variant="outline"
        size="sm"
        aria-label={tList("stopLabel", { name })}
      >
        {tList("stop")}
      </Button>
      <DialogOverlay isDismissable={!submitting}>
        <DialogContent role="alertdialog" closeButton={false}>
          {({ close }) => (
            <>
              <DialogHeader>
                <DialogTitle>{t("title")}</DialogTitle>
                <DialogDescription>
                  {t("description", { name })}
                </DialogDescription>
              </DialogHeader>
              {stopping.kind === "failed" && (
                <p role="alert" className="text-sm text-destructive">
                  {stopping.message}
                </p>
              )}
              <DialogFooter>
                <Button
                  variant="outline"
                  onPress={close}
                  isDisabled={submitting}
                >
                  {t("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onPress={() => stop(close)}
                  isDisabled={submitting}
                >
                  {t("confirm")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </DialogOverlay>
    </DialogTrigger>
  );
}
