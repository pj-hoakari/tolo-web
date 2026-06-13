export async function detectCrowd(source: MediaStream): Promise<MediaStream> {
  // TODO: source のフレームに対して検出処理，検出結果を反映した新しい映像ストリームを生成

  // loading表示用ダミー遅延実装
  await new Promise((resolve) => setTimeout(resolve, 3000));

  return source;
}
