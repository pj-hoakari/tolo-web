"use client";

import { useEffect, useRef, useState } from "react";
import { detectCrowd } from "../utils/detectCrowd";

export type DetectCrowdStatus = "idle" | "loading" | "detecting" | "error";

export function useDetectCrowd() {
  const sourceStreamRef = useRef<MediaStream | null>(null);
  const operationIdRef = useRef(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<DetectCrowdStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    const operationId = ++operationIdRef.current;
    setError(null);
    setStatus("loading");

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      if (operationIdRef.current !== operationId) {
        for (const track of cameraStream.getTracks()) {
          track.stop();
        }
        return;
      }

      sourceStreamRef.current = cameraStream;

      // 検出機構のスタートアップ中はカメラ映像をそのままパススルー表示
      setStream(cameraStream);

      const processedStream = await detectCrowd(cameraStream);

      if (
        operationIdRef.current !== operationId ||
        sourceStreamRef.current !== cameraStream
      ) {
        return;
      }
      setStream(processedStream);
      setStatus("detecting");
    } catch (e) {
      if (operationIdRef.current !== operationId) {
        return;
      }

      for (const track of sourceStreamRef.current?.getTracks() ?? []) {
        track.stop();
      }
      sourceStreamRef.current = null;
      setStream(null);
      setStatus("error");
      setError(e instanceof Error ? e.message : "カメラの取得に失敗しました");
    }
  };

  const stop = () => {
    operationIdRef.current += 1;
    for (const track of sourceStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    sourceStreamRef.current = null;
    setStream(null);
    setStatus("idle");
  };

  useEffect(() => {
    return () => {
      operationIdRef.current += 1;
      for (const track of sourceStreamRef.current?.getTracks() ?? []) {
        track.stop();
      }
    };
  }, []);

  return { stream, status, error, start, stop };
}
