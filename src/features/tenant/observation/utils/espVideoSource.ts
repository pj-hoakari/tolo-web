import { type Auth, signInWithCustomToken } from "firebase/auth";
import type { DocumentReference, Firestore } from "firebase/firestore";
import { ICE_SERVERS } from "@/features/tenant/webrtc/utils/config";
import {
  getNamedAuth,
  getNamedDb,
} from "@/features/tenant/webrtc/utils/firebase";
import type { FirebaseConfig } from "@/features/tenant/webrtc/utils/firebaseConfig";
import {
  type AssembledJpeg,
  JpegAssembler,
} from "@/features/tenant/webrtc/utils/jpegAssembler";
import { PeerSignalingAdapter } from "@/features/tenant/webrtc/utils/peerSignaling";
import {
  sessionDoc,
  signalsCollection,
} from "@/features/tenant/webrtc/utils/refs";
import {
  clearSession,
  createFirestorePollingSignalingChannel,
} from "@/features/tenant/webrtc/utils/signalingChannel";
import type { CameraConnection } from "@/server/router";
import type { CrowdVideoSource, VideoSourceDescriptor } from "./videoSource";

export type EspCameraSourceOptions = {
  tenantId: string;
  eventId: string;
  edgeDeviceId: string;
  firebaseConfig: FirebaseConfig;
  /**
   * セッションを作り、そのセッションに束縛された Firebase カスタムトークンを
   * 返す。トークンはセッションより先に取得できない。
   */
  requestConnection: () => Promise<CameraConnection>;
  label?: string;
};

const APP_NAME_PREFIX = "esp-camera-console";
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 15_000;
const ANSWER_TIMEOUT_MS = 20_000;
const CONNECT_TIMEOUT_MS = 25_000;
const FRAME_STALL_MS = 12_000;
const DISCONNECT_GRACE_MS = 5_000;

function waitForIceGathering(
  pc: RTCPeerConnection,
  timeoutMs: number,
): Promise<void> {
  if (pc.iceGatheringState === "complete") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", onChange);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") {
        finish();
      }
    };
    const timer = setTimeout(finish, timeoutMs);
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

/**
 * 観測ページを ESP セッションの console 役にして、ESP の `jpeg`
 * DataChannel を MediaStream として取り出す。
 *
 * 管理 UI ↔ 観測ページの経路（onSnapshot）とは別の Firebase アプリを使い、
 * 観測ページ自身の edge サインインと共存させる。シグナリングは ESP と
 * 揃えてポーリングにする。
 *
 * ESP は ACK が 10 秒途絶えると peer を閉じ、こちらも接続が切れたら
 * 新しいセッションを作り直す。canvas / MediaStream は再接続をまたいで
 * 維持するので、観測ページの映像要素と管理UI向け配信はそのまま復帰する。
 */
class EspCameraLink {
  private readonly options: EspCameraSourceOptions;
  private readonly appName: string;

  private auth!: Auth;
  private db!: Firestore;
  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D;
  private stream!: MediaStream;
  private track!: CanvasCaptureMediaStreamTrack;
  private pendingConnection: CameraConnection | null = null;

  private closed = false;
  private generation = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = RECONNECT_BASE_MS;
  private closeCurrent: (() => void) | null = null;

  constructor(options: EspCameraSourceOptions) {
    this.options = options;
    this.appName = `${APP_NAME_PREFIX}:${options.edgeDeviceId}`;
  }

  async open(): Promise<VideoSourceDescriptor> {
    this.auth = getNamedAuth(this.options.firebaseConfig, this.appName);
    this.db = getNamedDb(this.options.firebaseConfig, this.appName);

    // カスタムトークンはセッションに束縛されるため、セッションを作ってから
    // 取得してサインインする。ここで失敗したら open の失敗として扱い、
    // ほかのカメラの映像には影響させない。
    const connection = await this.options.requestConnection();
    if (this.closed) {
      throw new Error("ESP カメラの接続が中止されました");
    }
    await signInWithCustomToken(this.auth, connection.firestoreToken);
    if (this.closed) {
      throw new Error("ESP カメラの接続が中止されました");
    }
    this.pendingConnection = connection;

    this.canvas = document.createElement("canvas");
    const context = this.canvas.getContext("2d");
    if (!context) {
      throw new Error("ESP カメラ用の canvas を初期化できませんでした");
    }
    this.context = context;

    this.stream = this.canvas.captureStream(0);
    const track = this.stream.getVideoTracks()[0] as
      | CanvasCaptureMediaStreamTrack
      | undefined;
    if (!track || typeof track.requestFrame !== "function") {
      for (const t of this.stream.getTracks()) t.stop();
      throw new Error(
        "このブラウザは canvas の手動フレーム送出に対応していません",
      );
    }
    this.track = track;

    void this.connect();
    return { kind: "stream", stream: this.stream };
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.generation += 1;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.closeCurrent?.();
    this.closeCurrent = null;
    for (const track of this.stream?.getTracks() ?? []) {
      track.stop();
    }
    this.pendingConnection = null;
  }

