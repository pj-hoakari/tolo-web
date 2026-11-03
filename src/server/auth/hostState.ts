import type { DBAdapter } from "better-auth";

export const BROWSER_HOST_STATE = "browserHostState";

export type BrowserHostState = {
  id: string;
  host: string;
  browserHash: string;
  generation: number;
  machineAt?: Date | null;
  updatedAt: Date;
};

export function hostLockKey(host: string, browserHash: string): string {
  return `browser-host:${host}:${browserHash}`;
}

export async function ensureHostState(
  store: DBAdapter,
  host: string,
  browserHash: string,
): Promise<BrowserHostState> {
  const existing = await store.findOne<BrowserHostState>({
    model: BROWSER_HOST_STATE,
    where: [
      { field: "host", value: host },
      { field: "browserHash", value: browserHash },
    ],
  });
  if (existing) return existing;
  try {
    return await store.create<Omit<BrowserHostState, "id">, BrowserHostState>({
      model: BROWSER_HOST_STATE,
      data: { host, browserHash, generation: 0, updatedAt: new Date() },
    });
  } catch (error) {
    const raced = await store.findOne<BrowserHostState>({
      model: BROWSER_HOST_STATE,
      where: [
        { field: "host", value: host },
        { field: "browserHash", value: browserHash },
      ],
    });
    if (raced) return raced;
    throw error;
  }
}

export async function advanceHostState(
  store: DBAdapter,
  host: string,
  browserHash: string,
): Promise<number> {
  const state = await ensureHostState(store, host, browserHash);
  const now = new Date();
  const generation = Number(state.generation) + 1;
  await store.update({
    model: BROWSER_HOST_STATE,
    where: [{ field: "id", value: state.id }],
    update: { generation, machineAt: now, updatedAt: now },
  });
  return generation;
}

export async function machineSessionExists(
  store: DBAdapter,
  host: string,
  browserHash: string,
): Promise<boolean> {
  const session = await store.findOne<{ id: string }>({
    model: "session",
    where: [
      { field: "host", value: host },
      { field: "browserHash", value: browserHash },
      { field: "kind", value: "machine" },
    ],
  });
  return !!session;
}
