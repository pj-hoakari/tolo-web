import { describe, expect, it } from "vitest";
import { type CrowdLike, groupCrowdByFloor } from "./groupCrowd";

const format = {
  range: (from: string, to: string) => `${from}〜${to}`,
  join: (parts: string[]) => parts.join("・"),
};
const item = (
  id: string,
  name: string,
  level = "high",
  danger = true,
): CrowdLike => ({ id, name, level, danger });

describe("groupCrowdByFloor", () => {
  it("同じ場所・同じ段階で続いている階は「1F〜6F」にまとめる", () => {
    const items = ["1F", "2F", "3F", "4F", "5F", "6F"].map((f) =>
      item(f, `${f} エレベーター前`),
    );
    const groups = groupCrowdByFloor(items, format);

    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("1F〜6F エレベーター前");
    expect(groups[0].members.map((m) => m.id)).toEqual([
      "1F",
      "2F",
      "3F",
      "4F",
      "5F",
      "6F",
    ]);
  });

  it("段階が違えば分ける（1F〜3F は危険、4F〜6F は中）", () => {
    const items = [
      ...["1F", "2F", "3F"].map((f) => item(f, `${f} エレベーター前`)),
      ...["4F", "5F", "6F"].map((f) =>
        item(f, `${f} エレベーター前`, "mid", false),
      ),
    ];

    expect(groupCrowdByFloor(items, format).map((g) => g.name)).toEqual([
      "1F〜3F エレベーター前",
      "4F〜6F エレベーター前",
    ]);
  });

  it("飛んでいる階は「・」でつなぎ、続く所だけ範囲にする", () => {
    const items = ["1F", "2F", "3F", "5F"].map((f) => item(f, `${f} 階段`));

    expect(groupCrowdByFloor(items, format)[0].name).toBe("1F〜3F・5F 階段");
  });

  it("地下は B1F の次を 1F として続きとみなす", () => {
    const items = ["B1F", "1F"].map((f) => item(f, `${f} 改札`));

    expect(groupCrowdByFloor(items, format)[0].name).toBe("B1F〜1F 改札");
  });

  it("階の無い名前・1 か所だけのものはそのまま", () => {
    const groups = groupCrowdByFloor(
      [item("a", "正面ゲート"), item("b", "6F ホール", "mid", false)],
      format,
    );

    expect(groups.map((g) => g.name)).toEqual(["正面ゲート", "6F ホール"]);
  });

  it("全角の階（「１Ｆ」）も読み取る", () => {
    const items = [item("a", "１Ｆ 階段"), item("b", "２Ｆ 階段")];

    expect(groupCrowdByFloor(items, format)[0].name).toBe("1F〜2F 階段");
  });
});
