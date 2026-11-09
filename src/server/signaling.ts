import "server-only";

import {
  type Client,
  createClient,
  type Interceptor,
} from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { SignalingService } from "@pj-hoakari/tolo-edge-bridge-client-es/tolo/edgebridge/v1/signaling_pb";
import { connectionEventAccess } from "./auth/connection";
import {
  connectionAccessTokenKey,
  eventAccess,
  eventIdKey,
  pageEdgeDeviceIdKey,
  tenantIdKey,
} from "./authorize";

// Next.js バックエンドから tolo-edge-bridge を呼ぶための Connect-RPC クライアント。
// Connect-RPC はこのサーバ層からのみ叩く（フロントからは叩かない）。
// h2c で待ち受けるサーバへ HTTP/1.1 の Connect プロトコルで接続する。
function signalingClientWith(
  client: "console" | "edge",
): Client<typeof SignalingService> {
  const transport = createConnectTransport({
    baseUrl: process.env.SIGNALING_URL ?? "http://127.0.0.1:8787",
    httpVersion: "1.1",
    interceptors: [eventAccess(client)],
  });
  return createClient(SignalingService, transport);
}

const connectionAuthorization: Interceptor = (next) => async (request) => {
  const eventId = request.contextValues.get(eventIdKey);
  const tenantId = request.contextValues.get(tenantIdKey);
  const pageEdgeDeviceId = request.contextValues.get(pageEdgeDeviceIdKey);
  const cached = request.contextValues.get(connectionAccessTokenKey);
  if (!eventId || !tenantId || !pageEdgeDeviceId) {
    throw new Error("no connection context for an observation camera call");
  }
  const token =
    cached ||
    (await connectionEventAccess(tenantId, eventId, pageEdgeDeviceId));
  request.header.set("Authorization", `Bearer ${token}`);
  return next(request);
};

export const consoleSignalingClient = signalingClientWith("console");

export const edgeSignalingClient = signalingClientWith("edge");

export const connectionSignalingClient = createClient(
  SignalingService,
  createConnectTransport({
    baseUrl: process.env.SIGNALING_URL ?? "http://127.0.0.1:8787",
    httpVersion: "1.1",
    interceptors: [connectionAuthorization],
  }),
);
