import { managementPath } from "@/features/tenant/management/routes";

/** 案内マップ・スタジオ（案内マップの編集ページ） */
export function guideMapEditPath(eventId: string): string {
  return `${managementPath(eventId)}/guide-map/edit`;
}
