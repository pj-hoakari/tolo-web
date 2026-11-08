import { type DeviceMessage, parseDeviceMessage } from "./protocol";
import type { SerialTransport } from "./transport";

export class ProvisioningTimeoutError extends Error {
  constructor() {
    super("Timed out waiting for the camera");
    this.name = "ProvisioningTimeoutError";
  }
}

export class ProvisioningStoppedError extends Error {
  constructor() {
    super("Provisioning was stopped");
    this.name = "ProvisioningStoppedError";
  }
}

type Waiter = {
  resolve: (message: DeviceMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class SerialMessageChannel {
  private readonly queue: DeviceMessage[] = [];
  private readonly waiters = new Set<Waiter>();
  private stopped = false;
  private failure: Error | null = null;
  private generation = 0;

  constructor(private readonly transport: SerialTransport) {}

  start(): void {
    this.stopped = false;
    this.failure = null;
    this.beginRead();
  }

  restart(): void {
    this.stopped = false;
    this.failure = null;
    this.beginRead();
  }

  next(timeoutMs: number): Promise<DeviceMessage> {
    const queued = this.queue.shift();
    if (queued) return Promise.resolve(queued);
    if (this.stopped) return Promise.reject(new ProvisioningStoppedError());
    if (this.failure) return Promise.reject(this.failure);

    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters.delete(waiter);
          reject(new ProvisioningTimeoutError());
        }, timeoutMs),
      };
      this.waiters.add(waiter);
    });
  }

  stop(): void {
    this.stopped = true;
    this.generation += 1;
    this.rejectWaiters(new ProvisioningStoppedError());
  }

  private beginRead(): void {
    const generation = ++this.generation;
    void this.readLoop(generation);
  }

  private async readLoop(generation: number): Promise<void> {
    while (!this.stopped && generation === this.generation) {
      let line: string;
      try {
        line = await this.transport.readLine();
      } catch (error) {
        if (!this.stopped && generation === this.generation) {
          this.fail(
            error instanceof Error
              ? error
              : new Error("Failed to read from the serial port"),
          );
        }
        return;
      }
      if (this.stopped || generation !== this.generation) return;
      const message = parseDeviceMessage(line);
      if (message) this.push(message);
    }
  }

  private push(message: DeviceMessage): void {
    const waiter = this.waiters.values().next().value as Waiter | undefined;
    if (waiter) {
      clearTimeout(waiter.timer);
      this.waiters.delete(waiter);
      waiter.resolve(message);
      return;
    }
    this.queue.push(message);
  }

  private fail(error: Error): void {
    this.failure = error;
    this.rejectWaiters(error);
  }

  private rejectWaiters(error: Error): void {
    const waiters = [...this.waiters];
    this.waiters.clear();
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }
}
