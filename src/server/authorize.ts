import "server-only";

import {
  createContextKey,
  type Interceptor,
  type StreamRequest,
  type UnaryRequest,
} from "@connectrpc/connect";
import { type AccessTokenRequest, getAccessToken } from "./auth";

export const eventIdKey = createContextKey("", { description: "eventId" });

function authorize(
  toRequest: (req: UnaryRequest | StreamRequest) => AccessTokenRequest,
): Interceptor {
  return (next) => async (req) => {
    const token = await getAccessToken(toRequest(req));
    req.header.set("Authorization", `Bearer ${token}`);
    return next(req);
  };
}

function eventIdOf(req: UnaryRequest | StreamRequest): string {
  const fromMessage =
    !req.stream && "eventId" in req.message ? req.message.eventId : undefined;
  const eventId =
    typeof fromMessage === "string" && fromMessage
      ? fromMessage
      : req.contextValues.get(eventIdKey);
  if (!eventId) {
    throw new Error(`no eventId for event-scoped call ${req.url}`);
  }
  return eventId;
}

export const tenantAccess = authorize(() => ({ type: "tenant_access" }));

export function eventAccess(
  client: Extract<AccessTokenRequest, { type: "event_access" }>["client"],
): Interceptor {
  return authorize((req) => ({
    type: "event_access",
    eventId: eventIdOf(req),
    client,
  }));
}
