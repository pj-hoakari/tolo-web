"use client";

import { useDetectCrowd } from "../hooks/useDetectCrowd";
import { CrowdDetectionControls } from "./CrowdDetectionControls";
import { CrowdDetectionView } from "./CrowdDetectionView";

export function CrowdDetection() {
  const { stream, status, error, start, stop, reportDetectionError } =
    useDetectCrowd();

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <CrowdDetectionControls status={status} onStart={start} onStop={stop} />
      <CrowdDetectionView
        stream={stream}
        status={status}
        error={error}
        onDetectionError={reportDetectionError}
      />
    </div>
  );
}
