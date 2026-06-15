"use client";

import { useEffect, useRef, useState } from "react";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";
import { detectCrowdFrame } from "../utils/detectCrowd";

export type CrowdDetectionViewProps = {
  stream: MediaStream | null;
  status: DetectCrowdStatus;
  error: string | null;
  onDetectionError: (cause: unknown) => void;
};

export function CrowdDetectionView({
  stream,
  status,
  error,
  onDetectionError,
}: CrowdDetectionViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [lineCount, setLineCount] = useState({ forward: 0, backward: 0 });

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (status !== "detecting") {
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      setLineCount({ forward: 0, backward: 0 });
      return;
    }

    let animationFrameId = 0;
    let cancelled = false;

    const detectFrame = async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        !video ||
        !canvas ||
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        animationFrameId = requestAnimationFrame(detectFrame);
        return;
      }

      try {
        const frame = await detectCrowdFrame(video);

        if (cancelled) {
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("検出結果を描画する canvas を初期化できませんでした");
        }

        context.clearRect(0, 0, canvas.width, canvas.height);
        context.lineWidth = Math.max(2, canvas.width / 320);
        context.font = `${Math.max(16, canvas.width / 40)}px sans-serif`;
        context.strokeStyle = "#f59e0b";
        context.setLineDash([12, 8]);
        context.beginPath();
        context.moveTo(frame.countingLine.p1.x, frame.countingLine.p1.y);
        context.lineTo(frame.countingLine.p2.x, frame.countingLine.p2.y);
        context.stroke();
        context.setLineDash([]);

        for (const detection of frame.detections) {
          const width = detection.x2 - detection.x1;
          const height = detection.y2 - detection.y1;
          const label = `Person #${detection.trackId} ${Math.round(
            detection.score * 100,
          )}%`;

          context.strokeStyle = "#22c55e";
          context.fillStyle = "#22c55e";
          context.strokeRect(detection.x1, detection.y1, width, height);

          const labelWidth = context.measureText(label).width + 12;
          const labelHeight = Math.max(22, canvas.width / 32);
          const labelY = Math.max(0, detection.y1 - labelHeight);
          context.fillRect(detection.x1, labelY, labelWidth, labelHeight);
          context.fillStyle = "#052e16";
          context.fillText(label, detection.x1 + 6, labelY + labelHeight - 6);
        }

        setLineCount((current) =>
          current.forward === frame.lineCount.forward &&
          current.backward === frame.lineCount.backward
            ? current
            : frame.lineCount,
        );

        animationFrameId = requestAnimationFrame(detectFrame);
      } catch (cause) {
        if (!cancelled) {
          onDetectionError(cause);
        }
      }
    };

    animationFrameId = requestAnimationFrame(detectFrame);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, [status, onDetectionError]);

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div className="relative w-full max-w-3xl">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="aspect-video w-full rounded bg-black"
        >
          <track kind="captions" />
        </video>
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full rounded"
        />
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center rounded bg-black/40 text-white">
            起動中…
          </div>
        )}
      </div>
      <div className="flex gap-6 text-sm">
        <span>ライン通過 forward: {lineCount.forward}</span>
        <span>ライン通過 backward: {lineCount.backward}</span>
      </div>
      {status === "error" && error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
