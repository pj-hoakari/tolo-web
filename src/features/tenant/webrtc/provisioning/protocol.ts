export const PROVISIONING_PROTOCOL_VERSION = 1;
export const PROVISIONING_BAUD_RATE = 115_200;

export type CameraConfigInput = {
  wifiSsid: string;
  wifiPassword: string;
  signalingUrl: string;
  firebaseProjectId: string;
  firebaseApiKey: string;
  firestoreEmulatorHost: string | null;
  firebaseAuthEmulatorHost: string | null;
  edgeDeviceId: string;
};

export type ConfigCommand = {
  type: "config";
  version: typeof PROVISIONING_PROTOCOL_VERSION;
  wifi_ssid: string;
  wifi_password: string;
  signaling_url: string;
  firebase_project_id: string;
  firebase_api_key: string;
  firestore_emulator_host: string;
  firebase_auth_emulator_host: string;
  edge_device_id: string;
};

export type ConfigResultMessage = {
  type: "config_result";
  ok: boolean;
  error?: string;
};

export type DeviceAuthorizationMessage = {
  type: "device_authorization";
  user_code: string;
  verification_uri: string;
  expires_in: number;
};

export type AuthorizationResultMessage = {
  type: "authorization_result";
  ok: boolean;
};

export type ErrorMessage = {
  type: "error";
  error: string;
};

export type StatusMessage = {
  type: "status";
  configured: boolean;
  edge_device_id?: string;
  authorization?: "approved" | "pending" | "required";
};

export type DeviceMessage =
  | ConfigResultMessage
  | DeviceAuthorizationMessage
  | AuthorizationResultMessage
  | ErrorMessage
  | StatusMessage;

export function encodeConfigCommand(input: CameraConfigInput): string {
  const command: ConfigCommand = {
    type: "config",
    version: PROVISIONING_PROTOCOL_VERSION,
    wifi_ssid: input.wifiSsid,
    wifi_password: input.wifiPassword,
    signaling_url: input.signalingUrl,
    firebase_project_id: input.firebaseProjectId,
    firebase_api_key: input.firebaseApiKey,
    firestore_emulator_host: input.firestoreEmulatorHost ?? "",
    firebase_auth_emulator_host: input.firebaseAuthEmulatorHost ?? "",
    edge_device_id: input.edgeDeviceId,
  };
  return JSON.stringify(command);
}

export function encodeDeviceMessage(message: {
  type: "status" | "device_authorization" | "reboot";
}): string {
  return JSON.stringify(message);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function parseDeviceMessage(line: string): DeviceMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.type !== "string") return null;

  switch (value.type) {
    case "config_result":
      if (typeof value.ok !== "boolean") return null;
      return {
        type: "config_result",
        ok: value.ok,
        ...(typeof value.error === "string" ? { error: value.error } : {}),
      };
    case "device_authorization":
      if (typeof value.user_code !== "string") return null;
      return {
        type: "device_authorization",
        user_code: value.user_code,
        verification_uri:
          typeof value.verification_uri === "string"
            ? value.verification_uri
            : "",
        expires_in: typeof value.expires_in === "number" ? value.expires_in : 0,
      };
    case "authorization_result":
      if (typeof value.ok !== "boolean") return null;
      return { type: "authorization_result", ok: value.ok };
    case "error":
      if (typeof value.error !== "string") return null;
      return { type: "error", error: value.error };
    case "status":
      if (typeof value.configured !== "boolean") return null;
      return {
        type: "status",
        configured: value.configured,
        ...(typeof value.edge_device_id === "string"
          ? { edge_device_id: value.edge_device_id }
          : {}),
        ...(value.authorization === "approved" ||
        value.authorization === "pending" ||
        value.authorization === "required"
          ? { authorization: value.authorization }
          : {}),
      };
    default:
      return null;
  }
}
