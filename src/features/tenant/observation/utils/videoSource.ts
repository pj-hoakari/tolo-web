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

export function createCameraVideoSource(): CrowdVideoSource {
  let stream: MediaStream | null = null;

  return {
    label: "Camera",
    async open() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
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
