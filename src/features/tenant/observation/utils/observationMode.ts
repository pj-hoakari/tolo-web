export type ObservationMode = "burst" | "continuous";

type ModeStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): ModeStorage | undefined {
  return typeof window === "undefined" ? undefined : window.localStorage;
}

function storageKey(cameraEdgeId: string): string {
  return `tolo:observation-mode:${cameraEdgeId}`;
}

export function readObservationMode(
  cameraEdgeId: string,
  storage = defaultStorage(),
): ObservationMode {
  try {
    return storage?.getItem(storageKey(cameraEdgeId)) === "continuous"
      ? "continuous"
      : "burst";
  } catch {
    return "burst";
  }
}

export function writeObservationMode(
  cameraEdgeId: string,
  mode: ObservationMode,
  storage = defaultStorage(),
): void {
  try {
    storage?.setItem(storageKey(cameraEdgeId), mode);
  } catch {}
}

export function resolveContinuousKey(
  selectedKey: string | null,
  openKeys: Iterable<string>,
  isContinuous: (key: string) => boolean,
): string | null {
  const keys = [...openKeys];
  if (
    selectedKey !== null &&
    keys.includes(selectedKey) &&
    isContinuous(selectedKey)
  ) {
    return selectedKey;
  }
  return keys.find(isContinuous) ?? null;
}
