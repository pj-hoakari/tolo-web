export type DetectionOverlayPoint = {
  x: number;
  y: number;
};

export type DetectionOverlayBox = {
  trackId: number;
  score: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type DetectionOverlayLine = {
  id: string;
  p1: DetectionOverlayPoint;
  p2: DetectionOverlayPoint;
};

/**
 * 検出結果オーバーレイの 1 フレーム分。
 *
 * 座標はすべて元映像のピクセル空間（width × height）。
 * observation 側のローカル描画と、DataChannel で management 側へ送って
 * 受信側で描画する際の共通フォーマットとして使う。
 */
export type DetectionOverlayFrame = {
  width: number;
  height: number;
  detections: DetectionOverlayBox[];
  countingLines: DetectionOverlayLine[];
};

export function drawCountingLine(
  context: CanvasRenderingContext2D,
  countingLine: DetectionOverlayLine,
  width: number,
): void {
  context.lineWidth = Math.max(2, width / 320);
  context.strokeStyle = "#f59e0b";
  context.fillStyle = "#f59e0b";
  context.setLineDash([12, 8]);
  context.beginPath();
  context.moveTo(countingLine.p1.x, countingLine.p1.y);
  context.lineTo(countingLine.p2.x, countingLine.p2.y);
  context.stroke();
  context.setLineDash([]);

  const handleRadius = Math.max(6, width / 96);
  context.beginPath();
  context.arc(
    countingLine.p1.x,
    countingLine.p1.y,
    handleRadius,
    0,
    Math.PI * 2,
  );
  context.arc(
    countingLine.p2.x,
    countingLine.p2.y,
    handleRadius,
    0,
    Math.PI * 2,
  );
  context.fill();
}

export function drawDetectionOverlay(
  context: CanvasRenderingContext2D,
  frame: DetectionOverlayFrame,
): void {
  const { width } = frame;

  for (const countingLine of frame.countingLines) {
    drawCountingLine(context, countingLine, width);
  }

  context.font = `${Math.max(16, width / 40)}px sans-serif`;

  for (const detection of frame.detections) {
    const boxWidth = detection.x2 - detection.x1;
    const boxHeight = detection.y2 - detection.y1;
    const label = `Person #${detection.trackId} ${Math.round(
      detection.score * 100,
    )}%`;

    context.strokeStyle = "#22c55e";
    context.strokeRect(detection.x1, detection.y1, boxWidth, boxHeight);

    const labelWidth = context.measureText(label).width + 12;
    const labelHeight = Math.max(22, width / 32);
    const labelY = Math.max(0, detection.y1 - labelHeight);
    context.fillStyle = "#22c55e";
    context.fillRect(detection.x1, labelY, labelWidth, labelHeight);
    context.fillStyle = "#052e16";
    context.fillText(label, detection.x1 + 6, labelY + labelHeight - 6);
  }
}

/**
 * DataChannel で受信したメッセージを DetectionOverlayFrame として解釈する。
 * 形式が想定と異なる場合（"null" のクリア通知を含む）は null を返す。
 */
export function parseDetectionOverlayFrame(
  data: string,
): DetectionOverlayFrame | null {
  try {
    const frame: unknown = JSON.parse(data);
    if (
      frame === null ||
      typeof frame !== "object" ||
      typeof (frame as DetectionOverlayFrame).width !== "number" ||
      typeof (frame as DetectionOverlayFrame).height !== "number" ||
      !Array.isArray((frame as DetectionOverlayFrame).detections) ||
      !Array.isArray((frame as DetectionOverlayFrame).countingLines)
    ) {
      return null;
    }
    return frame as DetectionOverlayFrame;
  } catch {
    return null;
  }
}
