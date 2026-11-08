// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { onSnapshot } from "firebase/firestore";
import { afterEach, expect, it, vi } from "vitest";
import {
  encodeDetectionControlRequest,
  parseDetectionControlNotice,
} from "@/features/tenant/webrtc/utils/detectionControl";
import { connectAsSender } from "@/features/tenant/webrtc/utils/webrtcSender";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { CrowdDetection } from "./CrowdDetection";

const mocks = vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_API_MOCKING", "disabled");
  return {
    config: { projectId: "project", apiKey: "key" },
    stream: {} as MediaStream,
    sourceStates: [] as { key: string; status: "error"; error: string }[],
    retryCamera: vi.fn(),
    retryList: vi.fn(),
    listFailed: false,
    refreshedList: false,
    videoSources: new Map([
      ["one", {}],
      ["two", {}],
    ]),
    continuousKey: undefined as string | null | undefined,
  };
});
vi.mock("firebase/firestore", () => ({ onSnapshot: vi.fn() }));
vi.mock("@/lib/orpc", () => ({ orpc: {} }));
vi.mock("@/features/tenant/webrtc/components/FirebaseConfigProvider", () => ({
  useFirebaseConfig: () => mocks.config,
}));
vi.mock("@/features/tenant/webrtc/utils/firebase", () => ({
  getDb: vi.fn(),
  getAuth: vi.fn(),
}));
vi.mock("@/features/tenant/webrtc/utils/firestoreSignIn", () => ({
  signInForSignaling: vi.fn(async () => vi.fn()),
}));
vi.mock("@/features/tenant/webrtc/utils/refs", () => ({
  sessionDoc: vi.fn(),
  sessionsCollection: vi.fn(),
  signalsCollection: vi.fn(),
}));
vi.mock("@/features/tenant/webrtc/utils/signalingChannel", () => ({
  createFirestoreSignalingChannel: () => ({
    send: vi.fn(),
    listen: () => vi.fn(),
  }),
}));
vi.mock("@/features/tenant/webrtc/utils/webrtcSender", () => ({
  connectAsSender: vi.fn(),
}));
vi.mock("../hooks/useObservationPageCameras", () => ({
  useObservationPageCameras: () => ({
    cameras: mocks.listFailed
      ? []
      : mocks.refreshedList
        ? [...cameras]
        : cameras,
    initialCameraId: "one",
    status: mocks.listFailed ? "error" : "ready",
    cameraConnectionError: null,
    retry: mocks.retryList,
  }),
}));
vi.mock("../hooks/useEspCameraAutoStart", () => ({
  useEspCameraAutoStart: vi.fn(),
}));
vi.mock("../hooks/useCrowdVideoSources", async () => {
  const { useState } = await import("react");
  return {
    useCrowdVideoSources: () => {
      const [selectedKey, selectSource] = useState("one");
      return {
        selectedKey,
        selectSource,
        status: "detecting",
        sourceStates: mocks.sourceStates,
        retryCamera: mocks.retryCamera,
        freshness: new Map(),
        videoSources: mocks.videoSources,
        reportSourceError: vi.fn(),
      };
    },
  };
});
vi.mock("../hooks/useMultiCameraDetectionLoop", async () => {
  const { useEffect } = await import("react");
  return {
    useMultiCameraDetectionLoop: ({
      onBroadcastStreamChange,
      continuousKey,
    }: {
      onBroadcastStreamChange: (stream: MediaStream) => void;
      continuousKey: string | null;
    }) => {
      mocks.continuousKey = continuousKey;
      useEffect(
        () => onBroadcastStreamChange(mocks.stream),
        [onBroadcastStreamChange],
      );
    },
  };
});
vi.mock("../hooks/useObservationReporting", () => ({
  useObservationReporting: () => ({ unregistered: false }),
}));
vi.mock("./ObservationSoftLock", () => ({ ObservationLockButton: () => null }));
vi.mock("./CameraConnectionAuthorizationNotice", () => ({
  CameraConnectionAuthorizationNotice: () => null,
}));
vi.mock("./CrowdDetectionView", () => ({ CrowdDetectionView: () => null }));
vi.mock("@/features/tenant/detection/components/DetectionLineActions", () => ({
  DetectionLineCreationModeToggle: () => null,
}));
vi.mock("@/features/tenant/webrtc/components/BroadcastIndicator", () => ({
  BroadcastIndicator: () => null,
}));
const cameras = [
  { edgeDeviceId: "one", name: "Camera one" },
  { edgeDeviceId: "two", name: "Camera two" },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.sourceStates = [];
  mocks.listFailed = false;
  mocks.refreshedList = false;
  window.localStorage.clear();
});

