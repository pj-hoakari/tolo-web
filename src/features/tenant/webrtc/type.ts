/** ListAliveEdges で取得した、presence 登録済み（接続中）の edge */
export type AliveEdge = {
  id: string;
  // presence が未設定なら null
  lastSeenAt: Date | null;
};
