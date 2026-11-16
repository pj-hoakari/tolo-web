import * as React from "react";
import type { GuideMapDoc } from "../type";

// 元に戻す／やり直し（⌘Z／⌘⇧Z）の履歴。
// ドラッグは離した時点で1回、続けて打った文字などは 0.6 秒以内ならまとめて1回にする。階の切り替えは履歴に積まない。
// 履歴はタブごとに持ち、タブを切り替えても、そのタブの履歴に戻れる

type PageHistory = { past: GuideMapDoc[]; future: GuideMapDoc[] };

const sameContent = (a: GuideMapDoc, b: GuideMapDoc) =>
  a.objects === b.objects &&
  a.floors === b.floors &&
  a.north === b.north &&
  a.scale === b.scale;

export function useHistory({
  doc,
  setDoc,
  dragRef,
  onJump,
}: {
  doc: GuideMapDoc;
  setDoc: (doc: GuideMapDoc) => void;
  /** ドラッグ中か（ドラッグ中は離したときにまとめて記録する） */
  dragRef: React.RefObject<unknown>;
  /** 戻した・やり直した後に、画面の側で片付けること（無くなった物の選択を外すなど） */
  onJump: (next: GuideMapDoc) => void;
}) {
  const pastRef = React.useRef<GuideMapDoc[]>([]);
  const futureRef = React.useRef<GuideMapDoc[]>([]);
  const committedRef = React.useRef<GuideMapDoc | null>(null);
  const skipRef = React.useRef(false);
  const lastChangeRef = React.useRef(0);
  const pagesRef = React.useRef(new Map<string, PageHistory>());
  const [historyCount, setHistoryCount] = React.useState({
    past: 0,
    future: 0,
  }); // ボタンの有効/無効用
  const syncHistoryCount = () =>
    setHistoryCount({
      past: pastRef.current.length,
      future: futureRef.current.length,
    });

  const commitHistory = (current: GuideMapDoc, force = false) => {
    const prev = committedRef.current;
    committedRef.current = current;
    if (!prev || sameContent(prev, current)) return;
    const now = Date.now();
    if (force || now - lastChangeRef.current > 600) {
      pastRef.current = [...pastRef.current.slice(-99), prev];
    }
    lastChangeRef.current = force ? 0 : now;
    futureRef.current = [];
    syncHistoryCount();
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: 地図が変わったときだけ履歴に積む（commitHistory は毎回作り直す関数なので入れない）
  React.useEffect(() => {
    // 最初の表示：基準にするだけ（保存からの復元フラグはそのまま残す）
    if (committedRef.current === null) {
      committedRef.current = doc;
      return;
    }
    if (skipRef.current) {
      skipRef.current = false;
      committedRef.current = doc;
      return;
    }
    if (dragRef.current) return; // ドラッグ中は離したときにまとめて記録
    commitHistory(doc);
  }, [doc]);

  const jumpHistory = (from: GuideMapDoc[], to: GuideMapDoc[]) => {
    const target = from.pop();
    if (!target) return;
    to.push(doc);
    // 表示中の階はそのまま（無くなった階なら記録の階へ）
    const next = {
      ...target,
      activeFloorId: target.floors.some((f) => f.id === doc.activeFloorId)
        ? doc.activeFloorId
        : target.activeFloorId,
    };
    skipRef.current = true;
    lastChangeRef.current = 0;
    setDoc(next);
    onJump(next);
    syncHistoryCount();
  };

  return {
    historyCount,
    /** いまの地図を履歴に積む（force＝前の変更とまとめない。ドラッグを離したときなど） */
    commitHistory,
    undo: () => jumpHistory(pastRef.current, futureRef.current),
    redo: () => jumpHistory(futureRef.current, pastRef.current),
    /** 次の地図の変更を履歴に積まない（保存からの復元・タブの切り替えなど） */
    skipNextHistory: () => {
      skipRef.current = true;
    },
    /** 次の変更を、前の変更とまとめない */
    breakHistoryMerge: () => {
      lastChangeRef.current = 0;
    },
    /**
     * 表示するタブの履歴に入れ替える。fromPageId を渡すと、いまの履歴をそのタブの分として残す
     * （渡さなければ、いまの履歴は捨てる：消したタブなど）。入れ替えた直後の地図は履歴に積まない
     */
    switchPageHistory: (toPageId: string, fromPageId?: string) => {
      if (fromPageId)
        pagesRef.current.set(fromPageId, {
          past: pastRef.current,
          future: futureRef.current,
        });
      const h = pagesRef.current.get(toPageId) ?? { past: [], future: [] };
      pastRef.current = h.past;
      futureRef.current = h.future;
      skipRef.current = true;
      lastChangeRef.current = 0;
      syncHistoryCount();
    },
    /** 消したタブの履歴を捨てる */
    forgetPageHistory: (pageId: string) => {
      pagesRef.current.delete(pageId);
    },
  };
}
