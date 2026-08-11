import "@xyflow/react/dist/base.css";
import "./GraphCanvas.css";

import {
  Background,
  type Connection,
  type ConnectionLineComponentProps,
  ConnectionMode,
  Controls,
  type EdgeChange,
  type EdgeTypes,
  MiniMap,
  type NodeChange,
  type NodeTypes,
  type OnConnectEnd,
  type OnConnectStart,
  ReactFlow,
  useViewport,
} from "@xyflow/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useCanvasContextMenu } from "../hooks/useCanvasContextMenu";
import { useEasyConnect } from "../hooks/useEasyConnect";
import { DEFAULT_NODE_TYPE, getNodeTypeDef } from "../nodeTypes";
import type { GraphCanvasNode, GraphEdgeType, NodeType } from "../type";
import { isGroupNode, isPointNode } from "../type";
import {
  CONNECTION_PREVIEW_RADIUS,
  findConnectionPreview,
  toFlowPosition,
} from "../utils/connectionPreview";
import {
  EASY_CONNECT_HANDLE_ID,
  isStaleEasyConnection,
  planFromNodeRelease,
} from "../utils/easyConnect";
import { addVirtualHandle, parseConnectHandleId } from "../utils/handles";
import {
  GraphNodeEasyConnectContext,
  GraphNodeLabelEditingContext,
  GroupResizeCommitContext,
} from "./canvasContexts";
import { EasyConnectPanel } from "./EasyConnectPanel";
import { GraphCanvasContextMenu } from "./GraphCanvasContextMenu";
import { GraphEdge, GraphEdgeMarkers } from "./GraphEdge";
import { GraphEdgeContextMenu } from "./GraphEdgeContextMenu";
import { GraphGroupContextMenu } from "./GraphGroupContextMenu";
import { GraphNode } from "./GraphNode";
import { GraphNodeContextMenu } from "./GraphNodeContextMenu";
import { GroupNode } from "./GroupNode";
import { InitialFitView } from "./InitialFitView";
import {
  VirtualConnectionLine,
  type VirtualHandle,
} from "./VirtualConnectionLine";

