export interface SerialTransport {
  isAvailable(): boolean;
  selectPort(): Promise<void>;
  open(options: { baudRate: number }): Promise<void>;
  reopen(options: { baudRate: number }): Promise<void>;
  isOpen(): boolean;
  writeLine(line: string): Promise<void>;
  readLine(): Promise<string>;
  close(): Promise<void>;
}

export class SerialPortClosedError extends Error {
  constructor(
    message = "The serial port was closed",
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SerialPortClosedError";
  }
}

type SerialPortLike = {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
};

type SerialApiLike = {
  requestPort(): Promise<SerialPortLike>;
};

export type SerialAvailability = "available" | "unsupported" | "insecure";

type AvailabilitySource = {
  serial?: unknown;
  isSecureContext?: boolean;
};

function serialApi(source?: AvailabilitySource): SerialApiLike | undefined {
  const serial =
    source !== undefined
      ? source.serial
      : typeof navigator !== "undefined"
        ? (navigator as Navigator & { serial?: unknown }).serial
        : undefined;
  return serial ? (serial as SerialApiLike) : undefined;
}

export function detectWebSerialAvailability(
  source?: AvailabilitySource,
): SerialAvailability {
  if (!serialApi(source)) return "unsupported";
  const secure =
    source?.isSecureContext ??
    (typeof window !== "undefined" ? window.isSecureContext : false);
  return secure ? "available" : "insecure";
}

export class WebSerialTransport implements SerialTransport {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private readonly decoder = new TextDecoder();
  private buffer = "";
  private openState = false;

  isAvailable(): boolean {
    return serialApi() !== undefined;
  }

  isOpen(): boolean {
    return (
      this.openState &&
      this.port?.readable != null &&
      this.port?.writable != null
    );
  }

  async selectPort(): Promise<void> {
    const serial = serialApi();
    if (!serial) {
      throw new Error("Web Serial is not available");
    }
    this.port = await serial.requestPort();
    this.buffer = "";
  }

  async open({ baudRate }: { baudRate: number }): Promise<void> {
    if (!this.port) {
      throw new Error("No serial port has been selected");
    }
    await this.releaseReader();
    this.buffer = "";
    await this.port.open({ baudRate });
    if (!this.port.readable || !this.port.writable) {
      this.openState = false;
      throw new Error("The serial port is not readable");
    }
    this.reader = this.port.readable.getReader();
    this.openState = true;
  }

  async reopen({ baudRate }: { baudRate: number }): Promise<void> {
    const port = this.port;
    if (!port) {
      throw new SerialPortClosedError("No serial port has been selected");
    }
    await this.releaseReader();
    this.buffer = "";
    this.openState = false;
    try {
      await port.close();
    } catch {
      // The device may have already closed the port while rebooting.
    }
    try {
      await port.open({ baudRate });
    } catch (error) {
      throw new SerialPortClosedError("The serial port could not be reopened", {
        cause: error,
      });
    }
    if (!port.readable || !port.writable) {
      throw new SerialPortClosedError("The serial port is not readable");
    }
    this.reader = port.readable.getReader();
    this.openState = true;
  }

  async writeLine(line: string): Promise<void> {
    const writable = this.port?.writable;
    if (!writable) {
      throw new Error("The serial port is not writable");
    }
    const writer = writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(`${line}\n`));
    } finally {
      writer.releaseLock();
    }
  }

  async readLine(): Promise<string> {
    const reader = this.reader;
    if (!reader) {
      throw new SerialPortClosedError("The serial port is not readable");
    }
    for (;;) {
      const newline = this.buffer.indexOf("\n");
      if (newline >= 0) {
        const line = this.buffer.slice(0, newline).replace(/\r$/, "");
        this.buffer = this.buffer.slice(newline + 1);
        if (line.trim()) return line;
        continue;
      }
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch (error) {
        await this.releaseReader();
        this.openState = false;
        throw new SerialPortClosedError("The serial port was closed", {
          cause: error,
        });
      }
      if (result.done) {
        await this.releaseReader();
        this.openState = false;
        throw new SerialPortClosedError();
      }
      this.buffer += this.decoder.decode(result.value, { stream: true });
    }
  }

  async close(): Promise<void> {
    const port = this.port;
    await this.releaseReader();
    this.openState = false;
    try {
      if (port) {
        await port.close();
      }
    } catch {
      // The port may already be closed after a device reboot.
    }
    this.buffer = "";
  }

  private async releaseReader(): Promise<void> {
    const reader = this.reader;
    this.reader = null;
    if (!reader) return;
    try {
      await reader.cancel();
    } catch {
      // The reader may already be closed by the device.
    }
    try {
      reader.releaseLock();
    } catch {
      // Ignore an already released reader.
    }
  }
}
