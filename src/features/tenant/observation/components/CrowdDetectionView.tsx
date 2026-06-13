"use client";

import { useEffect, useRef } from "react";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";

export type CrowdDetectionViewProps = {
  stream: MediaStream | null;
  status: DetectCrowdStatus;
  error: string | null;
};

export function CrowdDetectionView({
  stream,
  status,
  error,
}: CrowdDetectionViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center rounded bg-black/40 text-white">
            起動中…
          </div>
        )}
      </div>
      {status === "error" && error && <p className="text-red-600">{error}</p>}
    </div>
  );
}