const nodeTypes: NodeTypes = { graph: GraphNode, graphGroup: GroupNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

/** MiniMap でのグループコンテナの塗り色 */
const GROUP_MINIMAP_COLOR = "#d4d4d8";

// React Flow の既定値（50%）だと、広い会場グラフを fitView しても
// 下限で止まり、端のノードが画面外に残る。
const MIN_ZOOM = 0.01;
export const FIT_VIEW_OPTIONS = { padding: 0.2, minZoom: MIN_ZOOM };

/** グラフ構造そのものを編集するためのハンドラ一式 */
export type GraphCanvasEditing = {
  onConnect: (connection: Connection) => void;
  isValidConnection: (connection: Connection | GraphEdgeType) => boolean;
  onSetEdgeDirection: (id: string, direction: "both" | "oneway") => void;
  onReverseEdge: (id: string) => void;
  onSetNodeType: (id: string, type: NodeType) => void;
  onSetNodeLabel: (id: string, label: string) => void;
  /** parentId を渡すと、位置に関わらずそのグループの中へ追加する */
  onAddNodeAtPosition: (
    position: { x: number; y: number },
    nodeType?: NodeType,
    parentId?: string,
  ) => void;
  onAddGroupAtPosition: (
    position: { x: number; y: number },
    parentId?: string,
  ) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
  /** ドラッグ終了時に、位置に応じた所属グループの付け替えを行う */
  onNodeDragStop: (ids: string[]) => void;
  /** グループの手動リサイズ確定（最小サイズとして保存し、フィットし直す） */
  onGroupResizeEnd: (
    id: string,
    size: { width: number; height: number },
  ) => void;
};

export type GraphCanvasProps = {
  nodes: GraphCanvasNode[];
  edges: GraphEdgeType[];
  /** 寸法計測・選択状態の反映に必要なため、表示専用でも受け取る */
  onNodesChange: (changes: NodeChange<GraphCanvasNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<GraphEdgeType>[]) => void;
  onSelectNode: (id: string) => void;
  onSelectEdge: (id: string) => void;
  onClearSelection: () => void;
  /**
   * 構造編集のハンドラ。
   * 渡さないときは表示専用（移動・接続・削除ができない）キャンバスになる。
   */
  editing?: GraphCanvasEditing;
};

/**
 * 会場グラフを描画する ReactFlow キャンバス。
 * グラフ本体の状態は持たず、描画と入力イベントの受け渡しを担う。
 * ルート追加モードは useEasyConnect、コンテキストメニューは
 * useCanvasContextMenu が状態を持ち、ここでは配線だけを行う。
 * 呼び出し側で ReactFlowProvider の内側に置くこと。
 */
export function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onSelectNode,
  onSelectEdge,
  onClearSelection,
  editing,
}: GraphCanvasProps) {
  const editable = editing !== undefined;
  const viewport = useViewport();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const nativeConnectionHandled = useRef(false);
  const [virtualHandle, setVirtualHandle] = useState<VirtualHandle | null>(
    null,
  );

  const easyConnect = useEasyConnect(wrapperRef);
  const contextMenu = useCanvasContextMenu({
    nodes,
    edges,
    onSelectNode,
    onSelectEdge,
    onClearSelection,
  });

  const displayNodes = useMemo(
    () =>
      virtualHandle
        ? addVirtualHandle(nodes, virtualHandle.nodeId, virtualHandle.side)
        : nodes,
    [nodes, virtualHandle],
  );

  const handleConnectStart = useCallback<OnConnectStart>((_, params) => {
    nativeConnectionHandled.current = false;
    const side = parseConnectHandleId(params.handleId);
    if (!params.nodeId || !side) return;
    setVirtualHandle({ nodeId: params.nodeId, side });
  }, []);

  const handleConnect = useCallback(
    (connection: Connection) => {
      // React Flow がハンドル上へのドロップを先に確定した場合は、
      // onConnectEnd のフォールバックで重ねて追加しない。
      nativeConnectionHandled.current = true;
      if (isStaleEasyConnection(connection, easyConnect.active)) return;
      editing?.onConnect(connection);
      // 始点固定モードはルートを1本作ったら完了
      if (easyConnect.mode?.kind === "from-node") easyConnect.end();
    },
    [easyConnect, editing],
  );

  const handleConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      setVirtualHandle(null);
      const wasHandledNatively = nativeConnectionHandled.current;
      nativeConnectionHandled.current = false;
      if (wasHandledNatively) {
        return;
      }
      // 始点固定モードで終点を確定できなかったときは、リリース位置に応じて
      // ドラッグの自動再開かモード終了かを選ぶ。
      if (easyConnect.mode?.kind === "from-node") {
        const plan = planFromNodeRelease({
          pointer: connectionState.pointer ?? null,
          releasePoint:
            "clientX" in event ? { x: event.clientX, y: event.clientY } : null,
          viewport,
          nodes,
          sourceNodeId: easyConnect.mode.sourceNodeId,
        });
        if (plan.kind === "restart") {
          easyConnect.startFromNode(easyConnect.mode.sourceNodeId, plan.origin);
        } else {
          easyConnect.end();
        }
        return;
      }
      if (
        easyConnect.active ||
        connectionState.fromHandle?.id === EASY_CONNECT_HANDLE_ID
      )
        return;
      if (!editing || !connectionState.fromNode || !connectionState.pointer)
        return;

      // ハンドルへの正確なドロップでなくても、ノードの近くでのリリースは
      // 接続として扱う（プレビューと同じ判定）。
      const preview = findConnectionPreview(
        toFlowPosition(connectionState.pointer, viewport),
        nodes,
        connectionState.fromNode.id,
      );
      if (!preview) return;

      const connection: Connection = {
        source: preview.sourceId,
        sourceHandle: null,
        target: preview.targetId,
        targetHandle: null,
      };
      if (editing.isValidConnection(connection)) {
        // 同じドラッグに対する end イベントが重複しても、追加は一度に留める。
        nativeConnectionHandled.current = true;
        editing.onConnect(connection);
      }
    },
    [easyConnect, editing, nodes, viewport],
  );

  const connectionLineComponent = useCallback(
    (props: ConnectionLineComponentProps<GraphCanvasNode>) =>
      (virtualHandle || easyConnect.active) && editing ? (
        <VirtualConnectionLine
          {...props}
          virtualHandle={virtualHandle}
          nodes={nodes}
          viewport={viewport}
          isValidConnection={editing.isValidConnection}
        />
      ) : null,
    [easyConnect.active, editing, nodes, viewport, virtualHandle],
  );

  const startEasyConnectFromNode = useCallback(
    (sourceNodeId: string) => {
      // コンテキストメニューを開いた位置（＝始点ノード上）からドラッグを始める。
      const origin = contextMenu.menu
        ? { x: contextMenu.menu.x, y: contextMenu.menu.y }
        : { x: 0, y: 0 };
      easyConnect.startFromNode(sourceNodeId, origin);
    },
    [contextMenu.menu, easyConnect],
  );

  const handlePaneClick = useCallback(() => {
    easyConnect.end();
    onClearSelection();
  }, [easyConnect, onClearSelection]);

  return (
    <div ref={wrapperRef} className="relative min-h-0 flex-1 bg-secondary">
      <GraphEdgeMarkers />
      {contextMenu.canvasMenu && editing ? (
        <GraphCanvasContextMenu
          position={contextMenu.canvasMenu}
          nodePosition={contextMenu.canvasMenu.nodePosition}
          nodeType="GOAL_TRANSIT_MIXED"
          onAddNode={editing.onAddNodeAtPosition}
          onAddGroup={editing.onAddGroupAtPosition}
          isEdgeCreationActive={easyConnect.active}
          onStartEdgeCreation={easyConnect.startGlobal}
          onEndEdgeCreation={easyConnect.end}
          onClose={contextMenu.close}
        />
      ) : null}
      {contextMenu.menuEdge && editing && contextMenu.menu ? (
        <GraphEdgeContextMenu
          edge={contextMenu.menuEdge}
          nodes={nodes}
          edges={edges}
          position={contextMenu.menu}
          onSetDirection={editing.onSetEdgeDirection}
          onReverse={editing.onReverseEdge}
          onDelete={editing.onDeleteEdge}
          onClose={contextMenu.close}
        />
      ) : null}
      {contextMenu.menuNode && editing && contextMenu.nodeMenu ? (
        isGroupNode(contextMenu.menuNode) ? (
          <GraphGroupContextMenu
            group={contextMenu.menuNode}
            position={contextMenu.nodeMenu}
            nodePosition={contextMenu.nodeMenu.nodePosition}
            nodeType="GOAL_TRANSIT_MIXED"
            onAddNode={editing.onAddNodeAtPosition}
            onAddGroup={editing.onAddGroupAtPosition}
            isEdgeCreationActive={easyConnect.active}
            onStartEdgeCreation={easyConnect.startGlobal}
            onEndEdgeCreation={easyConnect.end}
            onDissolve={editing.onDeleteNode}
            onClose={contextMenu.close}
          />
        ) : (
          <GraphNodeContextMenu
            node={contextMenu.menuNode}
            nodes={nodes}
            edges={edges}
            position={contextMenu.nodeMenu}
            onSetType={editing.onSetNodeType}
            onStartEdgeCreation={startEasyConnectFromNode}
            onDelete={editing.onDeleteNode}
            onClose={contextMenu.close}
          />
        )
      ) : null}
      <GraphNodeEasyConnectContext.Provider value={easyConnect.mode}>
        <GroupResizeCommitContext.Provider value={editing?.onGroupResizeEnd}>
          <GraphNodeLabelEditingContext.Provider
            value={editing?.onSetNodeLabel}
          >
            <ReactFlow
              nodes={displayNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={editable ? handleConnect : undefined}
              onConnectStart={editable ? handleConnectStart : undefined}
              onConnectEnd={editable ? handleConnectEnd : undefined}
              onNodeDragStop={
                editable
                  ? (_, __, draggedNodes) =>
                      editing?.onNodeDragStop(draggedNodes.map((n) => n.id))
                  : undefined
              }
              connectionLineComponent={
                virtualHandle || easyConnect.active
                  ? connectionLineComponent
                  : undefined
              }
              isValidConnection={editing?.isValidConnection}
              // 表示専用のときは選択だけを許し、構造を変える操作は塞ぐ
              nodesDraggable={editable && !easyConnect.active}
              nodesConnectable={editable}
              deleteKeyCode={editable ? ["Delete", "Backspace"] : null}
              onNodeClick={(_, n) => onSelectNode(n.id)}
              onNodeContextMenu={
                editable ? contextMenu.openNodeMenu : undefined
              }
              onEdgeClick={(_, e) => onSelectEdge(e.id)}
              onEdgeContextMenu={
                editable ? contextMenu.openEdgeMenu : undefined
              }
              onPaneClick={handlePaneClick}
              onPaneContextMenu={
                editable ? contextMenu.openPaneMenu : undefined
              }
              connectionMode={ConnectionMode.Loose}
              connectionRadius={CONNECTION_PREVIEW_RADIUS}
              minZoom={MIN_ZOOM}
              fitView
              fitViewOptions={FIT_VIEW_OPTIONS}
            >
              <InitialFitView
                hasNodes={nodes.length > 0}
                options={FIT_VIEW_OPTIONS}
              />
              {easyConnect.active ? (
                <EasyConnectPanel
                  fromNode={easyConnect.mode?.kind === "from-node"}
                  onEnd={easyConnect.end}
                />
              ) : null}
              <Background gap={20} size={1} />
              <Controls
                position="bottom-right"
                showInteractive={editable}
                fitViewOptions={FIT_VIEW_OPTIONS}
              />
              <MiniMap
                pannable
                zoomable
                nodeColor={(n: GraphCanvasNode) =>
                  isPointNode(n)
                    ? getNodeTypeDef(n.data?.nodeType ?? DEFAULT_NODE_TYPE)
                        .color
                    : GROUP_MINIMAP_COLOR
                }
              />
            </ReactFlow>
          </GraphNodeLabelEditingContext.Provider>
        </GroupResizeCommitContext.Provider>
      </GraphNodeEasyConnectContext.Provider>
    </div>
  );
}
