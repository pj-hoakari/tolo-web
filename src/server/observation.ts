import "server-only";

import { createClient, type Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import {
  EdgeDeviceService,
  MeasurementIngestService,
} from "@pj-hoakari/tolo-observation-client-es/tolo/observation/v1/observation_pb";

const authorize: Interceptor = (next) => (req) => {
  const token = process.env.OBSERVATION_ACCESS_TOKEN;
  if (token) req.header.set("Authorization", `Bearer ${token}`);
  return next(req);
};

const transport = createConnectTransport({
  baseUrl: process.env.GATEWAY_URL ?? "http://127.0.0.1:8080",
  httpVersion: "1.1",
  interceptors: [authorize],
});

export const edgeDeviceClient = createClient(EdgeDeviceService, transport);

export const measurementIngestClient = createClient(
  MeasurementIngestService,
  transport,
);
