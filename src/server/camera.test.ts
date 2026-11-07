import { encodeBasicCredentials } from "better-auth/oauth2";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAccessToken } from "./auth";
import { authMockingEnabled } from "./auth/mocking";
import {
  approveDeviceAuthorization,
  provisioningDefaults,
  revokeDeviceAuthorization,
} from "./camera";

vi.mock("server-only", () => ({}));
vi.mock("./auth", () => ({ getAccessToken: vi.fn() }));
vi.mock("./auth/mocking", () => ({ authMockingEnabled: vi.fn() }));

const eventId = "fedcba9876543210";
const edgeDeviceId = "0123456789abcdee";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

function stubIdp() {
  vi.stubEnv("AUTH_IDP_ISSUER", "https://idp.test/");
  vi.stubEnv("AUTH_IDP_CLIENT_ID", "console-ui");
  vi.stubEnv("AUTH_IDP_CLIENT_SECRET", "console-secret");
  vi.mocked(authMockingEnabled).mockReturnValue(false);
  vi.mocked(getAccessToken).mockResolvedValue("staff-token");
}

describe("device authorization", () => {
  it("approves with Basic client credentials and the staff tenant_access header", async () => {
    stubIdp();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await approveDeviceAuthorization({
      eventId,
      edgeDeviceId,
      userCode: "ABCD-EFGH",
    });

    expect(getAccessToken).toHaveBeenCalledWith({ type: "tenant_access" });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://idp.test/api/device-authorization/approve",
      {
        method: "POST",
        headers: {
          authorization: encodeBasicCredentials("console-ui", "console-secret"),
          "content-type": "application/json",
          accept: "application/json",
          "X-Tolo-Staff-Token": "staff-token",
        },
        body: JSON.stringify({
          user_code: "ABCD-EFGH",
          event_id: eventId,
          edge_device_id: edgeDeviceId,
        }),
      },
    );
  });

  it("revokes permanently by default with the event and edge device without a user code", async () => {
    stubIdp();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await revokeDeviceAuthorization({ eventId, edgeDeviceId });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://idp.test/api/device-authorization/revoke",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Tolo-Staff-Token": "staff-token",
        }),
        body: JSON.stringify({
          event_id: eventId,
          edge_device_id: edgeDeviceId,
          permanent: true,
        }),
      }),
    );
  });

  it("stops a camera temporarily when permanent is false", async () => {
    stubIdp();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await revokeDeviceAuthorization(
      { eventId, edgeDeviceId },
      { permanent: false },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://idp.test/api/device-authorization/revoke",
      expect.objectContaining({
        body: JSON.stringify({
          event_id: eventId,
          edge_device_id: edgeDeviceId,
          permanent: false,
        }),
      }),
    );
  });

  it("sends an explicit reapproval only when requested", async () => {
    stubIdp();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));

    await approveDeviceAuthorization(
      { eventId, edgeDeviceId, userCode: "ABCD-EFGH" },
      { reapproval: true },
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://idp.test/api/device-authorization/approve",
      expect.objectContaining({
        body: JSON.stringify({
          user_code: "ABCD-EFGH",
          event_id: eventId,
          edge_device_id: edgeDeviceId,
          reapproval: true,
        }),
      }),
    );
  });

  it("surfaces an IdP failure without exposing the staff token", async () => {
    stubIdp();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("denied", { status: 403 }),
    );

    const error = await revokeDeviceAuthorization({
      eventId,
      edgeDeviceId,
    }).catch((e: unknown) => e);

    expect(error).toMatchObject({ code: "BAD_GATEWAY" });
    expect((error as Error).message).not.toContain("staff-token");
    expect((error as Error).message).not.toContain("console-secret");
  });

  it("uses a deterministic mock path when AUTH_MOCKING is enabled without an IdP issuer", async () => {
    vi.stubEnv("AUTH_IDP_ISSUER", "");
    vi.mocked(authMockingEnabled).mockReturnValue(true);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      approveDeviceAuthorization({
        eventId,
        edgeDeviceId,
        userCode: "ABCD-EFGH",
      }),
    ).resolves.toBeUndefined();
    await expect(
      revokeDeviceAuthorization({ eventId, edgeDeviceId }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it("refuses when neither the IdP issuer nor AUTH_MOCKING is configured", async () => {
    vi.stubEnv("AUTH_IDP_ISSUER", "");
    vi.mocked(authMockingEnabled).mockReturnValue(false);

    await expect(
      revokeDeviceAuthorization({ eventId, edgeDeviceId }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

describe("provisioningDefaults", () => {
  it("returns the configured non-secret values", () => {
    vi.stubEnv("SIGNALING_PUBLIC_URL", "https://signaling.example");
    vi.stubEnv("SIGNALING_URL", "http://internal:8787");
    vi.stubEnv("FIREBASE_PROJECT_ID", "project-1");
    vi.stubEnv("FIREBASE_API_KEY", "api-key-1");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "firestore:8080");
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "auth:9099");
    vi.stubEnv("AUTH_IDP_ISSUER", "https://idp.test/");

    expect(provisioningDefaults()).toEqual({
      signalingUrl: "https://signaling.example",
      idpUrl: "https://idp.test",
      firebaseProjectId: "project-1",
      firebaseApiKey: "api-key-1",
      firestoreEmulatorHost: "firestore:8080",
      firebaseAuthEmulatorHost: "auth:9099",
    });
  });

  it("falls back to the signaling URL and omits unset emulator hosts", () => {
    vi.stubEnv("SIGNALING_PUBLIC_URL", "");
    vi.stubEnv("SIGNALING_URL", "http://internal:8787");
    vi.stubEnv("FIREBASE_PROJECT_ID", "");
    vi.stubEnv("FIREBASE_API_KEY", "");
    vi.stubEnv("FIRESTORE_EMULATOR_HOST", "");
    vi.stubEnv("FIREBASE_AUTH_EMULATOR_HOST", "");
    vi.stubEnv("AUTH_IDP_ISSUER", "");

    expect(provisioningDefaults()).toEqual({
      signalingUrl: "http://internal:8787",
      idpUrl: "",
      firebaseProjectId: "tolo-signaling",
      firebaseApiKey: "demo-tolo-web",
      firestoreEmulatorHost: null,
      firebaseAuthEmulatorHost: null,
    });
  });
});
