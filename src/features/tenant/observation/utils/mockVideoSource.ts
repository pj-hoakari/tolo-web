import type { CrowdVideoSource, VideoSourceDescriptor } from "./videoSource";

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_FPS = 30;

export type MockCameraVideoSourceOptions = {
  label?: string;
  width?: number;
  height?: number;
  fps?: number;
  /**
   * 実際の ESP カメラと同じく、映像を開く前に BFF へ接続を要求する。
   * モックでも接続認可のエラー経路を確認できるようにする。
   */
  requestConnection?: () => Promise<unknown>;
};

function accentFor(label: string): string {
  let hue = 0;
  for (const char of label) {
    hue = (hue * 31 + char.charCodeAt(0)) % 360;
  }
  return `hsl(${hue} 85% 62%)`;
}

/**
 * 実機やカメラ権限なしで複数カメラ UI を確認するための合成映像。
 * canvas を MediaStream に変換し、動く図形とカメラ名を描き続ける。
 */
export function createMockCameraVideoSource(
  options: MockCameraVideoSourceOptions = {},
): CrowdVideoSource {
  const label = options.label ?? "Mock camera";
  const width = Math.max(1, Math.floor(options.width ?? DEFAULT_WIDTH));
  const height = Math.max(1, Math.floor(options.height ?? DEFAULT_HEIGHT));
  const fps = Math.max(1, Math.floor(options.fps ?? DEFAULT_FPS));
  const accent = accentFor(label);

  let canvas: HTMLCanvasElement | null = null;
  let context: CanvasRenderingContext2D | null = null;
  let stream: MediaStream | null = null;
  let track: CanvasCaptureMediaStreamTrack | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastFrameAt: number | null = null;
  let frameIndex = 0;

  const paint = () => {
    if (!canvas || !context) {
      return;
    }

    const time = frameIndex / fps;
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#0b1220");
    gradient.addColorStop(1, "#1e293b");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    const cell = Math.max(32, Math.round(width / 16));
    const offset = (time * 40) % cell;
    context.strokeStyle = "rgba(148, 163, 184, 0.22)";
    context.lineWidth = 2;
    context.beginPath();
    for (let x = -offset; x <= width; x += cell) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    for (let y = -offset; y <= height; y += cell) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();

    const centerX = width / 2;
    const centerY = height / 2;
    context.strokeStyle = "rgba(148, 163, 184, 0.35)";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(centerX, 0);
    context.lineTo(centerX, height);
    context.moveTo(0, centerY);
    context.lineTo(width, centerY);
    context.stroke();

    const orbitX = centerX + Math.sin(time * 1.4) * width * 0.3;
    const orbitY = centerY + Math.cos(time * 1.1) * height * 0.22;
    context.fillStyle = accent;
    context.beginPath();
    context.arc(orbitX, orbitY, width * 0.055, 0, Math.PI * 2);
    context.fill();

    const secondX = centerX + Math.cos(time * 0.9 + 1.5) * width * 0.34;
    const secondY = centerY + Math.sin(time * 1.3 + 0.6) * height * 0.3;
    context.fillStyle = "rgba(248, 250, 252, 0.85)";
    context.beginPath();
    context.arc(secondX, secondY, width * 0.022, 0, Math.PI * 2);
    context.fill();

    const fontSize = Math.round(height * 0.055);
    const padding = Math.round(fontSize * 0.6);
    context.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    context.textBaseline = "top";
    const textWidth = Math.min(
      width - padding * 4,
      context.measureText(label).width,
    );
    const panelHeight = Math.round(fontSize * 1.9);
    context.fillStyle = "rgba(2, 6, 23, 0.78)";
    context.fillRect(padding, padding, textWidth + padding * 2, panelHeight);
    context.fillStyle = accent;
    context.fillRect(padding, padding, Math.round(fontSize * 0.2), panelHeight);
    context.fillStyle = "#f8fafc";
    context.fillText(
      label,
      padding + fontSize * 0.6,
      padding + fontSize * 0.35,
      width - padding * 4,
    );

    const caption = `MOCK CAMERA  ${width}x${height}  frame ${frameIndex}`;
    context.font = `500 ${Math.round(fontSize * 0.55)}px ui-monospace, monospace`;
    context.fillStyle = "rgba(226, 232, 240, 0.8)";
    context.fillText(
      caption,
      padding,
      height - padding - Math.round(fontSize * 0.7),
      width - padding * 4,
    );

    frameIndex += 1;
    lastFrameAt = performance.now();
    track?.requestFrame();
  };

  const stopAnimation = () => {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const close = () => {
    stopAnimation();
    for (const current of stream?.getTracks() ?? []) {
      current.stop();
    }
    stream = null;
    track = null;
    canvas = null;
    context = null;
    lastFrameAt = null;
  };

  return {
    label,
    async open(): Promise<VideoSourceDescriptor> {
      close();
      await options.requestConnection?.();
      if (typeof document === "undefined") {
        throw new Error("合成カメラ映像はブラウザでのみ利用できます");
      }

      const nextCanvas = document.createElement("canvas");
      nextCanvas.width = width;
      nextCanvas.height = height;
      const nextContext = nextCanvas.getContext("2d");
      if (!nextContext) {
        throw new Error("合成カメラ映像用の canvas を初期化できませんでした");
      }

      const nextStream = nextCanvas.captureStream(0);
      const nextTrack = nextStream.getVideoTracks()[0] as
        | CanvasCaptureMediaStreamTrack
        | undefined;
      if (!nextTrack || typeof nextTrack.requestFrame !== "function") {
        for (const current of nextStream.getTracks()) {
          current.stop();
        }
        throw new Error(
          "このブラウザは canvas の手動フレーム送出に対応していません",
        );
      }

      canvas = nextCanvas;
      context = nextContext;
      stream = nextStream;
      track = nextTrack;
      frameIndex = 0;
      paint();
      timer = setInterval(paint, Math.max(16, Math.round(1000 / fps)));

      return { kind: "stream", stream: nextStream };
    },
    close,
    lastFrameAt() {
      return lastFrameAt;
    },
  };
}
