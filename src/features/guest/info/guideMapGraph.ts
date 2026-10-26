import {
  type GraphData,
  isGroupNode,
  isPointNode,
  type LocalizedLabel,
} from "@/features/tenant/management/graph/type";
import type { LocalizedGuideMapLayout } from "./guideMapLayout";

export type GuestGuideMapPoint = { pointId: string; labels: LocalizedLabel };

export type GuestGuideMapGroup = { groupId: string; labels: LocalizedLabel };

export type GuestGuideMapGraph = {
  points: GuestGuideMapPoint[];
  groups: GuestGuideMapGroup[];
};

export function toGuestGuideMapGraph(
  graph: GraphData,
  layout: Pick<LocalizedGuideMapLayout, "groups" | "objects">,
): GuestGuideMapGraph {
  const pointIds = new Set(layout.objects.map((o) => o.pointId));
  const groupIds = new Set(layout.groups.map((g) => g.groupId));
  return {
    points: graph.nodes.flatMap((n): GuestGuideMapPoint[] =>
      isPointNode(n) && n.data.nodeType !== "EXTERNAL" && pointIds.has(n.id)
        ? [{ pointId: n.id, labels: n.data.labels }]
        : [],
    ),
    groups: graph.nodes.flatMap((n): GuestGuideMapGroup[] =>
      isGroupNode(n) && groupIds.has(n.id)
        ? [{ groupId: n.id, labels: n.data.labels }]
        : [],
    ),
  };
}
