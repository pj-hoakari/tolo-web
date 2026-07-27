"use client";

import { useState } from "react";
import type { StoreApi } from "zustand";
import { createStore } from "zustand/vanilla";

export type DetectionMetrics = {
  trackedCount: number;
  fps: number;
};

export type DetectionPoint = {
  x: number;
  y: number;
};

export type DetectionCountingLineSetting = {
  id: string;
  p1: DetectionPoint;
  p2: DetectionPoint;
};

export type DetectionSettings = {
  confidenceThreshold: number;
  trackingDistanceThreshold: number;
  detectionInterval: number;
  countingLines: DetectionCountingLineSetting[];
};

export type DetectionLineCount = {
  forward: number;
  backward: number;
};

/** 検出ループが毎フレーム更新する結果 */
export type DetectionResult = {
  lineCounts: Record<string, DetectionLineCount>;
  metrics: DetectionMetrics;
};

/** 検出結果には影響しない画面操作の状態 */
export type DetectionViewState = {
  selectedLineId: string;
  lineCreationMode: boolean;
};

export type NumberSettingKey =
  | "confidenceThreshold"
  | "trackingDistanceThreshold"
  | "detectionInterval";

export const DEFAULT_LINE_ID = "line-1";

export const DEFAULT_COUNTING_LINES: DetectionCountingLineSetting[] = [
  {
    id: DEFAULT_LINE_ID,
    p1: { x: 0, y: 0.6 },
    p2: { x: 1, y: 0.6 },
  },
];

export const INITIAL_METRICS: DetectionMetrics = {
  trackedCount: 0,
  fps: 0,
};

export const INITIAL_SETTINGS: DetectionSettings = {
  confidenceThreshold: 0.15,
  trackingDistanceThreshold: 0.8,
  detectionInterval: 100,
  countingLines: DEFAULT_COUNTING_LINES,
};

export const INITIAL_LINE_COUNT: DetectionLineCount = {
  forward: 0,
  backward: 0,
};

export function createInitialLineCounts(
  countingLines: DetectionCountingLineSetting[],
): Record<string, DetectionLineCount> {
  return Object.fromEntries(
    countingLines.map((line) => [line.id, INITIAL_LINE_COUNT]),
  );
}

export function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function clampNumberSetting(
  key: NumberSettingKey,
  value: number,
): number {
  if (!Number.isFinite(value)) {
    return key === "detectionInterval" ? 100 : 0.15;
  }

  switch (key) {
    case "confidenceThreshold":
      return Math.min(1, Math.max(0.05, value));
    case "trackingDistanceThreshold":
      return Math.min(1, Math.max(0.1, value));
    case "detectionInterval":
      return Math.min(1000, Math.max(0, Math.round(value)));
  }
}

/**
 * 高頻度に更新される値を React state の外に置くためのストア
 *
 * 状態は純粋なデータのみとし，更新は下の apply* 関数で行う
 * （ストアをそのまま Storybook やテストへ渡せるようにするため）。
 */
export type DetectionSettingsStore = StoreApi<DetectionSettings>;
export type DetectionResultStore = StoreApi<DetectionResult>;
export type DetectionViewStateStore = StoreApi<DetectionViewState>;

export type DetectionStores = {
  settingsStore: DetectionSettingsStore;
  resultStore: DetectionResultStore;
  viewStateStore: DetectionViewStateStore;
};

export function createDetectionStores(
  settings: DetectionSettings = INITIAL_SETTINGS,
): DetectionStores {
  return {
    settingsStore: createStore<DetectionSettings>()(() => settings),
    resultStore: createStore<DetectionResult>()(() => ({
      lineCounts: createInitialLineCounts(settings.countingLines),
      metrics: INITIAL_METRICS,
    })),
    viewStateStore: createStore<DetectionViewState>()(() => ({
      selectedLineId: settings.countingLines[0]?.id ?? DEFAULT_LINE_ID,
      lineCreationMode: false,
    })),
  };
}

