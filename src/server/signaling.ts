import "server-only";

import { createClient, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { SignalingService } from "@pj-hoakari/tolo-edge-bridge-client-es/tolo/edgebridge/v1/signaling_pb";

const authorize: Interceptor = (next) => (req) => {
  const token = process.env.GRAPH_ACCESS_TOKEN;
  if (token) req.header.set("Authorization", `Bearer ${token}`);
  return next(req);
};

// Next.js バックエンドから tolo-edge-bridge を呼ぶための Connect-RPC クライアント。
// Connect-RPC はこのサーバ層からのみ叩く（フロントからは叩かない）。
// h2c で待ち受けるサーバへ HTTP/1.1 の Connect プロトコルで接続する。
const transport = createConnectTransport({
  baseUrl: process.env.SIGNALING_URL ?? "http://127.0.0.1:8787",
  httpVersion: "1.1",
  interceptors: [authorize],
});

export const signalingClient = createClient(SignalingService, transport);
