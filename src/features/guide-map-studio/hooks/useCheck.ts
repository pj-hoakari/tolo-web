import * as React from "react";
import { useI18n } from "../i18n/i18n";
import type { GuideMapDoc, StudioPage } from "../type";
import { type CheckMessage, checkMessageOf } from "../utils/checkMessages";
import {
  CHECK_LEVEL_COLOR,
  type CheckIssue,
  type CheckLevel,
  checkGuideMapDoc,
  needsLookOf,
  withCheckIgnored,
} from "../utils/guideMapCheck";
import { boxOf } from "../utils/guideMapSnap";

// チェック（書き出す前にも出す）の状態と操作をまとめたもの。
//  - check：開いているチェックの一覧（issues=null は確認中）
//  - focus：一覧の項目から移った場所。地図の上で光らせ、何が気になるのかを上に出す（閉じる・OK まで）
//  - needsLook：上の帯のチェックに出す数（手を止めてから数える）
// 項目を押したときに、どの画面を開くか（誘導・つなぎ・その場所）は画面の側で決める

export type CheckState = {
  pageId: string;
  issues: CheckIssue[] | null;
  forExport: boolean;
};
type CheckFocus = { pageId: string; issue: CheckIssue };
/** 地図の上の印：物の外枠（boxes）か、階のタブ（floorId）を、重さの色で光らせる */
export type CheckFocusMark = {
  boxes: { l: number; t: number; r: number; b: number }[];
  floorId?: string;
  color: string;
  message: CheckMessage;
  /** グラフとの結び付けを直す項目なら、「つなぎ」のどのタブを開くか */
  linkTab?: "points" | "routes";
};

// 上の帯の数を数え直すまで待つ時間（描くたびに調べると重いので、手を止めてから）
const RECOUNT_DELAY = 1500;

export function useCheck({
  doc,
  setDoc,
  pages,
  setPages,
  activePageId,
  preview,
  isBlank,
  onExport,
}: {
  doc: GuideMapDoc;
  setDoc: React.Dispatch<React.SetStateAction<GuideMapDoc>>;
  pages: StudioPage[];
  setPages: React.Dispatch<React.SetStateAction<StudioPage[]>>;
  activePageId: string;
  preview: boolean;
  isBlank: (d: GuideMapDoc) => boolean;
  /** 書き出す（問題が無いときと「このまま書き出す」） */
  onExport: (pageId: string) => void;
}) {
  const { t } = useI18n();
  const [check, setCheck] = React.useState<CheckState | null>(null);
  const [focus, setFocus] = React.useState<CheckFocus | null>(null);
  const [needsLook, setNeedsLook] = React.useState<{
    n: number;
    level: CheckLevel | null;
  }>({ n: 0, level: null });

  // 範囲には名前を付けないので、項目では「範囲」と呼ぶ
  const issuesOf = (d: GuideMapDoc) =>
    checkGuideMapDoc(d, t("（無題）"), t("範囲"));
  const messageOf = (is: CheckIssue) => checkMessageOf(is, t);
  const docOf = (pageId: string) =>
    pageId === activePageId ? doc : pages.find((p) => p.id === pageId)?.doc;

  // 重い（道案内を全部の場所で試す）ので、「確認中」を出してから少し後で計算する。
  // 書き出すときは、「直してください」「確認してください」が無ければ（OK にしたものは除く）そのまま書き出す
  const runCheck = (pageId: string, forExport: boolean) => {
    const d = docOf(pageId);
    if (!d) return;
    setFocus(null);
    setCheck({ pageId, issues: null, forExport });
    window.setTimeout(() => {
      const issues = issuesOf(d);
      if (forExport && needsLookOf(d, issues).n === 0) {
        setCheck(null);
        onExport(pageId);
        return;
      }
      setCheck((c) => (c && c.pageId === pageId ? { ...c, issues } : c));
    }, 30);
  };

  // 項目を「OK」にする（on）／一覧に戻す。そのタブの地図に覚えておく
  const setIgnored = (pageId: string, is: CheckIssue, on: boolean) => {
    const edit = (d: GuideMapDoc) => withCheckIgnored(d, is, on);
    if (pageId === activePageId) setDoc(edit);
    else
      setPages((ps) =>
        ps.map((p) => (p.id === pageId ? { ...p, doc: edit(p.doc) } : p)),
      );
  };

  // 地図の上の印（表示中のタブ・階の分だけ）
  const focusMark = ((): CheckFocusMark | null => {
    if (!focus || focus.pageId !== activePageId) return null;
    const is = focus.issue;
    const ids = [is.objectId, is.otherId].filter(Boolean);
    const boxes = doc.objects
      .filter((o) => o.floor === doc.activeFloorId && ids.includes(o.id))
      .map((o) => {
        // 点の物（目印・文字）は大きさが無いので、まわりに少し広げる
        const b = boxOf(o);
        const pad = b.r - b.l < 1 && b.b - b.t < 1 ? 14 : 0;
        return { l: b.l - pad, t: b.t - pad, r: b.r + pad, b: b.b + pad };
      });
    if (ids.length > 0 && boxes.length === 0) return null; // 別の階を見ている
    if (ids.length === 0 && is.floorId !== doc.activeFloorId) return null;
    return {
      boxes,
      floorId: ids.length === 0 ? is.floorId : undefined,
      color: CHECK_LEVEL_COLOR[is.level],
      message: messageOf(is),
      linkTab:
        is.kind === "bad-route"
          ? "routes"
          : is.kind === "bad-point" || is.kind === "connector-no-point"
            ? "points"
            : undefined,
    };
  })();

  // 上の帯の数。白紙のときは出さない
  // biome-ignore lint/correctness/useExhaustiveDependencies: 地図が変わったときだけ数え直す（isBlank・issuesOf は毎回作り直す関数なので入れない）
  React.useEffect(() => {
    if (preview) return;
    const timer = window.setTimeout(
      () =>
        setNeedsLook(
          isBlank(doc)
            ? { n: 0, level: null }
            : needsLookOf(doc, issuesOf(doc)),
        ),
      RECOUNT_DELAY,
    );
    return () => window.clearTimeout(timer);
  }, [doc, preview]);

  return {
    check,
    /** 開いているチェックのタブの地図 */
    checkDoc: check ? docOf(check.pageId) : undefined,
    closeCheck: () => setCheck(null),
    runCheck,
    messageOf,
    setIgnored,
    focus,
    setFocus,
    focusMark,
    needsLook,
  };
}
