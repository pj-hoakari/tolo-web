import {
  type DetectionSettings,
  parseDetectionSettings,
} from "@/features/tenant/detection/stores/detectionStore";

/**
 * 検出設定を双方向にやり取りする DataChannel
 *
 * 映像・検出結果を流す "detections" とは別に張り，
 * management 側から observation 側の設定を変更できるようにする。
 */
export const DETECTION_CONTROL_CHANNEL_LABEL = "detection-control";

/** observation → management: 現在の検出設定 */
export type DetectionControlNotice = {
  type: "settings";
  settings: DetectionSettings;
};

/** management → observation: 検出設定の変更要求 */
export type DetectionControlRequest = {
  type: "update-settings";
  settings: DetectionSettings;
};

export function encodeDetectionControlNotice(
  settings: DetectionSettings,
): string {
  return JSON.stringify({
    type: "settings",
    settings,
  } satisfies DetectionControlNotice);
}

export function encodeDetectionControlRequest(
  settings: DetectionSettings,
): string {
  return JSON.stringify({
    type: "update-settings",
    settings,
  } satisfies DetectionControlRequest);
}

function parseMessage(
  data: string,
  expectedType: string,
): DetectionSettings | null {
  try {
    const message: unknown = JSON.parse(data);
    if (
      typeof message !== "object" ||
      message === null ||
      (message as { type?: unknown }).type !== expectedType
    ) {
      return null;
    }
    return parseDetectionSettings((message as { settings?: unknown }).settings);
  } catch {
    return null;
  }
}

export function parseDetectionControlNotice(
  data: string,
): DetectionControlNotice | null {
  const settings = parseMessage(data, "settings");
  return settings ? { type: "settings", settings } : null;
}

export function parseDetectionControlRequest(
  data: string,
): DetectionControlRequest | null {
  const settings = parseMessage(data, "update-settings");
  return settings ? { type: "update-settings", settings } : null;
}

/** open していないチャンネルへの送信で例外を投げないようにする */
export function sendOverDataChannel(
  channel: RTCDataChannel | null,
  message: string,
): void {
  if (channel?.readyState !== "open") {
    return;
  }
  try {
    channel.send(message);
  } catch (e) {
    console.error("[webrtc] failed to send over data channel", e);
  }
}
