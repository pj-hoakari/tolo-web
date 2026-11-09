import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectWebSerialAvailability,
  SerialPortClosedError,
  WebSerialTransport,
} from "./transport";

class FakeSerialPort {
  readable: ReadableStream<Uint8Array> | null = null;
  writable: WritableStream<Uint8Array> | null = null;
  readonly opens: number[] = [];
  readonly lines: string[] = [];
  closes = 0;
  failOpen: Error | null = null;
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;

  async open({ baudRate }: { baudRate: number }): Promise<void> {
    if (this.failOpen) throw this.failOpen;
    this.opens.push(baudRate);
    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
      },
      cancel: () => {
        this.controller = null;
      },
    });
    this.writable = new WritableStream<Uint8Array>({
      write: (chunk) => {
        this.lines.push(new TextDecoder().decode(chunk));
      },
    });
  }

  async close(): Promise<void> {
    this.closes += 1;
    const controller = this.controller;
    this.controller = null;
    try {
      controller?.close();
    } catch {
      // The stream may already be errored after a device disconnect.
    }
    this.readable = null;
    this.writable = null;
  }

  push(line: string): void {
    this.controller?.enqueue(new TextEncoder().encode(`${line}\n`));
  }

  disconnect(): void {
    const controller = this.controller;
    this.controller = null;
    try {
      controller?.error(new Error("device disconnected"));
    } catch {
      // The stream may already be closed.
    }
    this.readable = null;
    this.writable = null;
  }
}

function transportWith(port: FakeSerialPort): WebSerialTransport {
  vi.stubGlobal("navigator", {
    serial: { requestPort: async () => port },
  });
  return new WebSerialTransport();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebSerialTransport", () => {
  it("reopens the selected port after the device re-enumerates", async () => {
    const port = new FakeSerialPort();
    const transport = transportWith(port);
    await transport.selectPort();
    await transport.open({ baudRate: 115_200 });
    expect(transport.isOpen()).toBe(true);

    port.disconnect();
    await expect(transport.readLine()).rejects.toBeInstanceOf(
      SerialPortClosedError,
    );
    expect(transport.isOpen()).toBe(false);

    await transport.reopen({ baudRate: 115_200 });
    expect(transport.isOpen()).toBe(true);
    expect(port.opens).toEqual([115_200, 115_200]);

    port.push('{"type":"device_authorization","user_code":"ABCD-EFGH"}');
    await expect(transport.readLine()).resolves.toContain(
      "device_authorization",
    );

    await transport.close();
    expect(transport.isOpen()).toBe(false);
  });

  it("raises a typed error when the selected port cannot be reopened", async () => {
    const port = new FakeSerialPort();
    const transport = transportWith(port);
    await transport.selectPort();
    await transport.open({ baudRate: 115_200 });

    port.failOpen = new Error("The device is not available");
    await expect(
      transport.reopen({ baudRate: 115_200 }),
    ).rejects.toBeInstanceOf(SerialPortClosedError);
    expect(transport.isOpen()).toBe(false);
  });

  it("keeps the selected port after closing so it can be reopened", async () => {
    const port = new FakeSerialPort();
    const transport = transportWith(port);
    await transport.selectPort();
    await transport.open({ baudRate: 115_200 });
    await transport.close();

    await transport.reopen({ baudRate: 115_200 });
    expect(transport.isOpen()).toBe(true);
    expect(port.opens).toEqual([115_200, 115_200]);
  });
});

describe("detectWebSerialAvailability", () => {
  it("reports unsupported when the browser has no Web Serial API", () => {
    expect(
      detectWebSerialAvailability({ serial: undefined, isSecureContext: true }),
    ).toBe("unsupported");
  });

  it("reports insecure when Web Serial exists outside a secure context", () => {
    expect(
      detectWebSerialAvailability({ serial: {}, isSecureContext: false }),
    ).toBe("insecure");
  });

  it("reports available when Web Serial exists in a secure context", () => {
    expect(
      detectWebSerialAvailability({ serial: {}, isSecureContext: true }),
    ).toBe("available");
  });
});
