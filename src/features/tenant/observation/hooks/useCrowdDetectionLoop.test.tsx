// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  createDetectionStores,
  type DetectionStores,
} from "@/features/tenant/detection/stores/detectionStore";
import { useCrowdDetectionLoop } from "./useCrowdDetectionLoop";

vi.mock("../utils/broadcastStream", () => ({
  createBroadcastStream: () => ({
    stream: { getTracks: () => [], getVideoTracks: () => [] },
    dispose: () => {},
  }),
}));

vi.mock("../utils/detectCrowd", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/detectCrowd")>()),
  detectCrowdFrame: () =>
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            detections: [
              { trackId: 1, score: 0.9, x1: 0, y1: 0, x2: 10, y2: 10 },
            ],
            lineCounts: {},
          }),
        50,
      ),
    ),
}));

afterEach(cleanup);

const ignoreFrame = () => {};

function readyVideo(): HTMLVideoElement {
  const video = document.createElement("video");
  Object.defineProperties(video, {
    readyState: { value: HTMLMediaElement.HAVE_ENOUGH_DATA },
    videoWidth: { value: 640 },
    videoHeight: { value: 480 },
  });
  return video;
}

function Detecting({ stores }: { stores: DetectionStores }) {
  const videoRef = useRef<HTMLVideoElement | null>(readyVideo());
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [, setBroadcastStream] = useState<MediaStream | null>(null);
  useCrowdDetectionLoop({
    videoRef,
    overlayCanvasRef,
    status: "detecting",
    settingsStore: stores.settingsStore,
    viewStateStore: stores.viewStateStore,
    resultStore: stores.resultStore,
    observationPointIdByName: null,
    onBroadcastStreamChange: setBroadcastStream,
    onDetectionFrame: ignoreFrame,
    onDetectionError: () => {},
  });
  return null;
}

it("keeps detecting when the caller passes a new error handler on every render", async () => {
  const stores = createDetectionStores();
  render(<Detecting stores={stores} />);
  await waitFor(
    () => expect(stores.resultStore.getState().metrics.trackedCount).toBe(1),
    { timeout: 2000 },
  );
});
