export interface SerialTransport {
  isAvailable(): boolean;
  selectPort(): Promise<void>;
  open(options: { baudRate: number }): Promise<void>;
  writeLine(line: string): Promise<void>;
  readLine(): Promise<string>;
  close(): Promise<void>;
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

  isAvailable(): boolean {
    return serialApi() !== undefined;
  }

  async selectPort(): Promise<void> {
    const serial = serialApi();
    if (!serial) {
      throw new Error("Web Serial is not available");
    }
    this.port = await serial.requestPort();
  }

  async open({ baudRate }: { baudRate: number }): Promise<void> {
    if (!this.port) {
      throw new Error("No serial port has been selected");
    }
    await this.port.open({ baudRate });
    if (!this.port.readable || !this.port.writable) {
      throw new Error("The serial port is not readable");
    }
    this.reader = this.port.readable.getReader();
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
    if (!this.reader) {
      throw new Error("The serial port is not readable");
    }
    for (;;) {
      const newline = this.buffer.indexOf("\n");
      if (newline >= 0) {
        const line = this.buffer.slice(0, newline).replace(/\r$/, "");
        this.buffer = this.buffer.slice(newline + 1);
        if (line.trim()) return line;
        continue;
      }
      const { value, done } = await this.reader.read();
      if (done) {
        throw new Error("The serial port was closed");
      }
      this.buffer += this.decoder.decode(value, { stream: true });
    }
  }

  async close(): Promise<void> {
    try {
      await this.reader?.cancel();
    } catch {
      // The reader may already be closed by the device.
    }
    try {
      this.reader?.releaseLock();
    } catch {
      // Ignore an already released reader.
    }
    this.reader = null;
    try {
      if (this.port) {
        await this.port.close();
      }
    } catch {
      // The port may already be closed after a device reboot.
    }
    this.port = null;
    this.buffer = "";
  }
}
