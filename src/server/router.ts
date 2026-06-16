import { timestampDate } from "@bufbuild/protobuf/wkt";
import { os } from "@orpc/server";
import { z } from "zod";
import { edgeRegistryClient, signalingClient } from "./signaling";

export interface AliveEdge {
  id: string;
  // ISO 8601 文字列。presence が未設定なら null。
  lastSeenAt: string | null;
}

// フロント ↔ Next.js バックエンド間の oRPC ルータ。
// tolo-signaling への Connect-RPC はこの層だけが叩く。
export const router = {
  edges: {
    // 生存している edge の一覧を取得する（Connect-RPC で tolo-signaling に問い合わせ）。
    listAlive: os.handler(async (): Promise<{ edges: AliveEdge[] }> => {
      const res = await edgeRegistryClient.listAliveEdges({});
      return {
        edges: res.edges.map((edge) => ({
          id: edge.id,
          lastSeenAt: edge.lastSeenAt
            ? timestampDate(edge.lastSeenAt).toISOString()
            : null,
        })),
      };
    }),
  },
  signaling: {
    // edge への接続を要求する。tolo-signaling が Firestore にセッションを作成し session_id を返す。
    requestConnection: os
      .input(z.object({ edgeId: z.string().min(1) }))
      .handler(async ({ input }): Promise<{ sessionId: string }> => {
        const res = await signalingClient.requestConnection({
          edgeId: input.edgeId,
        });
        return { sessionId: res.sessionId };
      }),
  },
};
