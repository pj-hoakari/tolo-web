"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { JollyTextField } from "@/components/ui/textfield";
import { orpc } from "@/lib/orpc";
import {
  ProvisioningStoppedError,
  ProvisioningTimeoutError,
  SerialMessageChannel,
} from "../provisioning/channel";
import {
  type DeviceAuthorizationMessage,
  type DeviceMessage,
  encodeConfigCommand,
  PROVISIONING_BAUD_RATE,
} from "../provisioning/protocol";
import {
  detectWebSerialAvailability,
  type SerialAvailability,
  type SerialTransport,
  WebSerialTransport,
} from "../provisioning/transport";

type ProvisioningStep =
  | "selecting"
  | "opening"
  | "writing"
  | "waitingConfig"
  | "waitingAuthorization"
  | "approving"
  | "waitingResult";

type ProvisioningState =
  | { kind: "idle" }
  | {
      kind: "running";
      step: ProvisioningStep;
      userCode?: string;
      verificationUri?: string;
    }
  | { kind: "manual" }
  | { kind: "complete"; userCode: string }
  | { kind: "failed"; message: string; userCode?: string };

const DEFAULT_TIMEOUT_MS = 60_000;

class DeviceReportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeviceReportedError";
  }
}

async function waitForMessage<K extends DeviceMessage["type"]>(
  channel: SerialMessageChannel,
  type: K,
  timeoutMs: number,
): Promise<Extract<DeviceMessage, { type: K }>> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ProvisioningTimeoutError();
    const message = await channel.next(remaining);
    if (message.type === "error") throw new DeviceReportedError(message.error);
    if (message.type === type) {
      return message as Extract<DeviceMessage, { type: K }>;
    }
  }
}

type Props = {
  eventId: string;
  edgeDeviceId: string;
  edgeName: string;
  transport?: SerialTransport;
  timeoutMs?: number;
  triggerLabel?: string;
  triggerAriaLabel?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
};

