import { type BroadcastStreamHandle, noopDispose } from "./broadcastStream";

/**
 * 開発専用: ファイル再生ソース（DevVideoSourcePanel）の配信用フォールバック。
 *
 * 本番の映像ソースはカメラ（MediaStream）だけなので、このモジュールは
 * 開発ビルドでのみ createBroadcastStream から呼ばれる。
 * Chromium は captureStream、Firefox はプレフィックス付きの
 * mozCaptureStream で video 要素から直接キャプチャする。
 */
export function createDevBroadcastStream(
  video: HTMLVideoElement,
): BroadcastStreamHandle | null {
  const captureCapable = video as HTMLVideoElement & {
    captureStream?: () => MediaStream;
    mozCaptureStream?: () => MediaStream;
  };
  const captureStream =
    captureCapable.captureStream ?? captureCapable.mozCaptureStream;
  if (typeof captureStream === "function") {
    return { stream: captureStream.call(video), dispose: noopDispose };
  }

  return createCanvasRelayStream(video);
}

function syncCanvasSize(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): void {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

/**
 * media 要素の captureStream を持たないブラウザ（Safari など）向けの
 * フォールバック。新しい映像フレームが届いたときだけ canvas へ転写して
 * canvas.captureStream() で配信する（rAF 毎の常時再描画はしない）。
 */
function createCanvasRelayStream(
  video: HTMLVideoElement,
): BroadcastStreamHandle | null {
  const canvas = document.createElement("canvas");
  syncCanvasSize(canvas, video.videoWidth, video.videoHeight);
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const drawFrame = () => {
    syncCanvasSize(canvas, video.videoWidth, video.videoHeight);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  };

  let disposed = false;
  let cancel: () => void;

  if (typeof video.requestVideoFrameCallback === "function") {
    let callbackId = 0;
    const onFrame = () => {
      if (disposed) {
        return;
      }
      drawFrame();
      callbackId = video.requestVideoFrameCallback(onFrame);
    };
    callbackId = video.requestVideoFrameCallback(onFrame);
    cancel = () => video.cancelVideoFrameCallback(callbackId);
  } else {
    let rafId = 0;
    const onFrame = () => {
      if (disposed) {
        return;
      }
      drawFrame();
      rafId = requestAnimationFrame(onFrame);
    };
    rafId = requestAnimationFrame(onFrame);
    cancel = () => cancelAnimationFrame(rafId);
  }

  drawFrame();
  return {
    stream: canvas.captureStream(),
    dispose: () => {
      disposed = true;
      cancel();
    },
  };
}
