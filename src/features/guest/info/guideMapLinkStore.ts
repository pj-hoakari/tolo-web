"use client";

import { useSyncExternalStore } from "react";

/**
 * ゲストページの他のカード（行列・混雑状況）から案内マップへ「この場所を地図で見せて」と頼むための共有ストア。
 * 案内マップはレイアウトを読み込んだら地図上にあるポイント ID を登録し、カードはその ID の場所にだけ「地図で見る」を出す。
 * 頼まれた案内マップは、目的地ならそこへの道順を出し、それ以外（エレベーターなど）はその階を開いて場所を強調する。
 */

export type GuideMapRequest = { pointId: string; seq: number };

type GuideMapLinkState = {
  /** 地図上にあるポイント ID。案内マップが未読み込みなら空 */
  pointIds: ReadonlySet<string>;
  /** 案内マップがまだ受け取っていない依頼 */
  request: GuideMapRequest | null;
};

const EMPTY: GuideMapLinkState = { pointIds: new Set(), request: null };

let state: GuideMapLinkState = EMPTY;
let seq = 0;
const listeners = new Set<() => void>();

function emit(next: GuideMapLinkState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 地図上にあるポイント ID を購読する（「地図で見る」を出すかの判断に使う） */
export function useGuideMapPointIds(): ReadonlySet<string> {
  return useSyncExternalStore(
    subscribe,
    () => state.pointIds,
    () => EMPTY.pointIds,
  );
}

/** 案内マップ宛ての依頼を購読する */
export function useGuideMapRequest(): GuideMapRequest | null {
  return useSyncExternalStore(
    subscribe,
    () => state.request,
    () => null,
  );
}

/** 地図上にあるポイント ID を登録する（案内マップの読み込み時） */
export function setGuideMapPointIds(pointIds: ReadonlySet<string>) {
  emit({ ...state, pointIds });
}

/** 案内マップが外れたときに登録と依頼を消す */
export function clearGuideMapLink() {
  emit(EMPTY);
}

/** その場所を案内マップで見せるよう頼む */
export function showOnGuideMap(pointId: string) {
  seq += 1;
  emit({ ...state, request: { pointId, seq } });
}

/** 依頼を受け取ったら消す（同じ依頼を二度処理しない） */
export function consumeGuideMapRequest(requestSeq: number) {
  if (state.request?.seq !== requestSeq) return;
  emit({ ...state, request: null });
}
