import { describe, expect, it } from "vitest";
import { shortFloorNames } from "./editing";

describe("shortFloorNames", () => {
  it("名前の頭の階の番号だけにする", () => {
    expect(shortFloorNames(["1F", "2F", "6Fホール", "B1F 駐車場"])).toEqual([
      "1F",
      "2F",
      "6F",
      "B1F",
    ]);
  });

  it("全角の番号も半角にそろえる", () => {
    expect(shortFloorNames(["６Ｆホール"])).toEqual(["6F"]);
  });

  it("階の番号が無い名前・短くすると同じになる階は、元の名前のまま", () => {
    expect(shortFloorNames(["会場", "6F", "6Fホール"])).toEqual([
      "会場",
      "6F",
      "6Fホール",
    ]);
  });
});
