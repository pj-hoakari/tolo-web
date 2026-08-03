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
  getBezierPath,
  MiniMap,
  type NodeChange,
  type NodeTypes,
  type OnConnectEnd,
  type OnConnectStart,
  Panel,
  Position,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  useStoreApi,
  useViewport,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_NODE_TYPE, getNodeTypeDef } from "../nodeTypes";
import type {
  GraphEdgeType,
  GraphNodeType,
  HandleSide,
  NodeType,
} from "../type";
import {
  CONNECTION_PREVIEW_RADIUS,
  findConnectionPreview,
  toFlowPosition,
} from "../utils/connectionPreview";
import { addVirtualHandle } from "../utils/handles";
import { GraphCanvasContextMenu } from "./GraphCanvasContextMenu";
import { GraphEdge, GraphEdgeMarkers } from "./GraphEdge";
import { GraphEdgeContextMenu } from "./GraphEdgeContextMenu";
import {
  GraphNode,
  GraphNodeEasyConnectContext,
  type GraphNodeEasyConnectMode,
  GraphNodeLabelEditingContext,
} from "./GraphNode";
import { GraphNodeContextMenu } from "./GraphNodeContextMenu";

const nodeTypes: NodeTypes = { graph: GraphNode };
const edgeTypes: EdgeTypes = { graph: GraphEdge };

// React Flow の既定値（50%）だと、広い会場グラフを fitView しても
// 下限で止まり、端のノードが画面外に残る。
const MIN_ZOOM = 0.01;
const FIT_VIEW_OPTIONS = { padding: 0.2, minZoom: MIN_ZOOM };
const SIDES: HandleSide[] = ["top", "right", "bottom", "left"];
const positionBySide: Record<HandleSide, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

type VirtualHandle = { nodeId: string; side: HandleSide };

function VirtualConnectionLine({
  virtualHandle,
  nodes,
  viewport,
  isValidConnection,
  fromHandle,
  fromNode,
  fromPosition,
  fromX,
  fromY,
  pointer,
  toPosition,
  toX,
  toY,
  connectionLineStyle,
}: ConnectionLineComponentProps<GraphNodeType> & {
  virtualHandle: VirtualHandle | null;
  nodes: GraphNodeType[];
  viewport: { x: number; y: number; zoom: number };
  isValidConnection: GraphCanvasEditing["isValidConnection"];
}) {
  const preview = findConnectionPreview(
    toFlowPosition(pointer, viewport),
    nodes,
    fromNode.id,
  );
  const connection = preview
    ? {
        source: preview.sourceId,
        sourceHandle: null,
        target: preview.targetId,
        targetHandle: null,
      }
    : null;
  const virtualPreview =
    preview && connection && isValidConnection(connection) ? preview : null;
  const virtualSlot = virtualHandle
    ? fromNode.data.handles?.[virtualHandle.side].find((slot) => slot.virtual)
    : undefined;
  const shouldUseVirtualSlot =
    virtualHandle !== null &&
    fromNode.id === virtualHandle.nodeId &&
    fromHandle.id === `connect-${virtualHandle.side}` &&
    virtualSlot !== undefined;
  const source = virtualPreview
    ? virtualPreview.sourcePosition
    : shouldUseVirtualSlot
      ? virtualSlotPosition(fromNode, virtualSlot)
      : { x: fromX, y: fromY };
  const target = virtualPreview?.targetPosition ?? { x: toX, y: toY };
  const [path] = getBezierPath({
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition: virtualPreview
      ? positionBySide[virtualPreview.sourceSide]
      : fromPosition,
    targetX: target.x,
    targetY: target.y,
    targetPosition: virtualPreview
      ? positionBySide[virtualPreview.targetSide]
      : toPosition,
  });

  return (
    <path
      d={path}
      fill="none"
      className="react-flow__connection-path"
      style={
        virtualPreview
          ? { ...connectionLineStyle, strokeDasharray: "6 4" }
          : connectionLineStyle
      }
    />
  );
}

function virtualSlotPosition(
  node: ConnectionLineComponentProps<GraphNodeType>["fromNode"],
  slot: { side: HandleSide; index: number; total: number },
) {
  const width = node.measured.width ?? node.width ?? 0;
  const height = node.measured.height ?? node.height ?? 0;
  const position = (slot.index + 1) / (slot.total + 1);
  const { x, y } = node.internals.positionAbsolute;

  switch (slot.side) {
    case "top":
      return { x: x + width * position, y };
    case "right":
      return { x: x + width, y: y + height * position };
    case "bottom":
      return { x: x + width * position, y: y + height };
    case "left":
      return { x, y: y + height * position };
  }
}

