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
