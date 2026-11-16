import { describe, expect, it } from "vitest";
import { areaLabelSize, roomLabel, textEm } from "./roomLabel";

describe("部屋・区画の名前の出し方", () => {
  it("文字の幅は、全角 1・半角 0.6（em）", () => {
    expect(textEm("受付")).toBe(2);
    expect(textEm("401")).toBeCloseTo(1.8);
  });
  it("大きい部屋ほど大きく出す（上限あり）", () => {
    const small = roomLabel("教室", 120, 80);
    const large = roomLabel("教室", 400, 300);
    expect(large.size).toBeGreaterThan(small.size);
    expect(large.size).toBeLessThanOrEqual(22);
  });
  it("幅が足りなければ、入る大きさまで小さくする", () => {
    // 1 行でも 2 行でも、どの行も部屋の幅（左右の余白を除く）に収まる
    const l = roomLabel("女子トイレ", 80, 140);
    for (const line of l.lines)
      expect(l.size * textEm(line, 0.04)).toBeLessThanOrEqual(80 - 16);
  });
  it("大きい部屋・範囲は、名前を少し大きく出す（上限あり）", () => {
    expect(roomLabel("ホール", 520, 480).size).toBe(22);
    expect(areaLabelSize(1000, 480)).toBeGreaterThan(areaLabelSize(300, 160));
    expect(areaLabelSize(60, 40)).toBe(11);
  });
  it("2 行の方が大きく出せるときは、お客さんの画面と同じ所で分ける", () => {
    const l = roomLabel("男子・女子トイレ", 90, 160);
    expect(l.lines).toEqual(["男子", "女子トイレ"]);
  });
  it("どうしても入らないときは、最小の大きさで 1 行にする", () => {
    expect(roomLabel("とても長い名前の会議室", 30, 30)).toEqual({
      lines: ["とても長い名前の会議室"],
      size: 9,
    });
  });
  it("目印・マークの分は、名前に使える高さから引く", () => {
    const free = roomLabel("教室", 200, 60);
    const withMark = roomLabel("教室", 200, 60, { reserved: 40 });
    expect(withMark.size).toBeLessThan(free.size);
  });
});
