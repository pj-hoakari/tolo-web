import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/locale";
import type { GraphData, GraphEdgeData, GraphNodeData } from "../../type";
import { isExternalNode, isGroupNode } from "../../type";
import {
  type GraphElementEntry,
  relatedElementsOf,
} from "../../utils/relatedElements";
import type { SingleSelection } from "../sidePanel/sidePanelView";
import { EdgeCreationField, type EdgeTarget } from "./EdgeCreationField";
import { EdgeProperties } from "./EdgeProperties";
import { ExternalProperties } from "./ExternalProperties";
import { resolveEdgeDirectionState } from "./edgeDirectionState";
import { GroupProperties } from "./GroupProperties";
import { NodeProperties } from "./NodeProperties";
import { buildNodeTypeOptions } from "./nodeTypeOptions";
import { RelatedElementLinks } from "./RelatedElementLinks";

export type SelectionPropertiesBindings = {
  /** ポイントラベルの編集言語 */
  labelLocale: Locale;
  onUpdateNode: (id: string, patch: Partial<GraphNodeData>) => void;
  /** 編集言語のポイントラベルを更新する */
  onSetNodeLabel: (id: string, label: string) => void;
  onUpdateEdge: (id: string, patch: Partial<GraphEdgeData>) => void;
  onReverseEdge: (id: string) => void;
  edgeTargets: EdgeTarget[];
  onAddEdge: (target: string) => void;
};

type SelectionPropertiesProps = SelectionPropertiesBindings & {
  selection: SingleSelection;
  /** 制約の検証と端点ラベルの解決に使うグラフ全体 */
  graph: GraphData;
  onSelectRelated: (entry: GraphElementEntry) => void;
};

export function SelectionProperties({
  selection,
  graph,
  labelLocale,
  onUpdateNode,
  onSetNodeLabel,
  onUpdateEdge,
  onReverseEdge,
  edgeTargets,
  onAddEdge,
  onSelectRelated,
}: SelectionPropertiesProps) {
  const { nodes, edges } = graph;
  const tNotice = useTranslations("Graph.notices");

  if (selection.kind === "edge") {
    const { edge } = selection;
    return (
      <EdgeProperties
        edge={edge}
        directionState={resolveEdgeDirectionState(edge, nodes, edges, tNotice)}
        endpoints={{
          ...relatedElementsOf(graph, edge),
          onSelect: onSelectRelated,
        }}
        onChange={(patch) => onUpdateEdge(edge.id, patch)}
        onReverse={() => onReverseEdge(edge.id)}
      />
    );
  }

  const { node } = selection;
  if (isGroupNode(node)) {
    return (
      <GroupProperties
        group={node}
        labelLocale={labelLocale}
        onChangeLabel={(label) => onSetNodeLabel(node.id, label)}
      >
        <RelatedElementLinks
          related={relatedElementsOf(graph, node)}
          onSelect={onSelectRelated}
        />
      </GroupProperties>
    );
  }

  return (
    <div className="space-y-3">
      {isExternalNode(node) ? (
        <ExternalProperties node={node}>
          <RelatedElementLinks
            related={relatedElementsOf(graph, node)}
            onSelect={onSelectRelated}
          />
        </ExternalProperties>
      ) : (
        <NodeProperties
          node={node}
          typeOptions={buildNodeTypeOptions(
            node.id,
            node.data.nodeType,
            nodes,
            edges,
            tNotice,
          )}
          labelLocale={labelLocale}
          onChange={(patch) => onUpdateNode(node.id, patch)}
          onChangeLabel={(label) => onSetNodeLabel(node.id, label)}
        >
          <RelatedElementLinks
            related={relatedElementsOf(graph, node)}
            onSelect={onSelectRelated}
          />
        </NodeProperties>
      )}
      <EdgeCreationField
        key={node.id}
        targets={edgeTargets}
        onAdd={onAddEdge}
      />
    </div>
  );
}