it("does not offer the local camera when the camera list fails", () => {
  mocks.listFailed = true;
  render(
    <CrowdDetection
      canReport={false}
      tenantId="tenant"
      eventId="event"
      edgeDeviceId="page"
    />,
    { wrapper: IntlTestProvider },
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "映像ソースの取得に失敗しました",
  );
  fireEvent.click(screen.getByRole("button", { name: "再接続" }));
  expect(mocks.retryList).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: "カメラを起動" })).toBeNull();
});

it("sends and receives settings for the selected ESP camera across tab switches", async () => {
  const channels: (EventTarget & {
    readyState: string;
    send: ReturnType<typeof vi.fn>;
  })[] = [];
  vi.mocked(connectAsSender).mockImplementation(() => {
    const controlChannel = Object.assign(new EventTarget(), {
      readyState: "open",
      send: vi.fn(),
    });
    channels.push(controlChannel);
    return {
      pc: { close: vi.fn(), getSenders: () => [] },
      dataChannel: new EventTarget(),
      controlChannel,
    } as unknown as ReturnType<typeof connectAsSender>;
  });
  vi.mocked(onSnapshot).mockImplementation(((
    _ref: unknown,
    callback: (snapshot: unknown) => void,
  ) => {
    callback({
      docChanges: () => [
        {
          type: "added",
          doc: { id: "session", data: () => ({ status: "requested" }) },
        },
      ],
    });
    return vi.fn();
  }) as unknown as typeof onSnapshot);
  const { rerender } = render(
    <CrowdDetection
      canReport
      tenantId="tenant"
      eventId="event"
      edgeDeviceId="page"
    />,
    { wrapper: IntlTestProvider },
  );
  await waitFor(() => expect(channels).toHaveLength(1));
  const read = (channel: (typeof channels)[number]) => {
    act(() => channel.dispatchEvent(new Event("open")));
    return parseDetectionControlNotice(channel.send.mock.lastCall?.[0])
      ?.settings;
  };
  const first = read(channels[0]);
  expect(first).toBeDefined();
  if (!first) throw new Error("Missing first camera settings");
  act(() =>
    channels[0].dispatchEvent(
      new MessageEvent("message", {
        data: encodeDetectionControlRequest({
          ...first,
          confidenceThreshold: 0.7,
        }),
      }),
    ),
  );
  expect(read(channels[0])?.confidenceThreshold).toBe(0.7);
  mocks.refreshedList = true;
  rerender(
    <CrowdDetection
      canReport
      tenantId="tenant"
      eventId="event"
      edgeDeviceId="page"
    />,
  );
  expect(read(channels[0])?.confidenceThreshold).toBe(0.7);
  fireEvent.click(screen.getByRole("tab", { name: /Camera two/ }));
  await waitFor(() => expect(channels).toHaveLength(2));
  const second = read(channels[1]);
  if (!second) throw new Error("Missing second camera settings");
  expect(second?.confidenceThreshold).toBe(first?.confidenceThreshold);
  act(() =>
    channels[1].dispatchEvent(
      new MessageEvent("message", {
        data: encodeDetectionControlRequest({
          ...second,
          confidenceThreshold: 0.4,
        }),
      }),
    ),
  );
  expect(read(channels[1])?.confidenceThreshold).toBe(0.4);
  fireEvent.click(screen.getByRole("tab", { name: /Camera one/ }));
  await waitFor(() => expect(channels).toHaveLength(3));
  expect(read(channels[2])?.confidenceThreshold).toBe(0.7);
});

it("offers a per-camera reconnect button while the other camera is detecting", () => {
  mocks.sourceStates = [{ key: "two", status: "error", error: "offline" }];
  render(
    <CrowdDetection
      canReport={false}
      tenantId="tenant"
      eventId="event"
      edgeDeviceId="page"
    />,
    { wrapper: IntlTestProvider },
  );
  fireEvent.click(screen.getByRole("button", { name: "Camera two に再接続" }));
  expect(mocks.retryCamera).toHaveBeenCalledExactlyOnceWith("two");
  expect(
    screen
      .getByRole("tab", { name: /Camera one/ })
      .getAttribute("aria-selected"),
  ).toBe("true");
});

it("persists the per-camera observation mode and reconnects that camera", () => {
  window.localStorage.setItem("tolo:observation-mode:two", "continuous");
  render(
    <CrowdDetection
      canReport={false}
      tenantId="tenant"
      eventId="event"
      edgeDeviceId="page"
    />,
    { wrapper: IntlTestProvider },
  );
  expect(mocks.continuousKey).toBe("two");
  expect(
    screen
      .getByRole("radio", { name: "バースト観測" })
      .getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("radio", { name: "連続観測" }));
  expect(window.localStorage.getItem("tolo:observation-mode:one")).toBe(
    "continuous",
  );
  expect(mocks.retryCamera).toHaveBeenCalledExactlyOnceWith("one");
  expect(mocks.continuousKey).toBe("one");
});
