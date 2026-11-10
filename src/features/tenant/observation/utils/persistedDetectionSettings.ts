import {
  applySettings,
  type DetectionSettingsStore,
  parseDetectionSettings,
} from "@/features/tenant/detection/stores/detectionStore";

export const detectionSettingsStorageKey = (
  eventId: string,
  edgeDeviceId: string,
  cameraKey: string,
) =>
  `tolo:observation-detection-settings:${eventId}:${edgeDeviceId}:${cameraKey}`;

export function persistDetectionSettings(
  store: DetectionSettingsStore,
  storageKey: string,
): () => void {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const saved = raw === null ? null : parseDetectionSettings(JSON.parse(raw));
    if (saved) applySettings(store, saved);
  } catch (cause) {
    console.error("failed to restore detection settings", cause);
  }
  return store.subscribe((settings, previous) => {
    if (settings === previous) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch (cause) {
      console.error("failed to save detection settings", cause);
    }
  });
}
