import "server-only";

async function issueToken(
  kind: string,
  request: Record<string, string>,
): Promise<string> {
  const res = await fetch(
    `${process.env.FAKEIDP_URL ?? "http://127.0.0.1:8082"}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
  if (!res.ok) {
    throw new Error(`fake IdP returned ${res.status} for ${kind}`);
  }
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

export function issueRegistrationToken(sub: string): Promise<string> {
  return issueToken("a registration token", {
    token_use: "registration",
    sub,
    client_id: "console-ui",
    scope: "tenant.join",
  });
}

export function issueEdgeAccessToken(target: {
  tenantId: string;
  eventId: string;
  edgeDeviceId: string;
}): Promise<string> {
  return issueToken("an edge event_access token", {
    token_use: "event_access",
    sub: "dev-edge",
    client_id: "edge-page",
    tenant_id: target.tenantId,
    event_id: target.eventId,
    edge_device_id: target.edgeDeviceId,
    scope: "events.read events.report",
  });
}
