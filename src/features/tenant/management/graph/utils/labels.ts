import { locales } from "@/i18n/locale";
import type { GraphCanvasNode, LocalizedLabel } from "../type";
import { isPointNode } from "../type";

export type ResolvedLabel = {
  text: string;
  /** 表示言語のラベルが未設定で、他言語の値を表示していることを示す */
  isFallback: boolean;
};

/**
 * 表示言語のポイントラベルを解決する。
 * 未設定の場合は、アプリの対応ロケール順 → 残りのキー順で
 * 最初に見つかった値へフォールバックする。
 */
export function resolveLabel(
  labels: LocalizedLabel,
  locale: string,
): ResolvedLabel {
  const own = labels[locale];
  if (own) return { text: own, isFallback: false };
  for (const fallback of [...locales, ...Object.keys(labels)]) {
    const value = labels[fallback];
    if (value) return { text: value, isFallback: true };
  }
  return { text: "", isFallback: false };
}

/**
 * 表示言語で解決したラベルを、描画用としてポイントへ注入する。
 * グループのラベルは言語を持たないため、そのまま返す。
 */
export function deriveNodeLabels(
  nodes: GraphCanvasNode[],
  locale: string,
): GraphCanvasNode[] {
  return nodes.map((n) => {
    if (!isPointNode(n)) return n;
    const { text, isFallback } = resolveLabel(n.data.labels, locale);
    return {
      ...n,
      data: { ...n.data, label: text, labelIsFallback: isFallback },
    };
  });
}

/** ロケールごとの、ラベルが設定済みのポイント数を数える */
export function countLabeledPoints(
  nodes: GraphCanvasNode[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of nodes) {
    if (!isPointNode(node)) continue;
    for (const [locale, value] of Object.entries(node.data.labels)) {
      if (value) counts[locale] = (counts[locale] ?? 0) + 1;
    }
  }
  return counts;
}

/** 空文字のエントリを除いた、保存用のラベルを返す */
export function compactLabels(labels: LocalizedLabel): LocalizedLabel {
  return Object.fromEntries(
    Object.entries(labels).filter(([, value]) => value !== ""),
  );
}
