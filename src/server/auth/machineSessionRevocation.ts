import { getRealAuth } from "./betterAuth";

const KIND = "kind";
const EVENT_ID = "eventId";
const EDGE_DEVICE_ID = "edgeDeviceId";
const PAGE_EDGE_DEVICE_ID = "pageEdgeDeviceId";

type SessionRow = { id: string; token: string };

type SessionAdapter = {
  findMany<T>(args: {
    model: string;
    where: { field: string; value: unknown }[];
  }): Promise<T[] | null>;
  deleteMany(args: {
    model: string;
    where: { field: string; value: unknown }[];
  }): Promise<unknown>;
};

type SessionInternalAdapter = {
  deleteSession(token: string): Promise<unknown>;
};

async function deleteSessionRows(
  adapter: SessionAdapter,
  internalAdapter: SessionInternalAdapter,
  sessions: SessionRow[] | null | undefined,
) {
  for (const session of sessions ?? []) {
    const where = [{ field: "sessionId", value: session.id }];
    await adapter.deleteMany({ model: "eventAccessToken", where });
    await adapter.deleteMany({ model: "tenantAccessToken", where });
    await internalAdapter.deleteSession(session.token);
  }
}

async function revokeMachineSessions(eventId: string, edgeDeviceId?: string) {
  if (!process.env.AUTH_DATABASE_URL) return;
  const { auth } = getRealAuth();
  const { adapter, internalAdapter } = await auth.$context;
  const sessionAdapter = adapter as unknown as SessionAdapter;
  const sessionInternalAdapter =
    internalAdapter as unknown as SessionInternalAdapter;
  const where = [
    { field: KIND, value: "machine" },
    { field: EVENT_ID, value: eventId },
    ...(edgeDeviceId ? [{ field: EDGE_DEVICE_ID, value: edgeDeviceId }] : []),
  ];
  const sessions = await sessionAdapter.findMany<SessionRow>({
    model: "session",
    where,
  });
  await deleteSessionRows(sessionAdapter, sessionInternalAdapter, sessions);

  await sessionAdapter.deleteMany({
    model: "pendingMachineHandoff",
    where: [
      { field: EVENT_ID, value: eventId },
      ...(edgeDeviceId ? [{ field: EDGE_DEVICE_ID, value: edgeDeviceId }] : []),
    ],
  });
  await sessionAdapter.deleteMany({
    model: "pendingMachineAuthorization",
    where: [
      { field: EVENT_ID, value: eventId },
      ...(edgeDeviceId
        ? [{ field: PAGE_EDGE_DEVICE_ID, value: edgeDeviceId }]
        : []),
    ],
  });
}

export async function revokeMachineSessionsForEvent(eventId: string) {
  await revokeMachineSessions(eventId);
}

export async function revokeMachineSessionsForEdge(
  eventId: string,
  edgeDeviceId: string,
) {
  await revokeMachineSessions(eventId, edgeDeviceId);
}
