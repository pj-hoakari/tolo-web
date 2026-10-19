import {
  clampUnit,
  type DetectionCountingLineSetting,
  type DetectionLineCount,
} from "@/features/tenant/detection/stores/detectionStore";

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
  name: string;
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
  /** ライン通過数。management 側でも observation と同じ一覧を出すために載せる */
  lineCounts: Record<string, DetectionLineCount>;
};

/** 0〜1 で保持している設定値を元映像のピクセル空間へ移す */
export function toOverlayCountingLines(
  countingLines: DetectionCountingLineSetting[],
  width: number,
  height: number,
): DetectionOverlayLine[] {
  return countingLines.map((countingLine) => ({
    id: countingLine.id,
    name: countingLine.name,
    p1: {
      x: clampUnit(countingLine.p1.x) * width,
      y: clampUnit(countingLine.p1.y) * height,
    },
    p2: {
      x: clampUnit(countingLine.p2.x) * width,
      y: clampUnit(countingLine.p2.y) * height,
    },
  }));
}

export function drawCountingLine(
  context: CanvasRenderingContext2D,
  countingLine: DetectionOverlayLine,
  width: number,
  isHighlighted = false,
): void {
  context.save();
  const lineWidth = Math.max(3, width / 320) * (isHighlighted ? 1.5 : 1);
  const lineColor = isHighlighted ? "#fbbf24" : "#f8fafc";
  context.lineCap = "round";
  context.lineJoin = "round";
  const strokeVisiblePath = () => {
    // 明るい映像でも輪郭を保ち、色だけに頼らず編集対象を見分けられるようにする。
    context.lineWidth = lineWidth + Math.max(3, width / 480);
    context.strokeStyle = "rgba(15, 23, 42, 0.85)";
    context.stroke();
    context.lineWidth = lineWidth;
    context.strokeStyle = lineColor;
    context.stroke();
  };

  context.setLineDash(isHighlighted ? [] : [12, 8]);
  context.beginPath();
  context.moveTo(countingLine.p1.x, countingLine.p1.y);
  context.lineTo(countingLine.p2.x, countingLine.p2.y);
  strokeVisiblePath();
  context.setLineDash([]);

  // forward は p1→p2 に対する負側→正側なので、左法線方向の矢印で示す。
  const dx = countingLine.p2.x - countingLine.p1.x;
  const dy = countingLine.p2.y - countingLine.p1.y;
  const lineLength = Math.hypot(dx, dy);
  if (lineLength > 0) {
    const normalX = -dy / lineLength;
    const normalY = dx / lineLength;
    const midpointX = (countingLine.p1.x + countingLine.p2.x) / 2;
    const midpointY = (countingLine.p1.y + countingLine.p2.y) / 2;
    const arrowLength = Math.max(24, width / 20);
    const arrowHeadLength = Math.max(8, width / 80);
    const arrowStartX = midpointX - (normalX * arrowLength) / 2;
    const arrowStartY = midpointY - (normalY * arrowLength) / 2;
    const arrowEndX = midpointX + (normalX * arrowLength) / 2;
    const arrowEndY = midpointY + (normalY * arrowLength) / 2;
    const tangentX = -normalY;
    const tangentY = normalX;

    context.beginPath();
    context.moveTo(arrowStartX, arrowStartY);
    context.lineTo(arrowEndX, arrowEndY);
    context.moveTo(arrowEndX, arrowEndY);
    context.lineTo(
      arrowEndX - normalX * arrowHeadLength + tangentX * arrowHeadLength * 0.6,
      arrowEndY - normalY * arrowHeadLength + tangentY * arrowHeadLength * 0.6,
    );
    context.moveTo(arrowEndX, arrowEndY);
    context.lineTo(
      arrowEndX - normalX * arrowHeadLength - tangentX * arrowHeadLength * 0.6,
      arrowEndY - normalY * arrowHeadLength - tangentY * arrowHeadLength * 0.6,
    );
    strokeVisiblePath();
  }

  if (countingLine.name) {
    const midpointX = (countingLine.p1.x + countingLine.p2.x) / 2;
    const midpointY = (countingLine.p1.y + countingLine.p2.y) / 2;
    const fontSize = Math.max(14, width / 48);
    context.font = `600 ${fontSize}px sans-serif`;
    const paddingX = 6;
    const labelWidth =
      context.measureText(countingLine.name).width + paddingX * 2;
    const labelHeight = fontSize + 8;
    const labelX = midpointX - labelWidth / 2;
    const labelY = midpointY - labelHeight - 8;
    context.fillStyle = "rgba(17, 24, 39, 0.85)";
    context.fillRect(labelX, labelY, labelWidth, labelHeight);
    context.fillStyle = lineColor;
    context.fillText(
      countingLine.name,
      labelX + paddingX,
      labelY + labelHeight - 6,
    );
  }

  const handleRadius = Math.max(isHighlighted ? 8 : 6, width / 96);
  context.fillStyle = lineColor;
  for (const point of [countingLine.p1, countingLine.p2]) {
    context.beginPath();
    context.arc(point.x, point.y, handleRadius, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = Math.max(2, width / 480);
    context.strokeStyle = "#0f172a";
    context.stroke();
    if (isHighlighted) {
      context.beginPath();
      context.arc(point.x, point.y, handleRadius * 0.35, 0, Math.PI * 2);
      context.fillStyle = "#0f172a";
      context.fill();
      context.fillStyle = lineColor;
    }
  }
  context.restore();
}

export function drawDetectionOverlay(
  context: CanvasRenderingContext2D,
  frame: DetectionOverlayFrame,
  options: { highlightedLineId?: string | null } = {},
): void {
  const { width } = frame;

  // 編集対象を最後に描き、交差している他のラインにも埋もれないようにする。
  for (const countingLine of frame.countingLines) {
    if (countingLine.id !== options.highlightedLineId) {
      drawCountingLine(context, countingLine, width);
    }
  }
  const highlightedLine = frame.countingLines.find(
    (line) => line.id === options.highlightedLineId,
  );
  if (highlightedLine) {
    drawCountingLine(context, highlightedLine, width, true);
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
      !Array.isArray((frame as DetectionOverlayFrame).countingLines) ||
      typeof (frame as DetectionOverlayFrame).lineCounts !== "object" ||
      (frame as DetectionOverlayFrame).lineCounts === null
    ) {
      return null;
    }
    return frame as DetectionOverlayFrame;
  } catch {
    return null;
  }
}
