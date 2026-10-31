import "server-only";

import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { GraphAuthoringService } from "@pj-hoakari/tolo-graph-authoring-client-es/tolo/graph/v1/graph_pb";
import { eventAccess } from "./authorize";

export const graphAuthoringClient = createClient(
  GraphAuthoringService,
  createConnectTransport({
    baseUrl: process.env.GATEWAY_URL ?? "http://127.0.0.1:8080",
    httpVersion: "1.1",
    interceptors: [eventAccess("console")],
  }),
);
