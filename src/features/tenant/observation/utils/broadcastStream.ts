import { createDevBroadcastStream } from "./devBroadcastStream";

export type BroadcastStreamHandle = {
  stream: MediaStream;
  dispose: () => void;
};

export const noopDispose = () => {};

/**
 * 配信用ストリームを映像ソースから直接取り出す。
 *
 * 以前は検出ボックスを焼き込んだ canvas を captureStream していたが、
 * rAF ごとのフル解像度合成がエンコーダに 60fps 相当のフレームを流し込み、
 * 映像の乱れと FPS 低下の主因になっていた。カメラ等の MediaStream は
 * clone してそのまま送り、ボックスは DataChannel 経由で受信側が描画する。
 */
export function createBroadcastStream(
  video: HTMLVideoElement,
): BroadcastStreamHandle | null {
  if (video.srcObject instanceof MediaStream) {
    return { stream: video.srcObject.clone(), dispose: noopDispose };
  }

  // srcObject を持たない映像ソースは開発用のファイル再生
  // （DevVideoSourcePanel）だけなので、フォールバックは開発時に限る
  if (process.env.NODE_ENV === "development") {
    return createDevBroadcastStream(video);
  }

  return null;
}