export function CameraProvisioningDialog({
  eventId,
  edgeDeviceId,
  edgeName,
  transport: transportProp,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  triggerLabel,
  triggerAriaLabel,
  triggerVariant = "outline",
  triggerSize = "sm",
}: Props) {
  const t = useTranslations("Webrtc.cameraProvision");
  const transport = useMemo(
    () => transportProp ?? new WebSerialTransport(),
    [transportProp],
  );
  const [availability, setAvailability] = useState<SerialAvailability | null>(
    null,
  );
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [state, setState] = useState<ProvisioningState>({ kind: "idle" });
  const channelRef = useRef<SerialMessageChannel | null>(null);
  const runIdRef = useRef(0);

  const stop = useCallback(() => {
    runIdRef.current += 1;
    channelRef.current?.stop();
    channelRef.current = null;
    void transport.close();
  }, [transport]);

  useEffect(() => () => stop(), [stop]);

  const prepare = useCallback(() => {
    stop();
    setManualCode("");
    setWifiPassword("");
    setState({ kind: "idle" });
    setAvailability(
      transportProp ? "available" : detectWebSerialAvailability(),
    );
  }, [stop, transportProp]);

  const running = state.kind === "running";
  const canStart = wifiSsid.trim() !== "" && wifiPassword !== "";

  function redact(message: string): string {
    if (!wifiPassword) return message;
    return message.split(wifiPassword).join("[redacted]");
  }

  function messageForError(error: unknown): string {
    if (error instanceof ProvisioningTimeoutError) return t("timeout");
    if (error instanceof DeviceReportedError) {
      return t("deviceError", { error: redact(error.message) });
    }
    return t("failed");
  }

  async function approveAndWait(
    runId: number,
    channel: SerialMessageChannel,
    userCode: string,
    verificationUri: string,
  ) {
    setState({
      kind: "running",
      step: "approving",
      userCode,
      verificationUri,
    });
    await orpc.camera.approveDeviceAuthorization({
      eventId,
      edgeDeviceId,
      userCode,
    });
    if (runId !== runIdRef.current) return;

    setState({
      kind: "running",
      step: "waitingResult",
      userCode,
      verificationUri,
    });
    const result = await waitForMessage(
      channel,
      "authorization_result",
      timeoutMs,
    );
    if (runId !== runIdRef.current) return;
    if (!result.ok) {
      setState({
        kind: "failed",
        message: t("authorizationRejected"),
        userCode,
      });
      return;
    }
    setState({ kind: "complete", userCode });
    setWifiPassword("");
    channelRef.current?.stop();
    channelRef.current = null;
    void transport.close();
  }

  async function handleStart() {
    if (!canStart || availability !== "available") return;
    const runId = ++runIdRef.current;
    setManualCode("");

    try {
      setState({ kind: "running", step: "selecting" });
      const defaults = await orpc.camera.provisioningDefaults();
      await transport.selectPort();
      if (runId !== runIdRef.current) return;

      setState({ kind: "running", step: "opening" });
      await transport.open({ baudRate: PROVISIONING_BAUD_RATE });
      if (runId !== runIdRef.current) return;

      const channel = new SerialMessageChannel(transport);
      channelRef.current = channel;
      channel.start();

      setState({ kind: "running", step: "writing" });
      await transport.writeLine(
        encodeConfigCommand({
          wifiSsid,
          wifiPassword,
          signalingUrl: defaults.signalingUrl,
          idpUrl: defaults.idpUrl,
          firebaseProjectId: defaults.firebaseProjectId,
          firebaseApiKey: defaults.firebaseApiKey,
          firestoreEmulatorHost: defaults.firestoreEmulatorHost,
          firebaseAuthEmulatorHost: defaults.firebaseAuthEmulatorHost,
          edgeDeviceId,
        }),
      );
      if (runId !== runIdRef.current) return;

      setState({ kind: "running", step: "waitingConfig" });
      const configResult = await waitForMessage(
        channel,
        "config_result",
        timeoutMs,
      );
      if (runId !== runIdRef.current) return;
      if (!configResult.ok) {
        setState({
          kind: "failed",
          message: configResult.error
            ? t("configRejected", { error: redact(configResult.error) })
            : t("configRejectedNoReason"),
        });
        return;
      }

      setState({ kind: "running", step: "waitingAuthorization" });
      let authorization: DeviceAuthorizationMessage;
      try {
        authorization = await waitForMessage(
          channel,
          "device_authorization",
          timeoutMs,
        );
      } catch (error) {
        if (error instanceof ProvisioningTimeoutError) {
          if (runId === runIdRef.current) setState({ kind: "manual" });
          return;
        }
        throw error;
      }

      await approveAndWait(
        runId,
        channel,
        authorization.user_code,
        authorization.verification_uri,
      );
    } catch (error) {
      if (runId !== runIdRef.current) return;
      if (error instanceof ProvisioningStoppedError) return;
      setState({ kind: "failed", message: messageForError(error) });
    }
  }

  async function handleManualApprove() {
    const userCode = manualCode.trim();
    const channel = channelRef.current;
    if (!userCode) return;
    if (!channel) {
      setState({ kind: "failed", message: t("notConnected") });
      return;
    }
    const runId = runIdRef.current;
    try {
      await approveAndWait(runId, channel, userCode, "");
    } catch (error) {
      if (runId !== runIdRef.current) return;
      if (error instanceof ProvisioningStoppedError) return;
      if (error instanceof ProvisioningTimeoutError) {
        setState({
          kind: "failed",
          message: t("authorizationTimeout"),
          userCode,
        });
        return;
      }
      setState({ kind: "failed", message: messageForError(error), userCode });
    }
  }

  function handleRetry() {
    stop();
    setManualCode("");
    setState({ kind: "idle" });
    setAvailability(
      transportProp ? "available" : detectWebSerialAvailability(),
    );
  }

  const userCode =
    state.kind === "running" || state.kind === "complete"
      ? state.userCode
      : state.kind === "failed"
        ? state.userCode
        : undefined;
  const verificationUri =
    state.kind === "running" ? state.verificationUri : undefined;

  return (
    <DialogTrigger
      onOpenChange={(open) => {
        if (open) {
          prepare();
          return;
        }
        stop();
        setWifiPassword("");
        setManualCode("");
      }}
    >
      <Button
        variant={triggerVariant}
        size={triggerSize}
        aria-label={triggerAriaLabel}
      >
        {triggerLabel ?? t("trigger")}
      </Button>
      <DialogOverlay>
        <DialogContent>
          {({ close }) => (
            <>
              <DialogHeader>
                <DialogTitle>{t("title")}</DialogTitle>
                <DialogDescription>
                  {t("description", { name: edgeName, id: edgeDeviceId })}
                </DialogDescription>
              </DialogHeader>

              {availability === "unsupported" && (
                <p role="alert" className="text-sm text-destructive">
                  {t("unsupported")}
                </p>
              )}
              {availability === "insecure" && (
                <p role="alert" className="text-sm text-destructive">
                  {t("insecure")}
                </p>
              )}

              {availability !== "unsupported" &&
                availability !== "insecure" && (
                  <>
                    <JollyTextField
                      label={t("wifiSsidLabel")}
                      value={wifiSsid}
                      onChange={setWifiSsid}
                      isDisabled={state.kind !== "idle"}
                      autoComplete="off"
                    />
                    <JollyTextField
                      label={t("wifiPasswordLabel")}
                      description={t("wifiPasswordDescription")}
                      value={wifiPassword}
                      onChange={setWifiPassword}
                      type="password"
                      isDisabled={state.kind !== "idle"}
                      autoComplete="new-password"
                    />

                    {running && (
                      <p
                        role="status"
                        className="text-sm text-muted-foreground"
                      >
                        {t(`steps.${state.step}`)}
                      </p>
                    )}

                    {userCode && (
                      <div className="flex flex-col gap-1 rounded-md border p-3">
                        <span className="text-xs text-muted-foreground">
                          {t("userCodeLabel")}
                        </span>
                        <span className="font-mono text-lg">{userCode}</span>
                        {verificationUri && (
                          <span className="text-xs break-all text-muted-foreground">
                            {t("verificationUri", { uri: verificationUri })}
                          </span>
                        )}
                      </div>
                    )}

                    {state.kind === "manual" && (
                      <div className="flex flex-col gap-2 rounded-md border p-3">
                        <p className="text-sm font-medium">
                          {t("manualTitle")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t("manualDescription")}
                        </p>
                        <JollyTextField
                          label={t("manualLabel")}
                          value={manualCode}
                          onChange={setManualCode}
                          autoComplete="off"
                        />
                      </div>
                    )}

                    {state.kind === "complete" && (
                      <p role="status" className="text-sm">
                        {t("complete", {
                          name: edgeName,
                          userCode: state.userCode,
                        })}
                      </p>
                    )}
                    {state.kind === "failed" && (
                      <p role="alert" className="text-sm text-destructive">
                        {state.message}
                      </p>
                    )}
                  </>
                )}

              <DialogFooter>
                <Button variant="outline" onPress={close}>
                  {t("close")}
                </Button>
                {state.kind === "idle" &&
                  availability !== "unsupported" &&
                  availability !== "insecure" && (
                    <Button onPress={handleStart} isDisabled={!canStart}>
                      {t("start")}
                    </Button>
                  )}
                {state.kind === "manual" && (
                  <Button
                    onPress={handleManualApprove}
                    isDisabled={!manualCode.trim()}
                  >
                    {t("manualSubmit")}
                  </Button>
                )}
                {state.kind === "failed" && (
                  <Button onPress={handleRetry}>{t("retry")}</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </DialogOverlay>
    </DialogTrigger>
  );
}
