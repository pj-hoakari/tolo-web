import "server-only";

import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { EdgeRegistryService } from "@pj-hoakari/tolo-signaling-client-es/signaling/v1/edge_registry_pb";
import { SignalingService } from "@pj-hoakari/tolo-signaling-client-es/signaling/v1/signaling_pb";

// Next.js バックエンドから tolo-signaling を呼ぶための Connect-RPC クライアント。
// Connect-RPC はこのサーバ層からのみ叩く（フロントからは叩かない）。
// h2c で待ち受けるサーバへ HTTP/1.1 の Connect プロトコルで接続する。
const transport = createConnectTransport({
  baseUrl: process.env.SIGNALING_URL ?? "http://127.0.0.1:8787",
  httpVersion: "1.1",
});

export const edgeRegistryClient = createClient(EdgeRegistryService, transport);
export const signalingClient = createClient(SignalingService, transport);