/** ストアはコンポーネントのライフサイクルと一致させ，参照は不変に保つ */
export function useDetectionStores(): DetectionStores {
  const [stores] = useState(createDetectionStores);
  return stores;
}

// --- 比較 ---
// 値が変わっていないときはストアを更新せず，購読側を再レンダリングさせない

export function areLineCountsEqual(
  a: Record<string, DetectionLineCount>,
  b: Record<string, DetectionLineCount>,
): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) {
    return false;
  }
  return aKeys.every((key) => {
    const left = a[key];
    const right = b[key];
    return (
      right !== undefined &&
      left.forward === right.forward &&
      left.backward === right.backward
    );
  });
}

export function areMetricsEqual(
  a: DetectionMetrics,
  b: DetectionMetrics,
): boolean {
  return a.trackedCount === b.trackedCount && a.fps === b.fps;
}

export function areCountingLinesEqual(
  a: DetectionCountingLineSetting[],
  b: DetectionCountingLineSetting[],
): boolean {
  return (
    a.length === b.length &&
    a.every((line, index) => {
      const other = b[index];
      return (
        other !== undefined &&
        line.id === other.id &&
        line.p1.x === other.p1.x &&
        line.p1.y === other.p1.y &&
        line.p2.x === other.p2.x &&
        line.p2.y === other.p2.y
      );
    })
  );
}

// --- セレクタ（参照を安定させるためモジュールスコープに置く） ---

export const selectCountingLines = (state: DetectionSettings) =>
  state.countingLines;

export const selectCountingLineIds = (state: DetectionSettings) =>
  state.countingLines.map((line) => line.id);

export const selectCountingLineCount = (state: DetectionSettings) =>
  state.countingLines.length;

export const selectLineCounts = (state: DetectionResult) => state.lineCounts;

export const selectMetrics = (state: DetectionResult) => state.metrics;

export const selectSelectedLineId = (state: DetectionViewState) =>
  state.selectedLineId;

export const selectLineCreationMode = (state: DetectionViewState) =>
  state.lineCreationMode;

// --- 更新 ---

export function applyCountingLines(
  store: DetectionSettingsStore,
  countingLines: DetectionCountingLineSetting[],
): void {
  const clamped = countingLines.map((line) => ({
    ...line,
    p1: { x: clampUnit(line.p1.x), y: clampUnit(line.p1.y) },
    p2: { x: clampUnit(line.p2.x), y: clampUnit(line.p2.y) },
  }));

  store.setState(
    (current) =>
      areCountingLinesEqual(current.countingLines, clamped)
        ? current
        : { ...current, countingLines: clamped },
    true,
  );
}

export function applyNumberSetting(
  store: DetectionSettingsStore,
  key: NumberSettingKey,
  value: number,
): void {
  const next = clampNumberSetting(key, value);
  store.setState(
    (current) =>
      current[key] === next ? current : { ...current, [key]: next },
    true,
  );
}

export function applyLineCounts(
  store: DetectionResultStore,
  lineCounts: Record<string, DetectionLineCount>,
): void {
  store.setState(
    (current) =>
      areLineCountsEqual(current.lineCounts, lineCounts)
        ? current
        : { ...current, lineCounts },
    true,
  );
}

export function applyMetrics(
  store: DetectionResultStore,
  metrics: DetectionMetrics,
): void {
  store.setState(
    (current) =>
      areMetricsEqual(current.metrics, metrics)
        ? current
        : { ...current, metrics },
    true,
  );
}

export function selectLine(
  store: DetectionViewStateStore,
  lineId: string,
): void {
  store.setState(
    (current) =>
      current.selectedLineId === lineId
        ? current
        : { ...current, selectedLineId: lineId },
    true,
  );
}

export function toggleLineCreationMode(store: DetectionViewStateStore): void {
  store.setState(
    (current) => ({
      ...current,
      lineCreationMode: !current.lineCreationMode,
    }),
    true,
  );
}