/** ノードの実寸法が確定してから、初回だけグラフ全体を表示する。 */
function InitialFitView({ hasNodes }: { hasNodes: boolean }) {
  const nodesInitialized = useNodesInitialized();
  const { fitView, viewportInitialized } = useReactFlow<
    GraphNodeType,
    GraphEdgeType
  >();
  const hasFitted = useRef(false);

  useEffect(() => {
    if (
      !hasNodes ||
      !nodesInitialized ||
      !viewportInitialized ||
      hasFitted.current
    )
      return;

    hasFitted.current = true;
    void fitView(FIT_VIEW_OPTIONS);
  }, [fitView, hasNodes, nodesInitialized, viewportInitialized]);

  return null;
}

/** グラフ構造そのものを編集するためのハンドラ一式 */
export type GraphCanvasEditing = {
  onConnect: (connection: Connection) => void;
  isValidConnection: (connection: Connection | GraphEdgeType) => boolean;
  onSetEdgeDirection: (id: string, direction: "both" | "oneway") => void;
  onReverseEdge: (id: string) => void;
  onSetNodeType: (id: string, type: GraphNodeType["data"]["nodeType"]) => void;
  onSetNodeLabel: (id: string, label: string) => void;
  onAddNodeAtPosition: (
    position: { x: number; y: number },
    nodeType?: NodeType,
  ) => void;
  onDeleteNode: (id: string) => void;
  onDeleteEdge: (id: string) => void;
};

