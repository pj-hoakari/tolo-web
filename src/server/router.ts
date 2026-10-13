import { Code, ConnectError } from "@connectrpc/connect";
import { ORPCError, os } from "@orpc/server";
import { z } from "zod";
import { graphDataSchema } from "@/features/graph/graphDataSchema";
import type { GraphData } from "@/features/tenant/management/graph/type";
import { graphAuthoringClient } from "./graphAuthoring";
import { fromGraphDocument, toGraphDocument } from "./graphDocument";
import { callObservation } from "./observation";
import { signalingClient } from "./signaling";

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
    name?: string;
    online?: boolean;
    lastHeartbeatAt?: string;
    observationPoints?: { observationPointId: string; name?: string }[];
  }[];
};

export interface EdgeDevice {
  edgeDeviceId: string;
  name: string;
  online: boolean;
  lastHeartbeatAt: string | null;
  observationPoints: ObservationPoint[];
}

async function listEdgeDevices(eventId: string): Promise<EdgeDevice[]> {
  const res = await callObservation<ListEdgeDevicesResponse>(
    "EdgeDeviceService/ListEdgeDevices",
    { eventId },
  );
  return (res.devices ?? []).map((d) => ({
    edgeDeviceId: d.edgeDeviceId,
    name: d.name ?? "",
    online: d.online ?? false,
    lastHeartbeatAt: d.lastHeartbeatAt
      ? new Date(d.lastHeartbeatAt).toISOString()
      : null,
    observationPoints: (d.observationPoints ?? []).map((p) => ({
      observationPointId: p.observationPointId,
      name: p.name ?? "",
    })),
  }));
}

// フロント ↔ Next.js バックエンド間の oRPC ルータ。
// tolo-edge-bridge への Connect-RPC はこの層だけが叩く。
export const router = {
  graph: {
    getGraph: os
      .input(z.object({ eventId: z.string().min(1) }))
      .handler(async ({ input }): Promise<GraphData> => {
        try {
          const res = await graphAuthoringClient.getGraph(input);
          return res.document
            ? fromGraphDocument(res.document)
            : { nodes: [], edges: [] };
        } catch (err) {
          if (err instanceof ConnectError && err.code === Code.NotFound) {
            return { nodes: [], edges: [] };
          }
          throw err;
        }
      }),
    saveGraph: os
      .input(z.object({ eventId: z.string().min(1), graph: graphDataSchema }))
      .handler(async ({ input }): Promise<void> => {
        try {
          await graphAuthoringClient.saveGraph({
            eventId: input.eventId,
            document: toGraphDocument(input.graph),
          });
        } catch (err) {
          if (
            err instanceof ConnectError &&
            err.code === Code.InvalidArgument
          ) {
            throw new ORPCError("BAD_REQUEST", { message: err.rawMessage });
          }
          throw err;
        }
      }),
  },
  signaling: {
    // edge への接続を要求する。tolo-edge-bridge が Firestore にセッションを作成し session_id を返す。
    requestConnection: os
      .input(z.object({ edgeId: z.string().min(1) }))
      .handler(async ({ input }): Promise<{ sessionId: string }> => {
        const res = await signalingClient.requestConnection({
          edgeDeviceId: input.edgeId,
        });
        return { sessionId: res.sessionId };
      }),
  },
  observation: {
    listEdgeDevices: os.input(z.object({ eventId: z.string().min(1) })).handler(
      async ({ input }): Promise<{ devices: EdgeDevice[] }> => ({
        devices: await listEdgeDevices(input.eventId),
      }),
    ),
    listObservationPoints: os
      .input(edgeDeviceInput)
      .handler(
        async ({
          input,
        }): Promise<{ observationPoints: ObservationPoint[] }> => {
          const devices = await listEdgeDevices(input.eventId);
          const device = devices.find(
            (d) => d.edgeDeviceId === input.edgeDeviceId,
          );
          return { observationPoints: device?.observationPoints ?? [] };
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
