/** ListAliveEdges で取得した、presence 登録済み（接続中）の edge */
export type AliveEdge = {
  id: string;
  // presence が未設定なら null
  lastSeenAt: Date | null;
};

/** management側の接続状態。 */
export type ConnectionStatus =
  | "idle" // 未接続
  | "connecting" // セッション確立中（requestConnection）
  | "negotiating" // SDP/ICE 交換中
  | "connected" // P2P 接続確立
  | "disconnected" // 切断・接続失敗
  | "error"; // 要求エラー
