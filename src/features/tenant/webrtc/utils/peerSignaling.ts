import type { SignalMessage } from "./signalingChannel";

type DescriptionHandler = (
  description: RTCSessionDescriptionInit,
) => void | Promise<void>;
type CandidateHandler = (
  candidate: RTCIceCandidateInit | null,
) => void | Promise<void>;

export interface PeerSignaling {
  sendDescription(description: RTCSessionDescriptionInit): void;
  sendCandidate(candidate: RTCIceCandidateInit | null): void;
  onDescription(handler: DescriptionHandler): void;
  onCandidate(handler: CandidateHandler): void;
}

export class PeerSignalingAdapter implements PeerSignaling {
  private readonly send: (message: SignalMessage) => void;
  private descriptionHandler: DescriptionHandler | null = null;
  private candidateHandler: CandidateHandler | null = null;
  private readonly queue: SignalMessage[] = [];
  private draining = false;
  private pending = false;

  constructor(send: (message: SignalMessage) => void) {
    this.send = send;
  }

  sendDescription(description: RTCSessionDescriptionInit): void {
    this.send({ kind: "description", description });
  }

  sendCandidate(candidate: RTCIceCandidateInit | null): void {
    this.send({ kind: "candidate", candidate });
  }

  onDescription(handler: DescriptionHandler): void {
    this.descriptionHandler = handler;
    void this.drain();
  }

  onCandidate(handler: CandidateHandler): void {
    this.candidateHandler = handler;
    void this.drain();
  }

  deliver(message: SignalMessage): void {
    this.queue.push(message);
    void this.drain();
  }

  private async drain(): Promise<void> {
    this.pending = true;
    if (this.draining) {
      return;
    }
    this.draining = true;
    try {
      while (this.pending) {
        this.pending = false;
        while (this.queue.length > 0) {
          const handled = await this.dispatch(this.queue[0]);
          if (!handled) {
            break;
          }
          this.queue.shift();
        }
      }
    } finally {
      this.draining = false;
    }
  }

  private async dispatch(message: SignalMessage): Promise<boolean> {
    if (message.kind === "description") {
      const handler = this.descriptionHandler;
      if (!handler) {
        return false;
      }
      await handler(message.description);
      return true;
    }
    const handler = this.candidateHandler;
    if (!handler) {
      return false;
    }
    await handler(message.candidate);
    return true;
  }
}
