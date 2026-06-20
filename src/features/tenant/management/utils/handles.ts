import type {
  GraphEdgeType,
  GraphNodeType,
  HandleSide,
  NodeHandles,
} from "../type";

const SIDES: HandleSide[] = ["top", "right", "bottom", "left"];

export function parseHandleId(
  id: string | null | undefined,
): { side: HandleSide; index: number } | null {
  if (!id) return null;
  const dash = id.indexOf("-");
  if (dash < 0) return null;
  const side = id.slice(0, dash) as HandleSide;
  if (!SIDES.includes(side)) return null;
  const index = Number.parseInt(id.slice(dash + 1), 10);
  if (Number.isNaN(index) || index < 0) return null;
  return { side, index };
}

export function makeHandleId(side: HandleSide, index: number): string {
  return `${side}-${index}`;
}

export function deriveNodeHandles(
  nodes: GraphNodeType[],
  edges: GraphEdgeType[],
): GraphNodeType[] {
  const usedByNode = new Map<string, Record<HandleSide, Set<number>>>();
  for (const n of nodes) {
    usedByNode.set(n.id, {
      top: new Set(),
      right: new Set(),
      bottom: new Set(),
      left: new Set(),
    });
  }

  for (const e of edges) {
    const src = parseHandleId(e.sourceHandle);
    if (src && usedByNode.has(e.source)) {
      usedByNode.get(e.source)?.[src.side].add(src.index);
    }
    const tgt = parseHandleId(e.targetHandle);
    if (tgt && usedByNode.has(e.target)) {
      usedByNode.get(e.target)?.[tgt.side].add(tgt.index);
    }
  }

  return nodes.map((n) => {
    const used = usedByNode.get(n.id);
    const handles: NodeHandles = { top: [], right: [], bottom: [], left: [] };
    for (const side of SIDES) {
      const usedSet = used?.[side] ?? new Set<number>();
      const maxUsed = usedSet.size > 0 ? Math.max(...usedSet) : -1;
      const total = maxUsed + 2; // 既使用 + 空き1
      for (let i = 0; i < total; i++) {
        handles[side].push({
          id: makeHandleId(side, i),
          side,
          index: i,
          used: usedSet.has(i),
          total,
        });
      }
    }
    return {
      ...n,
      data: { ...n.data, handles },
    };
  });
}

export function compactHandlesAfterRemoval(
  removedEdges: GraphEdgeType[],
  remainingEdges: GraphEdgeType[],
): GraphEdgeType[] {
  const affected = new Set<string>();
  for (const e of removedEdges) {
    const src = parseHandleId(e.sourceHandle);
    if (src) affected.add(`${e.source}|${src.side}`);
    const tgt = parseHandleId(e.targetHandle);
    if (tgt) affected.add(`${e.target}|${tgt.side}`);
  }

  let result = remainingEdges;

  for (const key of affected) {
    const sep = key.indexOf("|");
    const nodeId = key.slice(0, sep);
    const side = key.slice(sep + 1) as HandleSide;

    type Use = {
      edgeId: string;
      role: "source" | "target";
      oldIndex: number;
    };
    const uses: Use[] = [];
    for (const e of result) {
      if (e.source === nodeId) {
        const p = parseHandleId(e.sourceHandle);
        if (p && p.side === side) {
          uses.push({ edgeId: e.id, role: "source", oldIndex: p.index });
        }
      }
      if (e.target === nodeId) {
        const p = parseHandleId(e.targetHandle);
        if (p && p.side === side) {
          uses.push({ edgeId: e.id, role: "target", oldIndex: p.index });
        }
      }
    }
    uses.sort((a, b) => a.oldIndex - b.oldIndex);

    const remap = new Map<string, number>();
    uses.forEach((u, newIdx) => {
      if (u.oldIndex !== newIdx) {
        remap.set(`${u.edgeId}|${u.role}`, newIdx);
      }
    });
    if (remap.size === 0) continue;

    result = result.map((e) => {
      let updated = e;
      const srcNewIdx = remap.get(`${e.id}|source`);
      if (srcNewIdx !== undefined && e.source === nodeId) {
        updated = {
          ...updated,
          sourceHandle: makeHandleId(side, srcNewIdx),
        };
      }
      const tgtNewIdx = remap.get(`${e.id}|target`);
      if (tgtNewIdx !== undefined && e.target === nodeId) {
        updated = {
          ...updated,
          targetHandle: makeHandleId(side, tgtNewIdx),
        };
      }
      return updated;
    });
  }

  return result;
}
