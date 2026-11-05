import "server-only";

import { ORPCError } from "@orpc/server";
import { encodeBasicCredentials } from "better-auth/oauth2";
import { getAccessToken } from "./auth";
import { authMockingEnabled } from "./auth/mocking";

const DEVICE_AUTHORIZATION_PATH = "/api/device-authorization";

export interface CameraProvisioningDefaults {
  signalingUrl: string;
  idpUrl: string;
  firebaseProjectId: string;
  firebaseApiKey: string;
  firestoreEmulatorHost: string | null;
  firebaseAuthEmulatorHost: string | null;
}

function idpIssuer(): string | undefined {
  const issuer = process.env.AUTH_IDP_ISSUER?.trim();
  return issuer ? issuer.replace(/\/+$/, "") : undefined;
}

async function postDeviceAuthorization(
  operation: "approve" | "revoke",
  body: Record<string, string | boolean>,
): Promise<void> {
  const issuer = idpIssuer();
  if (!issuer) {
    if (authMockingEnabled()) return;
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "AUTH_IDP_ISSUER is not configured",
    });
  }

  const staffToken = await getAccessToken({ type: "tenant_access" });
  const response = await fetch(
    `${issuer}${DEVICE_AUTHORIZATION_PATH}/${operation}`,
    {
      method: "POST",
      headers: {
        authorization: encodeBasicCredentials(
          process.env.AUTH_IDP_CLIENT_ID || "console-ui",
          process.env.AUTH_IDP_CLIENT_SECRET ?? "",
        ),
        "content-type": "application/json",
        accept: "application/json",
        "X-Tolo-Staff-Token": staffToken,
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new ORPCError("BAD_GATEWAY", {
      message: `device authorization ${operation} failed with ${response.status}`,
    });
  }
}

export async function approveDeviceAuthorization(
  input: {
    eventId: string;
    edgeDeviceId: string;
    userCode: string;
  },
  options: { reapproval?: boolean } = {},
): Promise<void> {
  await postDeviceAuthorization("approve", {
    user_code: input.userCode,
    event_id: input.eventId,
    edge_device_id: input.edgeDeviceId,
    ...(options.reapproval && { reapproval: true }),
  });
}

export async function revokeDeviceAuthorization(
  input: {
    eventId: string;
    edgeDeviceId: string;
  },
  options: { permanent?: boolean } = {},
): Promise<void> {
  await postDeviceAuthorization("revoke", {
    event_id: input.eventId,
    edge_device_id: input.edgeDeviceId,
    permanent: options.permanent ?? true,
  });
}

export function provisioningDefaults(): CameraProvisioningDefaults {
  return {
    signalingUrl:
      process.env.SIGNALING_PUBLIC_URL?.trim() ||
      process.env.SIGNALING_URL ||
      "http://127.0.0.1:8787",
    idpUrl: idpIssuer() ?? "",
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "tolo-signaling",
    firebaseApiKey: process.env.FIREBASE_API_KEY || "demo-tolo-web",
    firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST || null,
    firebaseAuthEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || null,
  };
}
