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

export function areSettingsEqual(
  a: DetectionSettings,
  b: DetectionSettings,
): boolean {
  return (
    a.confidenceThreshold === b.confidenceThreshold &&
    a.trackingDistanceThreshold === b.trackingDistanceThreshold &&
    a.detectionInterval === b.detectionInterval &&
    areCountingLinesEqual(a.countingLines, b.countingLines)
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

export function clampCountingLines(
  countingLines: DetectionCountingLineSetting[],
): DetectionCountingLineSetting[] {
  return countingLines.map((line) => ({
    id: line.id,
    p1: { x: clampUnit(line.p1.x), y: clampUnit(line.p1.y) },
    p2: { x: clampUnit(line.p2.x), y: clampUnit(line.p2.y) },
  }));
}

export function applyCountingLines(
  store: DetectionSettingsStore,
  countingLines: DetectionCountingLineSetting[],
): void {
  const clamped = clampCountingLines(countingLines);

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

/**
 * 設定一式をまとめて反映する
 *
 * WebRTC 越しに受け取った設定を適用する用途を想定し，
 * 購読側への通知が 1 回で済むよう 1 度の setState で置き換える。
 */
export function applySettings(
  store: DetectionSettingsStore,
  settings: DetectionSettings,
): void {
  const next: DetectionSettings = {
    confidenceThreshold: clampNumberSetting(
      "confidenceThreshold",
      settings.confidenceThreshold,
    ),
    trackingDistanceThreshold: clampNumberSetting(
      "trackingDistanceThreshold",
      settings.trackingDistanceThreshold,
    ),
    detectionInterval: clampNumberSetting(
      "detectionInterval",
      settings.detectionInterval,
    ),
    countingLines: clampCountingLines(settings.countingLines),
  };

  store.setState(
    (current) => (areSettingsEqual(current, next) ? current : next),
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

// --- 受信データの検証 ---
// WebRTC 越しに届く JSON は信用できないため，形が合うものだけを通す
// （値の範囲は applySettings 側で丸める）

function parsePoint(value: unknown): DetectionPoint | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { x, y } = value as Partial<DetectionPoint>;
  if (typeof x !== "number" || typeof y !== "number") {
    return null;
  }
  return { x, y };
}

function parseCountingLine(
  value: unknown,
): DetectionCountingLineSetting | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const { id, p1, p2 } = value as Partial<DetectionCountingLineSetting>;
  const parsedP1 = parsePoint(p1);
  const parsedP2 = parsePoint(p2);
  if (typeof id !== "string" || !parsedP1 || !parsedP2) {
    return null;
  }
  return { id, p1: parsedP1, p2: parsedP2 };
}

export function parseDetectionSettings(
  value: unknown,
): DetectionSettings | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const {
    confidenceThreshold,
    trackingDistanceThreshold,
    detectionInterval,
    countingLines,
  } = value as Partial<DetectionSettings>;

  if (
    typeof confidenceThreshold !== "number" ||
    typeof trackingDistanceThreshold !== "number" ||
    typeof detectionInterval !== "number" ||
    !Array.isArray(countingLines)
  ) {
    return null;
  }

  const parsedLines: DetectionCountingLineSetting[] = [];
  for (const line of countingLines) {
    const parsedLine = parseCountingLine(line);
    if (!parsedLine) {
      return null;
    }
    parsedLines.push(parsedLine);
  }
  // ライン 0 本の設定は削除・リセットの前提を崩すため受け付けない
  if (parsedLines.length === 0) {
    return null;
  }

  return {
    confidenceThreshold,
    trackingDistanceThreshold,
    detectionInterval,
    countingLines: parsedLines,
  };
}
