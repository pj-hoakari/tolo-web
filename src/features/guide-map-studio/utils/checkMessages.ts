// チェックの項目の文：何が問題か（title）・どうすればいいか（hint）・押すとどこへ移るか（go）。
// 項目（guideMapCheck.ts）は種類と差し込む値だけを持ち、文はここで画面の言葉にする

import type { CheckIssue } from "./guideMapCheck";

/** スタジオの文言を引く関数（i18n.tsx の t） */
type Translate = (ja: string, vars?: Record<string, string | number>) => string;

export type CheckMessage = { title: string; hint: string; go: string };

export function checkMessageOf(is: CheckIssue, t: Translate): CheckMessage {
  const v = is.vars ?? {};
  switch (is.kind) {
    case "unreachable":
      return {
        title: t("「{name}」（{floor}）へたどり着けません", v),
        hint: t(
          "現在地「{from}」から行ける道がありません。部屋・区画どうしのすき間が狭すぎないか、通路がふさがれていないか確かめてください。",
          v,
        ),
        go: t("その場所を表示"),
      };
    case "no-start":
      return {
        title: t("お客さんの現在地が決まっていません"),
        hint: t(
          "QR コードの場所が分からないとき、どこから案内を始めるかを「誘導」の「現在地」で選んでください。",
        ),
        go: t("「現在地」を開く"),
      };
    case "unnamed":
      return {
        title: t("名前のない目印があります（{floor}）", v),
        hint: t(
          "名前が無いと、お客さんが目的地として選べません。名前を入れるか、要らなければ消してください。",
        ),
        go: t("その目印を表示"),
      };
    case "connector-unlinked":
      return {
        title: t("「{name}」（{floor}）が、ほかの階とつながっていません", v),
        hint: t(
          "この階段・エレベーターでは別の階へ移れません。右の「つながる階」で、行き来できる階に印を付けてください。",
        ),
        go: t("その場所を表示"),
      };
    case "floor-isolated":
      return {
        title: t("{floor}へ行ける階段・エレベーターがありません", v),
        hint: t(
          "ほかの階からこの階へ案内できません。道具の「階段・EV」で置いてください。",
        ),
        go: t("その階を表示"),
      };
    case "overlap":
      return {
        title: t("「{a}」と「{b}」が重なっています（{floor}）", v),
        hint: t(
          "重なっていると、その間を通る道が作れなかったり、押しにくくなったりします。わざと重ねているときは「OK」で消せます。",
        ),
        go: t("2つを選んで表示"),
      };
    case "empty-floor":
      return {
        title: t("{floor}には、まだ何も置かれていません", v),
        hint: t("使わない階なら、消してもかまいません。"),
        go: t("その階を表示"),
      };
    case "no-graph":
      return {
        title: t("混雑の情報と、まだつながっていません"),
        hint: t(
          "グラフ（グラフ編集で作ったもの）を読み込むと、混んでいる所を避けた案内を確かめられます。",
        ),
        go: t("「つなぎ」を開く"),
      };
    case "floor-no-group":
      return {
        title: t("{floor}が、グラフのどの階か決まっていません", v),
        hint: t(
          "決めないと、お客さんの画面でこの階が正しく出ません。「つなぎ」の「階」で選んでください。",
        ),
        go: t("「つなぎ」の階を開く"),
      };
    case "connector-no-point":
      return {
        title: t(
          "「{name}」（{floor}）がグラフのポイントに結び付いていません",
          v,
        ),
        hint: t(
          "名前の同じポイントが無いか、いくつもあって、自動で結び付けられませんでした。階段・エレベーターは混雑を避けて階をまたぐのに使うので、上の「その他」→「つなぎ」で選んでください。",
        ),
        go: t("その場所を表示"),
      };
    case "bad-point":
      return {
        title: t("「{name}」の結び付け先が、グラフに見つかりません", v),
        hint: t(
          "グラフが作り直された可能性があります。上の「その他」→「つなぎ」で、ポイントを選び直してください。",
        ),
        go: t("その場所を表示"),
      };
    case "bad-route":
      return {
        title: t("「{name}」の結び付け先が、グラフに見つかりません", v),
        hint: t(
          "グラフが作り直された可能性があります。上の「その他」→「つなぎ」で、ルートを選び直してください。",
        ),
        go: t("その場所を表示"),
      };
    case "unlinked-points":
      return {
        title: t("混雑の情報を受け取れない場所が{n}か所あります", v),
        hint: t(
          "グラフの「{names}」などが、地図のどれとも結び付いていないため、そこが混んでも避けて案内できません。",
          v,
        ),
        go: t("結び付いていない場所の一覧を開く"),
      };
    case "unlinked-routes":
      return {
        title: t("混雑の情報を受け取れない通路が{n}本あります", v),
        hint: t(
          "グラフの「{names}」などの通路が、地図と結び付いていません。廊下に沿って範囲を描き、「つなぎ」でルートに結び付けると、混んだときに避けられます。",
          v,
        ),
        go: t("結び付いていない通路の一覧を開く"),
      };
  }
}
