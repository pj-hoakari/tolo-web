import { memo, type RefObject, useEffect } from "react";
import { useCountingLineEditor } from "@/features/tenant/detection/hooks/useCountingLineEditor";
import type {
  DetectionSettingsStore,
  DetectionViewStateStore,
} from "@/features/tenant/detection/stores/detectionStore";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";
import type { VideoSourceDescriptor } from "../utils/videoSource";

export type DetectionVideoStageProps = {
  videoSource: VideoSourceDescriptor | null;
  status: DetectCrowdStatus;
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayCanvasRef: RefObject<HTMLCanvasElement | null>;
  settingsStore: DetectionSettingsStore;
  viewStateStore: DetectionViewStateStore;
};

/**
 * 映像とカウントライン操作用のオーバーレイ
 *
 * ラインの描画は検出ループが canvas へ直接行う。
 */
function DetectionVideoStageComponent({
  videoSource,
  status,
  videoRef,
  overlayCanvasRef,
  settingsStore,
  viewStateStore,
}: DetectionVideoStageProps) {
  const lineEditorHandlers = useCountingLineEditor({
    canvasRef: overlayCanvasRef,
    settingsStore,
    viewStateStore,
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!videoSource) {
      video.srcObject = null;
      video.removeAttribute("src");
      video.loop = false;
      video.load();
      return;
    }

    if (videoSource.kind === "stream") {
      video.removeAttribute("src");
      video.loop = false;
      video.srcObject = videoSource.stream;
    } else {
      video.srcObject = null;
      video.loop = videoSource.loop;
      video.src = videoSource.url;
    }
  }, [videoSource, videoRef]);

  return (
    <div className="relative w-full max-w-3xl">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="block h-auto w-full rounded bg-black"
      >
        <track kind="captions" />
      </video>
      <canvas
        ref={overlayCanvasRef}
        {...lineEditorHandlers}
        className="absolute inset-0 h-full w-full cursor-crosshair touch-none rounded"
      />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center rounded bg-black/40 text-white">
          起動中…
        </div>
      )}
    </div>
  );
}

export const DetectionVideoStage = memo(DetectionVideoStageComponent);
