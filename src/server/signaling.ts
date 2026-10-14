import "server-only";

import { type Client, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { SignalingService } from "@pj-hoakari/tolo-edge-bridge-client-es/tolo/edgebridge/v1/signaling_pb";

// Next.js バックエンドから tolo-edge-bridge を呼ぶための Connect-RPC クライアント。
// Connect-RPC はこのサーバ層からのみ叩く（フロントからは叩かない）。
// h2c で待ち受けるサーバへ HTTP/1.1 の Connect プロトコルで接続する。
function signalingClientWith(
  accessToken: () => string | undefined,
): Client<typeof SignalingService> {
  const transport = createConnectTransport({
    baseUrl: process.env.SIGNALING_URL ?? "http://127.0.0.1:8787",
    httpVersion: "1.1",
    interceptors: [
      (next) => (req) => {
        const token = accessToken();
        if (token) req.header.set("Authorization", `Bearer ${token}`);
        return next(req);
      },
    ],
  });
  return createClient(SignalingService, transport);
}

export const consoleSignalingClient = signalingClientWith(
  () => process.env.GRAPH_ACCESS_TOKEN,
);

export const edgeSignalingClient = signalingClientWith(
  () => process.env.OBSERVATION_ACCESS_TOKEN,
);
