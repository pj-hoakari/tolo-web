export const JPEG_CHUNK = 12000;
export const JPEG_MAX_FRAME = 256 * 1024;

const JPEG_MAGIC = 0x3147504a; // "JPG1" little-endian

export interface AssembledJpeg {
  id: number;
  bytes: Uint8Array<ArrayBuffer>;
  assemblyMs: number;
}

interface PartialFrame {
  id: number;
  total: number;
  start: number;
  bytes: Uint8Array<ArrayBuffer>;
  seen: Set<number>;
  count: number;
}

/**
 * ESP32 が `jpeg` DataChannel へ送る JPG1 断片を組み立てる。
 * unordered / partial reliable なので、順序入れ替え・重複・欠落を許容する。
 * 実装は viewer-server の receiver.js と同じ判定を保つ。
 */
export class JpegAssembler {
  private readonly frames = new Map<number, PartialFrame>();
  private newest: number | null = null;
  private last: number | null = null;

  push(buffer: ArrayBuffer, now = performance.now()): AssembledJpeg | null {
    if (
      !(buffer instanceof ArrayBuffer) ||
      buffer.byteLength <= 20 ||
      buffer.byteLength > JPEG_CHUNK + 20
    ) {
      return null;
    }
    const view = new DataView(buffer);
    if (view.getUint32(0, true) !== JPEG_MAGIC) {
      return null;
    }
    const id = view.getUint32(4, true);
    const total = view.getUint32(8, true);
    const offset = view.getUint32(12, true);
    const length = buffer.byteLength - 20;
    if (
      total < 4 ||
      total > JPEG_MAX_FRAME ||
      offset >= total ||
      offset % JPEG_CHUNK !== 0 ||
      length !== Math.min(JPEG_CHUNK, total - offset)
    ) {
      return null;
    }
    if (this.last !== null && ((id - this.last) | 0) <= 0) {
      return null;
    }
    for (const [key, frame] of this.frames) {
      if (now - frame.start > 1000) {
        this.frames.delete(key);
      }
    }
    if (this.newest === null || ((id - this.newest) | 0) > 0) {
      this.newest = id;
    }
    if (((this.newest - id) | 0) > 2) {
      return null;
    }
    for (const key of this.frames.keys()) {
      if (((this.newest - key) | 0) > 2) {
        this.frames.delete(key);
      }
    }
    if (!this.frames.has(id)) {
      this.frames.set(id, {
        id,
        total,
        start: now,
        bytes: new Uint8Array(total),
        seen: new Set(),
        count: Math.ceil(total / JPEG_CHUNK),
      });
    }
    const frame = this.frames.get(id);
    if (!frame || frame.total !== total) {
      return null;
    }
    if (!frame.seen.has(offset)) {
      frame.bytes.set(new Uint8Array(buffer, 20), offset);
      frame.seen.add(offset);
    }
    if (frame.seen.size !== frame.count) {
      return null;
    }
    this.frames.delete(id);
    const bytes = frame.bytes;
    if (
      bytes[0] !== 255 ||
      bytes[1] !== 216 ||
      bytes[total - 2] !== 255 ||
      bytes[total - 1] !== 217
    ) {
      return null;
    }
    this.last = id;
    for (const key of this.frames.keys()) {
      if (((id - key) | 0) >= 0) {
        this.frames.delete(key);
      }
    }
    return { id, bytes, assemblyMs: now - frame.start };
  }
}
