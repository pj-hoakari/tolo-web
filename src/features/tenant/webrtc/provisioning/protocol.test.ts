import { describe, expect, it } from "vitest";
import { encodeConfigCommand, parseDeviceMessage } from "./protocol";

describe("encodeConfigCommand", () => {
  it("encodes the config command as one JSON line with the contract fields", () => {
    const line = encodeConfigCommand({
      wifiSsid: "reception",
      wifiPassword: "secret",
      signalingUrl: "https://signaling.example",
      idpUrl: "https://idp.example",
      firebaseProjectId: "project-1",
      firebaseApiKey: "api-key-1",
      firestoreEmulatorHost: "firestore:8080",
      firebaseAuthEmulatorHost: null,
      edgeDeviceId: "0123456789abcdef",
    });

    expect(line).not.toContain("\n");
    expect(JSON.parse(line)).toEqual({
      type: "config",
      version: 1,
      wifi_ssid: "reception",
      wifi_password: "secret",
      signaling_url: "https://signaling.example",
      idp_url: "https://idp.example",
      firebase_project_id: "project-1",
      firebase_api_key: "api-key-1",
      firestore_emulator_host: "firestore:8080",
      firebase_auth_emulator_host: "",
      edge_device_id: "0123456789abcdef",
    });
  });
});

describe("parseDeviceMessage", () => {
  it("parses a successful config result", () => {
    expect(parseDeviceMessage('{"type":"config_result","ok":true}')).toEqual({
      type: "config_result",
      ok: true,
    });
  });

  it("parses a failed config result with its error", () => {
    expect(
      parseDeviceMessage(
        '{"type":"config_result","ok":false,"error":"invalid wifi"}',
      ),
    ).toEqual({
      type: "config_result",
      ok: false,
      error: "invalid wifi",
    });
  });

  it("parses a device authorization", () => {
    expect(
      parseDeviceMessage(
        '{"type":"device_authorization","user_code":"ABCD-EFGH","verification_uri":"https://idp.example/device","expires_in":600}',
      ),
    ).toEqual({
      type: "device_authorization",
      user_code: "ABCD-EFGH",
      verification_uri: "https://idp.example/device",
      expires_in: 600,
    });
  });

  it("parses an authorization result", () => {
    expect(
      parseDeviceMessage('{"type":"authorization_result","ok":true}'),
    ).toEqual({
      type: "authorization_result",
      ok: true,
    });
  });

  it("parses an error message", () => {
    expect(
      parseDeviceMessage('{"type":"error","error":"authorization required"}'),
    ).toEqual({
      type: "error",
      error: "authorization required",
    });
  });

  it("parses a status message", () => {
    expect(
      parseDeviceMessage(
        '{"type":"status","configured":true,"edge_device_id":"0123456789abcdef","authorization":"pending"}',
      ),
    ).toEqual({
      type: "status",
      configured: true,
      edge_device_id: "0123456789abcdef",
      authorization: "pending",
    });
  });

  it("ignores malformed lines and unknown message types", () => {
    expect(parseDeviceMessage("not json")).toBeNull();
    expect(parseDeviceMessage('{"type":"config_result"}')).toBeNull();
    expect(parseDeviceMessage('{"type":"unknown"}')).toBeNull();
    expect(parseDeviceMessage('{"no_type":true}')).toBeNull();
  });
});
