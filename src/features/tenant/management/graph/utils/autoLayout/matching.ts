import type { XYPosition } from "@xyflow/react";
import {
  type GraphCanvasNode,
  type GraphEdgeType,
  isGroupNode,
} from "../../type";
import { GROUP_FIT_PADDING_TOP, GROUP_FIT_PADDING_X, sizeOf } from "../groups";
import { finalizeContainer } from "./finalizing";
import { liftEdges } from "./graphIndex";
import { externalDirection, planContainer } from "./planning";
import type {
  ContainerId,
  ContainerPlan,
  FinalizedContent,
  GraphIndex,
} from "./types";

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6;

/**
 * Boundary bands can change the apparent flow axis after alignment. Recognize
 * the existing layout against all four flow orientations instead of treating
 * the resulting coordinates as a new manual direction. No layout state is saved.
 * Descendants must match before their parent's geometry can be checked.
 */
export function matchesAlignedLayout(
  nodes: GraphCanvasNode[],
  edges: GraphEdgeType[],
  index: GraphIndex,
  centers: Map<string, XYPosition>,
): boolean {
  const plans = new Map<ContainerId, ContainerPlan>();
  const finalized = new Map<string, FinalizedContent>();
  const visiting = new Set<ContainerId>();
  const failed = new Set<string>();
  const visit = (container: ContainerId): boolean => {
    if (visiting.has(container)) return false;
    // Only the directions of routes leaving this subtree depend on ancestor
    // choices. Memoize failed subtrees to avoid exponential work on deep nests.
    const outside = [
      ...new Set(
        [...liftEdges(container, edges, index).external.values()].flat(),
      ),
    ];
    const key = JSON.stringify([
      container,
      outside.map((id) => [
        id,
        container === undefined
          ? undefined
          : externalDirection(container, id, index, plans),
      ]),
    ]);
    if (failed.has(key)) return false;
    visiting.add(container);
    const members = index.childrenOf.get(container) ?? [];
    for (const axis of ["x", "y"] as const) {
      for (const flip of [false, true]) {
        for (const laneSide of [-1, 1] as const) {
          plans.set(
            container,
            planContainer(container, members, index, edges, centers, plans, {
              axis,
              flip,
              laneSide,
            }),
          );
          if (members.some((n) => isGroupNode(n) && !visit(n.id))) continue;
          const content = finalizeContainer(container, index, plans, finalized);
          const parent =
            container === undefined ? undefined : index.byId.get(container);
          let originX = parent
            ? (centers.get(parent.id)?.x ?? 0) -
              sizeOf(parent).width / 2 +
              GROUP_FIT_PADDING_X
            : Infinity;
          let originY = parent
            ? (centers.get(parent.id)?.y ?? 0) -
              sizeOf(parent).height / 2 +
              GROUP_FIT_PADDING_TOP
            : Infinity;
          if (!parent) {
            for (const n of members) {
              const c = centers.get(n.id);
              if (!c) continue;
              const size = sizeOf(n);
              originX = Math.min(originX, c.x - size.width / 2);
              originY = Math.min(originY, c.y - size.height / 2);
            }
          }
          const matches = members.every((n) => {
            const actual = centers.get(n.id),
              expected = content.memberCenters.get(n.id),
              size = content.memberSizes.get(n.id),
              actualSize = sizeOf(n);
            return (
              actual &&
              expected &&
              size &&
              near(actual.x, originX + expected.x) &&
              near(actual.y, originY + expected.y) &&
              near(actualSize.width, size.width) &&
              near(actualSize.height, size.height)
            );
          });
          if (matches) {
            if (container !== undefined) finalized.set(container, content);
            visiting.delete(container);
            return true;
          }
        }
      }
    }
    visiting.delete(container);
    failed.add(key);
    return false;
  };
  return nodes.length > 0 && visit(undefined);
}
