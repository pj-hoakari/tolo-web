// 英語の訳（i18nEn.ts）の抜けと、使っていない訳が無いかを確かめる（スタジオのフォルダの中だけを見る）
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { EN } from "./i18nEn";

const root = __dirname;
const files = (dir: string): string[] =>
  fs
    .readdirSync(path.join(root, dir), { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : /\.tsx?$/.test(e.name)
          ? [path.join(dir, e.name)]
          : [],
    );
const sources = files(".").filter(
  (f) => !f.endsWith("i18nEn.ts") && !/\.test\.tsx?$/.test(f),
);
const code = sources
  .map((f) => fs.readFileSync(path.join(root, f), "utf8"))
  .join("\n");

describe("英語の訳", () => {
  it('t("…") で使う文字には、すべて訳がある', () => {
    const used = [...code.matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)].map(
      (m) => JSON.parse(`"${m[1]}"`) as string,
    );
    expect(used.filter((k) => !(k in EN))).toEqual([]);
  });
  it("使っていない訳が無い", () => {
    const quoted = (k: string) =>
      code.includes(JSON.stringify(k)) || code.includes(`"${k}"`);
    expect(Object.keys(EN).filter((k) => !quoted(k))).toEqual([]);
  });
});
