"use client";

import { useSyncExternalStore } from "react";
import type { LocalizedLabel } from "@/features/tenant/management/graph/type";

/**
 * 案内マップが表示しているフロアを、ゲストページ内の他のカード（現在のフロア）と共有する。
 * 案内マップがレイアウトを読み込んだらフロア一覧を登録し、表示フロアが変わるたびに更新する。
 */

export type GuideMapFloorOption = { id: string; labels: LocalizedLabel };

export type GuideMapFloorState = {
  floors: readonly GuideMapFloorOption[];
  /** 表示中のフロア ID。案内マップが未読み込みなら null */
  activeFloorId: string | null;
};

const EMPTY: GuideMapFloorState = { floors: [], activeFloorId: null };

let state: GuideMapFloorState = EMPTY;
const listeners = new Set<() => void>();

function emit(next: GuideMapFloorState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 案内マップの表示フロアを購読する */
export function useGuideMapFloor(): GuideMapFloorState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => EMPTY,
  );
}

/** フロア一覧と表示フロアを登録する（案内マップの読み込み時） */
export function setGuideMapFloors(
  floors: readonly GuideMapFloorOption[],
  activeFloorId: string,
) {
  emit({ floors, activeFloorId });
}

/** 表示フロアを切り替える（案内マップ・現在のフロアのどちらからでも呼べる） */
export function setGuideMapActiveFloor(activeFloorId: string) {
  if (state.activeFloorId === activeFloorId) return;
  emit({ ...state, activeFloorId });
}

/** 案内マップが外れたときに登録を消す */
export function clearGuideMapFloors() {
  emit(EMPTY);
}
