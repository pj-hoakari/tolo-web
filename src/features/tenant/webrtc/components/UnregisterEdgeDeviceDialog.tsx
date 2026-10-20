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

type Unregistration =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "failed"; message: string };

const UNREGISTER_ERRORS: ErrorMessageKeys<"stale" | "failed"> = {
  byCode: { NOT_FOUND: "stale", PRECONDITION_FAILED: "stale" },
  fallback: "failed",
};

type Props = {
  eventId: string;
  edgeDeviceId: string;
  name: string;
  onUnregistered: () => void;
};

export function UnregisterEdgeDeviceDialog({
  eventId,
  edgeDeviceId,
  name,
  onUnregistered,
}: Props) {
  const t = useTranslations("Webrtc.unregisterEdge");
  const tList = useTranslations("Webrtc.aliveEdges");
  const [unregistration, setUnregistration] = useState<Unregistration>({
    kind: "idle",
  });
  const submitting = unregistration.kind === "submitting";

  async function unregister(close: () => void) {
    setUnregistration({ kind: "submitting" });
    try {
      await orpc.observation.unregisterEdgeDevice({ eventId, edgeDeviceId });
      setUnregistration({ kind: "idle" });
      close();
      onUnregistered();
    } catch (err) {
      setUnregistration({
        kind: "failed",
        message: t(errorMessageKey(err, UNREGISTER_ERRORS)),
      });
    }
  }

  return (
    <DialogTrigger
      onOpenChange={(open) => open && setUnregistration({ kind: "idle" })}
    >
      <Button
        variant="outline"
        size="sm"
        aria-label={tList("unregisterLabel", { name })}
      >
        {tList("unregister")}
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
              {unregistration.kind === "failed" && (
                <p role="alert" className="text-destructive text-sm">
                  {unregistration.message}
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
                  onPress={() => unregister(close)}
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