  private scheduleReconnect(): void {
    if (this.closed) {
      return;
    }
    const delay = this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, RECONNECT_MAX_MS);
    console.info(`[esp-camera] reconnect in ${delay} ms`);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }

  private async connect(): Promise<void> {
    if (this.closed) {
      return;
    }
    const generation = ++this.generation;

    let sessionRef: DocumentReference | null = null;
    let pc: RTCPeerConnection | null = null;
    let unsubscribe: (() => void) | null = null;
    let jpegChannel: RTCDataChannel | null = null;
    let answerTimer: ReturnType<typeof setTimeout> | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;
    let frameTimer: ReturnType<typeof setInterval> | null = null;
    let disconnectedTimer: ReturnType<typeof setTimeout> | null = null;
    let sessionActive = true;
    let lastFrameAt = performance.now();
    let decoding = false;
    let pending: AssembledJpeg | null = null;
    let finished = false;

    let cancel: (() => void) | null = null;
    const finish = (retry: boolean) => {
      if (finished) {
        return;
      }
      finished = true;
      sessionActive = false;
      if (answerTimer !== null) clearTimeout(answerTimer);
      if (connectTimer !== null) clearTimeout(connectTimer);
      if (frameTimer !== null) clearInterval(frameTimer);
      if (disconnectedTimer !== null) clearTimeout(disconnectedTimer);
      answerTimer = null;
      connectTimer = null;
      frameTimer = null;
      disconnectedTimer = null;
      unsubscribe?.();
      unsubscribe = null;
      jpegChannel?.close();
      jpegChannel = null;
      pc?.close();
      pc = null;
      if (sessionRef) {
        void clearSession(sessionRef).catch((error) =>
          console.error("[esp-camera] セッションの削除に失敗しました", error),
        );
        sessionRef = null;
      }
      if (cancel && this.closeCurrent === cancel) {
        this.closeCurrent = null;
      }
      if (this.closed || generation !== this.generation) {
        return;
      }
      if (retry) {
        this.scheduleReconnect();
      }
    };
    cancel = () => finish(false);
    this.closeCurrent = cancel;

    const draw = async (frame: AssembledJpeg): Promise<void> => {
      if (!sessionActive) {
        return;
      }
      decoding = true;
      try {
        const bitmap = await createImageBitmap(
          new Blob([frame.bytes], { type: "image/jpeg" }),
        );
        try {
          if (!sessionActive) {
            return;
          }
          if (
            this.canvas.width !== bitmap.width ||
            this.canvas.height !== bitmap.height
          ) {
            this.canvas.width = bitmap.width;
            this.canvas.height = bitmap.height;
          }
          this.context.drawImage(bitmap, 0, 0);
          this.track.requestFrame();
          lastFrameAt = performance.now();
          if (jpegChannel?.readyState === "open") {
            jpegChannel.send(`ACK:${frame.id}`);
          }
        } finally {
          bitmap.close();
        }
      } catch (error) {
        console.error("[esp-camera] JPEG の描画に失敗しました", error);
      } finally {
        decoding = false;
        const next = pending;
        pending = null;
        if (next && sessionActive) {
          void draw(next);
        }
      }
    };

    try {
      const pendingConnection = this.pendingConnection;
      const connection =
        pendingConnection ?? (await this.options.requestConnection());
      this.pendingConnection = null;
      if (this.closed || generation !== this.generation) {
        cancel();
        return;
      }
      if (!pendingConnection) {
        await signInWithCustomToken(this.auth, connection.firestoreToken);
        if (this.closed || generation !== this.generation) {
          cancel();
          return;
        }
      }

      const { sessionId } = connection;
      sessionRef = sessionDoc(
        this.db,
        this.options.tenantId,
        this.options.eventId,
        this.options.edgeDeviceId,
        sessionId,
      );
      const channel = createFirestorePollingSignalingChannel({
        signalsRef: signalsCollection(sessionRef),
        self: "console",
      });
      const adapter = new PeerSignalingAdapter(channel.send);
      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc = peer;
      const assembler = new JpegAssembler();

      // SCTP を交渉するためのダミーチャネル。ESP は接続後に `jpeg` を作る。
      peer.createDataChannel("control");

      peer.addEventListener("datachannel", (event) => {
        const incoming = event.channel;
        if (incoming.label !== "jpeg") {
          return;
        }
        incoming.binaryType = "arraybuffer";
        jpegChannel = incoming;
        incoming.addEventListener("message", (message) => {
          if (!sessionActive || !(message.data instanceof ArrayBuffer)) {
            return;
          }
          const frame = assembler.push(message.data);
          if (!frame) {
            return;
          }
          if (decoding) {
            pending = frame;
          } else {
            void draw(frame);
          }
        });
      });

      peer.addEventListener("connectionstatechange", () => {
        if (!sessionActive) {
          return;
        }
        switch (peer.connectionState) {
          case "connected":
            this.retryDelay = RECONNECT_BASE_MS;
            lastFrameAt = performance.now();
            if (answerTimer !== null) {
              clearTimeout(answerTimer);
              answerTimer = null;
            }
            if (connectTimer !== null) {
              clearTimeout(connectTimer);
              connectTimer = null;
            }
            if (disconnectedTimer !== null) {
              clearTimeout(disconnectedTimer);
              disconnectedTimer = null;
            }
            break;
          case "failed":
          case "closed":
            console.warn(
              "[esp-camera] peer connection closed; reconnecting",
              peer.connectionState,
            );
            finish(true);
            break;
          case "disconnected":
            if (disconnectedTimer !== null) {
              clearTimeout(disconnectedTimer);
            }
            disconnectedTimer = setTimeout(() => {
              disconnectedTimer = null;
              if (sessionActive && peer.connectionState !== "connected") {
                finish(true);
              }
            }, DISCONNECT_GRACE_MS);
            break;
          default:
            break;
        }
      });

      unsubscribe = channel.listen((message) => adapter.deliver(message));
      adapter.onDescription(async (description) => {
        if (!sessionActive) {
          return;
        }
        if (
          description.type !== "answer" ||
          peer.signalingState !== "have-local-offer"
        ) {
          return;
        }
        try {
          await peer.setRemoteDescription(description);
          if (answerTimer !== null) {
            clearTimeout(answerTimer);
            answerTimer = null;
          }
        } catch (error) {
          console.error("[esp-camera] SDP answer の適用に失敗しました", error);
          finish(true);
        }
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      // ESP は non-trickle で answer を返すため、候補を集めてから 1 回だけ書く。
      await waitForIceGathering(peer, 15_000);
      if (!sessionActive || this.closed || generation !== this.generation) {
        cancel();
        return;
      }
      if (!peer.localDescription) {
        throw new Error("SDP offer を作成できませんでした");
      }
      channel.send({
        kind: "description",
        description: peer.localDescription,
      });
      answerTimer = setTimeout(() => {
        answerTimer = null;
        if (sessionActive) {
          console.warn("[esp-camera] answer timeout; reconnecting");
          finish(true);
        }
      }, ANSWER_TIMEOUT_MS);
      connectTimer = setTimeout(() => {
        connectTimer = null;
        if (sessionActive && peer.connectionState !== "connected") {
          console.warn("[esp-camera] connection timeout; reconnecting");
          finish(true);
        }
      }, CONNECT_TIMEOUT_MS);
      frameTimer = setInterval(() => {
        if (!sessionActive) {
          return;
        }
        if (
          peer.connectionState === "connected" &&
          performance.now() - lastFrameAt > FRAME_STALL_MS
        ) {
          console.warn("[esp-camera] no frames; reconnecting");
          finish(true);
        }
      }, 2_000);
    } catch (error) {
      console.error("[esp-camera] セッションの確立に失敗しました", error);
      finish(true);
    }
  }
}

export function createEspCameraVideoSource(
  options: EspCameraSourceOptions,
): CrowdVideoSource {
  const link = new EspCameraLink(options);

  return {
    label: options.label ?? `ESP (${options.edgeDeviceId})`,
    open(): Promise<VideoSourceDescriptor> {
      return link.open();
    },
    close() {
      link.close();
    },
  };
}
