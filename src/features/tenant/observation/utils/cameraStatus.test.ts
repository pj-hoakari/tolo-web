import { describe, expect, it } from "vitest";
import messages from "../../../../../messages/ja.json";
import { resolveCameraStatusKey } from "./cameraStatus";

const label = (key: keyof typeof messages.Observation.cameraStatus) =>
  messages.Observation.cameraStatus[key];

describe("resolveCameraStatusKey", () => {
  it.each([
    ["capturing", "撮影中"],
    ["inferring", "検出中"],
    ["ready", "検出中"],
    ["waiting", "待機中"],
    ["stale", "映像が届いていません"],
    ["error", "エラー"],
  ] as const)("%s は %s と表示する", (phase, expected) => {
    expect(label(resolveCameraStatusKey({ phase }))).toBe(expected);
  });

  it("フェーズがまだないときは待機中にする", () => {
    expect(label(resolveCameraStatusKey({}))).toBe("待機中");
  });

  it("映像が届いていないときは撮影中より stale を優先する", () => {
    expect(
      label(resolveCameraStatusKey({ phase: "capturing", stale: true })),
    ).toBe("映像が届いていません");
  });

  it("エラーがあるときは他の状態よりエラーを優先する", () => {
    expect(
      label(resolveCameraStatusKey({ phase: "inferring", hasError: true })),
    ).toBe("エラー");
  });
});
