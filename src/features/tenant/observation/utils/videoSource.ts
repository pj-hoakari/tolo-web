export type VideoSourceDescriptor =
  | { readonly kind: "stream"; readonly stream: MediaStream }
  | {
      readonly kind: "objectUrl";
      readonly url: string;
      readonly loop: boolean;
    };

export interface CrowdVideoSource {
  readonly label: string;
  open(): Promise<VideoSourceDescriptor>;
  close(): void;
}

export type CrowdVideoSourceFactory = () => CrowdVideoSource;

export type CameraAccessFailure =
  | "permissionDenied"
  | "notFound"
  | "unsupported"
  | "unavailable";

export class CameraAccessError extends Error {
  constructor(
    readonly reason: CameraAccessFailure,
    options?: ErrorOptions,
  ) {
    super(`Failed to access the camera (${reason})`, options);
    this.name = "CameraAccessError";
  }
}

function cameraAccessFailure(cause: unknown): CameraAccessFailure {
  if (!(cause instanceof DOMException)) return "unavailable";
  switch (cause.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "permissionDenied";
    case "NotFoundError":
      return "notFound";
    case "NotSupportedError":
      return "unsupported";
    default:
      return "unavailable";
  }
}

export function createCameraVideoSource(): CrowdVideoSource {
  let stream: MediaStream | null = null;

  return {
    label: "Camera",
    async open() {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new CameraAccessError("unsupported");
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
      } catch (cause) {
        throw new CameraAccessError(cameraAccessFailure(cause), { cause });
      }
      return { kind: "stream", stream };
    },
    close() {
      for (const track of stream?.getTracks() ?? []) {
        track.stop();
      }
      stream = null;
    },
  };
}

export type VideoFileSourceOptions = {
  loop?: boolean;
};

export function createVideoFileSource(
  file: File,
  options: VideoFileSourceOptions = {},
): CrowdVideoSource {
  const { loop = true } = options;
  let objectUrl: string | null = null;

  return {
    label: `File: ${file.name}`,
    async open() {
      objectUrl = URL.createObjectURL(file);
      return { kind: "objectUrl", url: objectUrl, loop };
    },
    close() {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    },
  };
}
