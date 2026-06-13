"use client";

import { useEffect, useRef, useState } from "react";
import { detectCrowd } from "../utils/detectCrowd";

export type DetectCrowdStatus = "idle" | "loading" | "detecting" | "error";

export function useDetectCrowd() {
  const sourceStreamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<DetectCrowdStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      sourceStreamRef.current = cameraStream;

      // 検出機構のスタートアップ中はカメラ映像をそのままパススルー表示
      setStream(cameraStream);
      setStatus("loading");

      const processedStream = await detectCrowd(cameraStream);

      if (sourceStreamRef.current !== cameraStream) {
        return;
      }
      setStream(processedStream);
      setStatus("detecting");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "カメラの取得に失敗しました");
    }
  };

  const stop = () => {
    for (const track of sourceStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    sourceStreamRef.current = null;
    setStream(null);
    setStatus("idle");
  };

  useEffect(() => {
    return () => {
      for (const track of sourceStreamRef.current?.getTracks() ?? []) {
        track.stop();
      }
    };
  }, []);

  return { stream, status, error, start, stop };
}
