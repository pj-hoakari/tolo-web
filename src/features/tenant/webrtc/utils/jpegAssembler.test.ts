import { describe, expect, it } from "vitest";
import { JPEG_CHUNK, JPEG_MAX_FRAME, JpegAssembler } from "./jpegAssembler";

function packet(id: number, jpeg: Uint8Array, offset: number): ArrayBuffer {
  const length = Math.min(JPEG_CHUNK, jpeg.length - offset);
  const buffer = new ArrayBuffer(20 + length);
  const view = new DataView(buffer);
  view.setUint32(0, 0x3147504a, true);
  view.setUint32(4, id, true);
  view.setUint32(8, jpeg.length, true);
  view.setUint32(12, offset, true);
  new Uint8Array(buffer, 20).set(jpeg.subarray(offset, offset + length));
  return buffer;
}

function jpeg(length: number): Uint8Array {
  const bytes = new Uint8Array(length).fill(37);
  bytes.set([255, 216]);
  bytes.set([255, 217], length - 2);
  return bytes;
}

describe("JpegAssembler", () => {
  it("HD サイズを順序入れ替え・重複ありで正確に復元する", () => {
    const assembler = new JpegAssembler();
    const bytes = jpeg(150001);
    const offsets = Array.from(
      { length: Math.ceil(bytes.length / JPEG_CHUNK) },
      (_, index) => index * JPEG_CHUNK,
    ).reverse();

    expect(assembler.push(packet(1, bytes, offsets[0]), 0)).toBeNull();
    let result = null;
    for (const offset of offsets) {
      result = assembler.push(packet(1, bytes, offset), 10) ?? result;
    }
    expect(result?.bytes).toEqual(bytes);
    expect(assembler.push(packet(1, bytes, 0), 20)).toBeNull();
  });

  it("欠落・期限切れ・新しいフレームが混ざらない", () => {
    const assembler = new JpegAssembler();
    const bytes = jpeg(JPEG_CHUNK + 10);
    assembler.push(packet(7, bytes, 0), 0);
    expect(assembler.push(packet(7, bytes, JPEG_CHUNK), 1100)).toBeNull();
    assembler.push(packet(8, bytes, JPEG_CHUNK), 1101);
    expect(assembler.push(packet(7, bytes, 0), 1102)?.id).toBe(7);
    expect(assembler.push(packet(8, bytes, 0), 1103)?.bytes).toEqual(bytes);
  });

  it("新しいフレームが来ても完成間近の古いフレームを捨てない", () => {
    const assembler = new JpegAssembler();
    const bytes = jpeg(JPEG_CHUNK + 10);
    assembler.push(packet(1, bytes, 0), 0);
    assembler.push(packet(2, bytes, 0), 1);
    expect(assembler.push(packet(1, bytes, JPEG_CHUNK), 2)?.bytes).toEqual(
      bytes,
    );
    expect(assembler.push(packet(2, bytes, JPEG_CHUNK), 3)?.bytes).toEqual(
      bytes,
    );
  });

  it("不正なサイズ・整列・マジック・壊れた JPEG を拒否する", () => {
    const assembler = new JpegAssembler();
    const bytes = jpeg(32);
    for (const [position, value] of [
      [0, 0],
      [8, JPEG_MAX_FRAME + 1],
      [12, 1],
    ]) {
      const buffer = packet(1, bytes, 0);
      new DataView(buffer).setUint32(position, value, true);
      expect(assembler.push(buffer, 0)).toBeNull();
    }
    bytes[0] = 0;
    expect(assembler.push(packet(2, bytes, 0), 0)).toBeNull();
    expect(assembler.push(new ArrayBuffer(20), 0)).toBeNull();
  });

  it("uint32 の境界をまたぐフレーム ID を扱える", () => {
    const assembler = new JpegAssembler();
    const bytes = jpeg(32);
    expect(assembler.push(packet(0xffffffff, bytes, 0), 0)?.id).toBe(
      0xffffffff,
    );
    expect(assembler.push(packet(0, bytes, 0), 1)?.id).toBe(0);
    expect(assembler.push(packet(0xffffffff, bytes, 0), 2)).toBeNull();
  });
});
