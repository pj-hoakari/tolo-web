import "server-only";

import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-node";
import { GuestPageService } from "@pj-hoakari/tolo-guest-client-es/tolo/guest/v1/guest_pb";

export const guestPageClient = createClient(
  GuestPageService,
  createConnectTransport({
    baseUrl: process.env.GATEWAY_URL ?? "http://127.0.0.1:8080",
    httpVersion: "1.1",
  }),
);
