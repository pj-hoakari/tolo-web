let ready: Promise<unknown> | undefined;

export function setBrowserMockingReady(promise: Promise<unknown>): void {
  ready = promise;
}

export function browserMockingReady(): Promise<unknown> | undefined {
  return ready;
}
