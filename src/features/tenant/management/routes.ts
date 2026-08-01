/**
 * 管理ページ配下のパス。
 * テナントは Host で解決され `/tenant/*` は proxy で遮断されるため、
 * ブラウザ上のパス（テナントを含まない形）を組み立てる。
 */

export function managementPath(eventId: string): string {
  return `/event/${eventId}/management`;
}

/** 会場グラフの編集ページ */
export function graphEditPath(eventId: string): string {
  return `${managementPath(eventId)}/graph/edit`;
}
