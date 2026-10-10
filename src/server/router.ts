import { timestampDate } from "@bufbuild/protobuf/wkt";
import { os } from "@orpc/server";
import { z } from "zod";
import { callObservation } from "./observation";
import { edgeRegistryClient, signalingClient } from "./signaling";

const publicId = z.string().regex(/^[0-9a-f]{16}$/);

const edgeDeviceInput = z.object({
  eventId: z.string().min(1),
  edgeDeviceId: publicId,
});

export interface ObservationPoint {
  observationPointId: string;
  name: string;
}

type ListEdgeDevicesResponse = {
  devices?: {
    edgeDeviceId: string;
    observationPoints?: { observationPointId: string; name?: string }[];
  }[];
};

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
  observation: {
    listObservationPoints: os
      .input(edgeDeviceInput)
      .handler(
        async ({
          input,
        }): Promise<{ observationPoints: ObservationPoint[] }> => {
          const res = await callObservation<ListEdgeDevicesResponse>(
            "EdgeDeviceService/ListEdgeDevices",
            { eventId: input.eventId },
          );
          const device = res.devices?.find(
            (d) => d.edgeDeviceId === input.edgeDeviceId,
          );
          return {
            observationPoints: (device?.observationPoints ?? []).map((p) => ({
              observationPointId: p.observationPointId,
              name: p.name ?? "",
            })),
          };
        },
      ),
    heartbeat: os
      .input(
        edgeDeviceInput.extend({
          activeObservationPointIds: z.array(publicId),
        }),
      )
      .handler(async ({ input }): Promise<void> => {
        await callObservation("EdgeDeviceService/Heartbeat", input);
      }),
    reportMeasurements: os
      .input(
        edgeDeviceInput.extend({
          measurements: z.array(
            z.object({
              observationPointId: publicId,
              windowStart: z.date(),
              windowEnd: z.date(),
              countIn: z.number().int().nonnegative(),
              countOut: z.number().int().nonnegative(),
              meanDetectedPeople: z.number().nonnegative().finite().optional(),
            }),
          ),
        }),
      )
      .handler(async ({ input }): Promise<void> => {
        await callObservation("MeasurementIngestService/ReportMeasurements", {
          eventId: input.eventId,
          edgeDeviceId: input.edgeDeviceId,
          measurements: input.measurements.map((m) => ({
            ...m,
            windowStart: m.windowStart.toISOString(),
            windowEnd: m.windowEnd.toISOString(),
            source: "MEASUREMENT_SOURCE_EDGE",
          })),
        });
      }),
  },
};
