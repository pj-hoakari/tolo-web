import { describe, expect, it } from "vitest";
import { SerialMessageChannel } from "./channel";
import { SerialPortClosedError, type SerialTransport } from "./transport";

class ScriptedTransport implements SerialTransport {
  readonly lines: (string | Error)[] = [];

  isAvailable(): boolean {
    return true;
  }

  async selectPort(): Promise<void> {}

  async open(): Promise<void> {}

  async reopen(): Promise<void> {}

  isOpen(): boolean {
    return true;
  }

  async writeLine(): Promise<void> {}

  readLine(): Promise<string> {
    const next = this.lines.shift();
    if (next === undefined) return new Promise(() => {});
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  }

  async close(): Promise<void> {}
}

const deviceAuthorization = JSON.stringify({
  type: "device_authorization",
  user_code: "ABCD-EFGH",
  verification_uri: "https://idp.example/device",
  expires_in: 600,
});

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("SerialMessageChannel", () => {
  it("resets the failure and reads again after restart", async () => {
    const transport = new ScriptedTransport();
    transport.lines.push(new SerialPortClosedError());
    const channel = new SerialMessageChannel(transport);
    channel.start();

    await expect(channel.next(50)).rejects.toBeInstanceOf(
      SerialPortClosedError,
    );

    transport.lines.push(deviceAuthorization);
    channel.restart();

    await expect(channel.next(50)).resolves.toMatchObject({
      type: "device_authorization",
      user_code: "ABCD-EFGH",
    });
  });

  it("keeps a message that arrived before the read failure", async () => {
    const transport = new ScriptedTransport();
    transport.lines.push(deviceAuthorization, new SerialPortClosedError());
    const channel = new SerialMessageChannel(transport);
    channel.start();
    await tick();

    await expect(channel.next(50)).resolves.toMatchObject({
      type: "device_authorization",
    });
    await expect(channel.next(50)).rejects.toBeInstanceOf(
      SerialPortClosedError,
    );
  });
});
