import { describe, expect, it, vi } from "vitest";
import {
  type DetectionSettings,
  INITIAL_SETTINGS,
} from "@/features/tenant/detection/stores/detectionStore";
import {
  encodeDetectionControlNotice,
  encodeDetectionControlRequest,
  parseDetectionControlNotice,
  parseDetectionControlRequest,
  sendOverDataChannel,
} from "./detectionControl";

const settings: DetectionSettings = {
  ...INITIAL_SETTINGS,
  confidenceThreshold: 0.3,
};

describe("検出設定メッセージ", () => {
  it("通知は往復しても同じ設定になる", () => {
    expect(
      parseDetectionControlNotice(encodeDetectionControlNotice(settings)),
    ).toEqual({ type: "settings", settings });
  });

  it("変更要求は往復しても同じ設定になる", () => {
    expect(
      parseDetectionControlRequest(encodeDetectionControlRequest(settings)),
    ).toEqual({ type: "update-settings", settings });
  });

  it("種別が違うメッセージは受け取らない", () => {
    const notice = encodeDetectionControlNotice(settings);

    expect(parseDetectionControlRequest(notice)).toBeNull();
    expect(
      parseDetectionControlNotice(encodeDetectionControlRequest(settings)),
    ).toBeNull();
  });

  it("JSON として壊れていても例外にしない", () => {
    expect(parseDetectionControlNotice("{")).toBeNull();
    expect(parseDetectionControlRequest("null")).toBeNull();
  });

  it("設定の形が合わないものは弾く", () => {
    const broken = JSON.stringify({
      type: "update-settings",
      settings: { confidenceThreshold: 0.3 },
    });

    expect(parseDetectionControlRequest(broken)).toBeNull();
  });
});

describe("sendOverDataChannel", () => {
  it("open のときだけ送る", () => {
    const send = vi.fn();

    sendOverDataChannel(null, "x");
    sendOverDataChannel(
      { readyState: "connecting", send } as unknown as RTCDataChannel,
      "x",
    );
    expect(send).not.toHaveBeenCalled();

    sendOverDataChannel(
      { readyState: "open", send } as unknown as RTCDataChannel,
      "x",
    );
    expect(send).toHaveBeenCalledWith("x");
  });
});
