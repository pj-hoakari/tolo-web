import "server-only";

import { createClient, type Transport } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import {
  EdgeDeviceService,
  MeasurementIngestService,
} from "@pj-hoakari/tolo-observation-client-es/tolo/observation/v1/observation_pb";
import { eventAccess } from "./authorize";

function transportWith(client: "console" | "edge"): Transport {
  return createConnectTransport({
    baseUrl: process.env.GATEWAY_URL ?? "http://127.0.0.1:8080",
    httpVersion: "1.1",
    interceptors: [eventAccess(client)],
  });
}

const consoleTransport = transportWith("console");
const edgeTransport = transportWith("edge");

export const consoleEdgeDeviceClient = createClient(
  EdgeDeviceService,
  consoleTransport,
);

export const edgeEdgeDeviceClient = createClient(
  EdgeDeviceService,
  edgeTransport,
);

export const edgeMeasurementIngestClient = createClient(
  MeasurementIngestService,
  edgeTransport,
);