export type GraphCanvasProps = {
  nodes: GraphNodeType[];
  edges: GraphEdgeType[];
  /** 寸法計測・選択状態の反映に必要なため、表示専用でも受け取る */
  onNodesChange: (changes: NodeChange<GraphNodeType>[]) => void;
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
 * 接続ドラッグ中だけは端点をずらすための一時的な描画状態を持つ。
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
  const { screenToFlowPosition } = useReactFlow<GraphNodeType, GraphEdgeType>();
  const storeApi = useStoreApi<GraphNodeType, GraphEdgeType>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const nativeConnectionHandled = useRef(false);
  const [contextMenu, setContextMenu] = useState<
    | { kind: "edge"; elementId: string; x: number; y: number }
    | { kind: "node"; elementId: string; x: number; y: number }
    | {
        kind: "canvas";
        x: number;
        y: number;
        nodePosition: { x: number; y: number };
      }
    | null
  >(null);
  const [virtualHandle, setVirtualHandle] = useState<VirtualHandle | null>(
    null,
  );
  const [easyConnectMode, setEasyConnectMode] =
    useState<GraphNodeEasyConnectMode | null>(null);
  const easyConnectActive = easyConnectMode !== null;
  const displayNodes = useMemo(
    () =>
      virtualHandle
        ? addVirtualHandle(nodes, virtualHandle.nodeId, virtualHandle.side)
        : nodes,
    [nodes, virtualHandle],
  );
  const endEasyConnect = useCallback(() => {
    setEasyConnectMode(null);
    // 進行中の接続ドラッグが残っていた場合も、接続線ごと破棄する。
    storeApi.getState().cancelConnection();
  }, [storeApi]);
  const handleConnectStart = useCallback<OnConnectStart>((_, params) => {
    nativeConnectionHandled.current = false;
    const side = params.handleId?.replace("connect-", "") as HandleSide;
    if (!params.nodeId || !SIDES.includes(side)) return;
    setVirtualHandle({ nodeId: params.nodeId, side });
  }, []);
  const handleConnect = useCallback(
    (connection: Connection) => {
      // React Flow がハンドル上へのドロップを先に確定した場合は、
      // onConnectEnd のフォールバックで重ねて追加しない。
      nativeConnectionHandled.current = true;
      // モード終了後に片付け切れていないドラッグから届く easy-connect 由来の
      // 接続は反映しない。
      if (
        !easyConnectActive &&
        (connection.sourceHandle === "easy-connect" ||
          connection.targetHandle === "easy-connect")
      ) {
        return;
      }
      editing?.onConnect(connection);
      if (easyConnectMode?.kind === "from-node") endEasyConnect();
    },
    [easyConnectActive, easyConnectMode, editing, endEasyConnect],
  );
  const handleConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      setVirtualHandle(null);
      const wasHandledNatively = nativeConnectionHandled.current;
      nativeConnectionHandled.current = false;
      if (wasHandledNatively) {
        return;
      }
      // 始点固定モードで終点を確定できなかったとき: 接続できないノードの
      // 近くでのリリースならドラッグを自動再開して選び直せるようにし、
      // 何もない場所でのリリースならモードごと終了する。
      if (easyConnectMode?.kind === "from-node") {
        const nearNode =
          connectionState.pointer !== null &&
          findConnectionPreview(
            toFlowPosition(connectionState.pointer, viewport),
            nodes,
            easyConnectMode.sourceNodeId,
          ) !== null;
        if (nearNode && "clientX" in event) {
          setEasyConnectMode({
            kind: "from-node",
            sourceNodeId: easyConnectMode.sourceNodeId,
            origin: { x: event.clientX, y: event.clientY },
          });
        } else {
          endEasyConnect();
        }
        return;
      }
      if (
        easyConnectActive ||
        connectionState.fromHandle?.id === "easy-connect"
      )
        return;
      if (!editing || !connectionState.fromNode || !connectionState.pointer)
        return;

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
    [
      easyConnectActive,
      easyConnectMode,
      editing,
      endEasyConnect,
      nodes,
      viewport,
    ],
  );
  const connectionLineComponent = useCallback(
    (props: ConnectionLineComponentProps<GraphNodeType>) =>
      (virtualHandle || easyConnectActive) && editing ? (
        <VirtualConnectionLine
          {...props}
          virtualHandle={virtualHandle}
          nodes={nodes}
          viewport={viewport}
          isValidConnection={editing.isValidConnection}
        />
      ) : null,
    [easyConnectActive, editing, nodes, viewport, virtualHandle],
  );
  const startEasyConnect = useCallback(() => {
    setEasyConnectMode({ kind: "global" });
  }, []);
  const startEasyConnectFromNode = useCallback(
    (sourceNodeId: string) => {
      setEasyConnectMode({
        kind: "from-node",
        sourceNodeId,
        // コンテキストメニューを開いた位置（＝始点ノード上）からドラッグを始める。
        origin: contextMenu
          ? { x: contextMenu.x, y: contextMenu.y }
          : { x: 0, y: 0 },
      });
    },
    [contextMenu],
  );
  // 始点固定モードでは、始点ノードからの接続ドラッグを自動で開始する。
  // これによりユーザーは終点のノードをクリックするだけでルートを作成できる。
  useEffect(() => {
    if (easyConnectMode?.kind !== "from-node") return;

    const { sourceNodeId, origin } = easyConnectMode;
    let rafId = 0;
    let attempts = 0;
    const startConnectionDrag = () => {
      const node = storeApi.getState().nodeLookup.get(sourceNodeId);
      const handleRegistered = node?.internals.handleBounds?.source?.some(
        (handle) => handle.id === "easy-connect",
      );
      const handleElement = wrapperRef.current?.querySelector<HTMLElement>(
        `.react-flow__handle[data-handleid="easy-connect"][data-nodeid="${CSS.escape(sourceNodeId)}"]`,
      );
      if (!handleRegistered || !handleElement) {
        // updateNodeInternals は rAF 遅延のため、ハンドル登録を待って再試行する。
        if (attempts < 10) {
          attempts += 1;
          rafId = requestAnimationFrame(startConnectionDrag);
        }
        return;
      }
      handleElement.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: origin.x,
          clientY: origin.y,
        }),
      );
      // ドラッグ閾値を越えさせて、マウスを動かす前から接続線を表示する。
      document.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: origin.x + 2,
          clientY: origin.y + 2,
        }),
      );
    };
    rafId = requestAnimationFrame(startConnectionDrag);
    return () => cancelAnimationFrame(rafId);
  }, [easyConnectMode, storeApi]);
  const handlePaneClick = useCallback(() => {
    endEasyConnect();
    onClearSelection();
  }, [endEasyConnect, onClearSelection]);
  useEffect(() => {
    if (!easyConnectActive) return;

    const cancelEasyConnect = (event: KeyboardEvent) => {
      if (event.key === "Escape") endEasyConnect();
    };
    window.addEventListener("keydown", cancelEasyConnect);
    return () => window.removeEventListener("keydown", cancelEasyConnect);
  }, [easyConnectActive, endEasyConnect]);
  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: GraphEdgeType) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectEdge(edge.id);
      setContextMenu({
        kind: "edge",
        elementId: edge.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [onSelectEdge],
  );
  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: GraphNodeType) => {
      event.preventDefault();
      event.stopPropagation();
      onSelectNode(node.id);
      setContextMenu({
        kind: "node",
        elementId: node.id,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [onSelectNode],
  );
  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      onClearSelection();
      setContextMenu({
        kind: "canvas",
        x: event.clientX,
        y: event.clientY,
        nodePosition: screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        }),
      });
    },
    [onClearSelection, screenToFlowPosition],
  );
  const contextMenuEdge = contextMenu
    ? contextMenu.kind === "edge"
      ? edges.find((edge) => edge.id === contextMenu.elementId)
      : undefined
    : undefined;
  const contextMenuNode = contextMenu
    ? contextMenu.kind === "node"
      ? nodes.find((node) => node.id === contextMenu.elementId)
      : undefined
    : undefined;
  const canvasContextMenu =
    contextMenu?.kind === "canvas" ? contextMenu : undefined;

  return (
    <div ref={wrapperRef} className="relative min-h-0 flex-1 bg-secondary">
      <GraphEdgeMarkers />
      {canvasContextMenu && editing ? (
        <GraphCanvasContextMenu
          position={canvasContextMenu}
          nodePosition={canvasContextMenu.nodePosition}
          nodeType="GOAL_TRANSIT_MIXED"
          onAddNode={editing.onAddNodeAtPosition}
          isEdgeCreationActive={easyConnectActive}
          onStartEdgeCreation={startEasyConnect}
          onEndEdgeCreation={endEasyConnect}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
      {contextMenuEdge && editing && contextMenu ? (
        <GraphEdgeContextMenu
          edge={contextMenuEdge}
          nodes={nodes}
          edges={edges}
          position={contextMenu}
          onSetDirection={editing.onSetEdgeDirection}
          onReverse={editing.onReverseEdge}
          onDelete={editing.onDeleteEdge}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
      {contextMenuNode && editing && contextMenu ? (
        <GraphNodeContextMenu
          node={contextMenuNode}
          nodes={nodes}
          edges={edges}
          position={contextMenu}
          onSetType={editing.onSetNodeType}
          onStartEdgeCreation={startEasyConnectFromNode}
          onDelete={editing.onDeleteNode}
          onClose={() => setContextMenu(null)}
        />
      ) : null}
      <GraphNodeEasyConnectContext.Provider value={easyConnectMode}>
        <GraphNodeLabelEditingContext.Provider value={editing?.onSetNodeLabel}>
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
            connectionLineComponent={
              virtualHandle || easyConnectActive
                ? connectionLineComponent
                : undefined
            }
            isValidConnection={editing?.isValidConnection}
            // 表示専用のときは選択だけを許し、構造を変える操作は塞ぐ
            nodesDraggable={editable && !easyConnectActive}
            nodesConnectable={editable}
            deleteKeyCode={editable ? ["Delete", "Backspace"] : null}
            onNodeClick={(_, n) => onSelectNode(n.id)}
            onNodeContextMenu={editable ? handleNodeContextMenu : undefined}
            onEdgeClick={(_, e) => onSelectEdge(e.id)}
            onEdgeContextMenu={editable ? handleEdgeContextMenu : undefined}
            onPaneClick={handlePaneClick}
            onPaneContextMenu={editable ? handlePaneContextMenu : undefined}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={CONNECTION_PREVIEW_RADIUS}
            minZoom={MIN_ZOOM}
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
          >
            <InitialFitView hasNodes={nodes.length > 0} />
            {easyConnectActive ? (
              <Panel position="top-center">
                <div className="flex items-center rounded-md border border-primary bg-card px-3 py-2 text-foreground text-sm shadow-sm">
                  <div>
                    {easyConnectMode?.kind === "from-node"
                      ? "ルートを追加: 終点にするポイントをクリック"
                      : "ルートを追加: ポイントから別のポイントへドラッグ"}
                    <span className="ml-2 text-muted-foreground text-xs">
                      Esc でキャンセル
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-3 h-7"
                    onPress={endEasyConnect}
                  >
                    ルート追加を終了
                  </Button>
                </div>
              </Panel>
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
              nodeColor={(n: GraphNodeType) =>
                getNodeTypeDef(n.data?.nodeType ?? DEFAULT_NODE_TYPE).color
              }
            />
          </ReactFlow>
        </GraphNodeLabelEditingContext.Provider>
      </GraphNodeEasyConnectContext.Provider>
    </div>
  );
}
