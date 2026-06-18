"use client";

import { type ChangeEvent, useId, useState } from "react";
import type { DetectCrowdStatus } from "../hooks/useDetectCrowd";
import {
  type CrowdVideoSourceFactory,
  createCameraVideoSource,
  createVideoFileSource,
} from "../utils/videoSource";

type SourceMode = "camera" | "file";

export type DevVideoSourcePanelProps = {
  status: DetectCrowdStatus;
  onSourceChange: (factory: CrowdVideoSourceFactory) => void;
};

export function DevVideoSourcePanel({
  status,
  onSourceChange,
}: DevVideoSourcePanelProps) {
  const fileInputId = useId();
  const loopInputId = useId();
  const [mode, setMode] = useState<SourceMode>("camera");
  const [file, setFile] = useState<File | null>(null);
  const [loop, setLoop] = useState(true);
  const [hidden, setHidden] = useState(false);

  if (hidden) {
    return null;
  }

  const isActive = status === "loading" || status === "detecting";

  const useCamera = () => {
    setMode("camera");
    setFile(null);
    onSourceChange(createCameraVideoSource);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    if (!selected) {
      return;
    }
    setMode("file");
    setFile(selected);
    onSourceChange(() => createVideoFileSource(selected, { loop }));
  };

  const handleLoopChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.checked;
    setLoop(next);
    if (mode === "file" && file) {
      onSourceChange(() => createVideoFileSource(file, { loop: next }));
    }
  };

  return (
    <section className="fixed right-4 bottom-4 z-50 flex w-72 flex-col gap-2 rounded border border-gray-300 border-dashed p-3 text-sm">
      <details open>
        <summary className="font-bold text-xs">映像ソース</summary>

        <label className="mt-2 flex flex-col gap-1" htmlFor={fileInputId}>
          <span>映像ファイル</span>
          <input
            id={fileInputId}
            type="file"
            accept="video/*"
            disabled={isActive}
            onChange={handleFileChange}
            className="disabled:opacity-50"
          />
        </label>

        <label className="flex items-center gap-2" htmlFor={loopInputId}>
          <input
            id={loopInputId}
            type="checkbox"
            checked={loop}
            disabled={isActive}
            onChange={handleLoopChange}
          />
          ループ再生
        </label>

        <div>
          <button
            type="button"
            onClick={useCamera}
            disabled={isActive || mode === "camera"}
            className="underline disabled:opacity-50"
          >
            カメラに戻す
          </button>
        </div>

        <p className="break-all text-xs">
          現在: {mode === "file" && file ? file.name : "カメラ"}
          {isActive ? "（切替は停止後）" : "（選択後に起動で反映）"}
        </p>

        <button
          type="button"
          onClick={() => setHidden(true)}
          className="underline text-xs"
        >
          非表示
        </button>
      </details>
    </section>
  );
}
