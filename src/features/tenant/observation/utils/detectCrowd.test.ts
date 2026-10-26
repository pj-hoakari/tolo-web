import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@pj-hoakari/web-crowd-detection-utils/yolo", () => ({
  createYoloDetector: vi.fn(),
}));
vi.mock("@pj-hoakari/web-crowd-detection-utils/onnx", () => ({
  isWebGpuAvailable: () => false,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("initializeCrowdDetector", () => {
  it("モックでは ONNX 推論器を作らず、ダミーのモデル応答で起動する", async () => {
    vi.stubEnv("NEXT_PUBLIC_CROWD_DETECTION_MOCKING", "enabled");
    const fetch = vi.fn(async () => new Response("mock-model"));
    vi.stubGlobal("fetch", fetch);
    const { initializeCrowdDetector } = await import("./detectCrowd");
    const { createYoloDetector } = await import(
      "@pj-hoakari/web-crowd-detection-utils/yolo"
    );

    const detector = await initializeCrowdDetector();
    expect(await initializeCrowdDetector()).toBe(detector);
    expect(await detector.detect({} as ImageData)).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(createYoloDetector).not.toHaveBeenCalled();
  });

  it("モックでもモデル取得失敗を返し、次の起動で再試行する", async () => {
    vi.stubEnv("NEXT_PUBLIC_CROWD_DETECTION_MOCKING", "enabled");
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response("mock-model"));
    vi.stubGlobal("fetch", fetch);
    const { initializeCrowdDetector, DetectionModelLoadError } = await import(
      "./detectCrowd"
    );

    await expect(initializeCrowdDetector()).rejects.toBeInstanceOf(
      DetectionModelLoadError,
    );
    await expect(initializeCrowdDetector()).resolves.toHaveProperty("detect");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("モックが未設定なら実際の推論器にモデルを渡す", async () => {
    vi.stubEnv("NEXT_PUBLIC_CROWD_DETECTION_MOCKING", undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("real-model")),
    );
    const { createYoloDetector } = await import(
      "@pj-hoakari/web-crowd-detection-utils/yolo"
    );
    const detector = { detect: vi.fn() };
    vi.mocked(createYoloDetector).mockResolvedValue(
      detector as unknown as Awaited<ReturnType<typeof createYoloDetector>>,
    );
    const { initializeCrowdDetector } = await import("./detectCrowd");

    expect(await initializeCrowdDetector()).toBe(detector);
    expect(createYoloDetector).toHaveBeenCalledWith(
      expect.objectContaining({
        modelPath: expect.any(ArrayBuffer),
        executionProvider: "wasm",
      }),
    );
  });
});
