// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrpcHandlers } from "@/mocks/handlers";
import { server } from "@/mocks/server";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import {
  SerialPortClosedError,
  type SerialTransport,
} from "../provisioning/transport";
import { CameraProvisioningDialog } from "./CameraProvisioningDialog";

type PendingReader = {
  resolve: (line: string) => void;
  reject: (error: Error) => void;
};

class FakeTransport implements SerialTransport {
  readonly written: string[] = [];
  openedAt: number | null = null;
  selected = false;
  selectCount = 0;
  closed = false;
  reopenAttempts = 0;
  reopenSucceeds = true;
  private readonly queued: string[] = [];
  private readers: PendingReader[] = [];
  private openState = false;
  private portClosed = false;

  isAvailable(): boolean {
    return true;
  }

  isOpen(): boolean {
    return this.openState;
  }

  async selectPort(): Promise<void> {
    this.selected = true;
    this.selectCount += 1;
  }

  async open({ baudRate }: { baudRate: number }): Promise<void> {
    this.openedAt = baudRate;
    this.openState = true;
    this.portClosed = false;
  }

  async reopen({ baudRate }: { baudRate: number }): Promise<void> {
    this.reopenAttempts += 1;
    if (!this.reopenSucceeds) throw new SerialPortClosedError();
    this.openedAt = baudRate;
    this.openState = true;
    this.portClosed = false;
  }

  async writeLine(line: string): Promise<void> {
    this.written.push(line);
  }

  readLine(): Promise<string> {
    const queued = this.queued.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    if (this.portClosed) return Promise.reject(new SerialPortClosedError());
    return new Promise((resolve, reject) => {
      this.readers.push({ resolve, reject });
    });
  }

  async close(): Promise<void> {
    this.closed = true;
    this.openState = false;
    this.portClosed = true;
    this.rejectReaders(new SerialPortClosedError());
  }

  closePort(): void {
    this.openState = false;
    this.portClosed = true;
    this.rejectReaders(new SerialPortClosedError());
  }

  push(line: string): void {
    const reader = this.readers.shift();
    if (reader) {
      reader.resolve(line);
      return;
    }
    this.queued.push(line);
  }

  private rejectReaders(error: Error): void {
    const readers = this.readers;
    this.readers = [];
    for (const reader of readers) reader.reject(error);
  }
}

const edgeDeviceId = "0123456789abcdef";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderDialog(
  transport: FakeTransport,
  timeoutMs = 2_000,
  options: { reapproval?: boolean } = {},
) {
  render(
    <CameraProvisioningDialog
      eventId="e"
      edgeDeviceId={edgeDeviceId}
      edgeName="監視カメラ"
      transport={transport}
      timeoutMs={timeoutMs}
      triggerLabel="設定を開く"
      reapproval={options.reapproval}
    />,
    { wrapper: IntlTestProvider },
  );
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "設定を開く" }));
}

function fillWifi(ssid = "reception", password = "wifi-secret") {
  fireEvent.change(screen.getByRole("textbox", { name: "Wi-Fi SSID" }), {
    target: { value: ssid },
  });
  fireEvent.change(screen.getByLabelText("Wi-Fi パスワード"), {
    target: { value: password },
  });
}

function start() {
  fireEvent.click(screen.getByRole("button", { name: "書き込みを開始" }));
}

const message = (value: object) => JSON.stringify(value);

function recordApprovals() {
  const approvals: {
    eventId: string;
    edgeDeviceId: string;
    userCode: string;
    reapproval?: boolean;
  }[] = [];
  server.use(
    ...createOrpcHandlers({
      approveDeviceAuthorization: (input) => {
        approvals.push(input);
      },
    }),
  );
  return approvals;
}

describe("CameraProvisioningDialog", () => {
  it("writes the config, approves the user code, and completes on the authorization result", async () => {
    const transport = new FakeTransport();
    const approvals = recordApprovals();
    transport.push(message({ type: "config_result", ok: true }));
    transport.push(
      message({
        type: "device_authorization",
        user_code: "ABCD-EFGH",
        verification_uri: "https://idp.example/device",
        expires_in: 600,
      }),
    );
    transport.push(message({ type: "authorization_result", ok: true }));

    renderDialog(transport);
    openDialog();
    fillWifi();
    start();
    // Port selection must begin during the user gesture, before any RPC.
    expect(transport.selected).toBe(true);

    await screen.findByRole("button", { name: "承認する" });
    expect(approvals).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    expect(
      await screen.findByText(/初期設定が完了しました/, {}, { timeout: 3_000 }),
    ).toBeTruthy();
    expect(screen.getByText("ABCD-EFGH")).toBeTruthy();
    expect(transport.selected).toBe(true);
    expect(transport.openedAt).toBe(115_200);
    expect(JSON.parse(transport.written[0])).toMatchObject({
      type: "config",
      version: 1,
      wifi_ssid: "reception",
      wifi_password: "wifi-secret",
      idp_url: "",
      edge_device_id: edgeDeviceId,
    });
    expect(approvals).toEqual([
      { eventId: "e", edgeDeviceId, userCode: "ABCD-EFGH" },
    ]);
  });

  it("sends an explicit device authorization command for reapproval", async () => {
    const transport = new FakeTransport();
    const approvals = recordApprovals();
    transport.push(
      message({
        type: "device_authorization",
        user_code: "ABCD-EFGH",
        verification_uri: "https://idp.example/device",
        expires_in: 600,
      }),
    );
    transport.push(message({ type: "authorization_result", ok: true }));

    renderDialog(transport, 2_000, { reapproval: true });
    openDialog();
    expect(
      screen.getByText(/一時停止中のカメラの認可をやり直します/),
    ).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Wi-Fi SSID" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "認可をやり直す" }));
    await screen.findByRole("button", { name: "承認する" });
    expect(approvals).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    expect(
      await screen.findByText(/初期設定が完了しました/, {}, { timeout: 3_000 }),
    ).toBeTruthy();
    expect(transport.written).toHaveLength(1);
    expect(JSON.parse(transport.written[0])).toEqual({
      type: "device_authorization",
    });
    expect(approvals).toEqual([
      {
        eventId: "e",
        edgeDeviceId,
        userCode: "ABCD-EFGH",
        reapproval: true,
      },
    ]);
  });

  it("shows the device error when the config is rejected", async () => {
    const transport = new FakeTransport();
    const approvals = recordApprovals();
    transport.push(
      message({ type: "config_result", ok: false, error: "invalid wifi" }),
    );

    renderDialog(transport);
    openDialog();
    fillWifi();
    start();

    expect(
      await screen.findByText("端末が設定を拒否しました: invalid wifi"),
    ).toBeTruthy();
    expect(approvals).toEqual([]);
  });

  it("falls back to a manual user code when the serial event is not received", async () => {
    const transport = new FakeTransport();
    const approvals = recordApprovals();
    transport.push(message({ type: "config_result", ok: true }));

    renderDialog(transport, 20);
    openDialog();
    fillWifi();
    start();

    expect(
      await screen.findByText(
        "ユーザーコードを受け取れませんでした",
        {},
        { timeout: 3_000 },
      ),
    ).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "ユーザーコード" }), {
      target: { value: "WXYZ-1234" },
    });
    transport.push(message({ type: "authorization_result", ok: true }));
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    expect(
      await screen.findByText(/初期設定が完了しました/, {}, { timeout: 3_000 }),
    ).toBeTruthy();
    expect(approvals).toEqual([
      { eventId: "e", edgeDeviceId, userCode: "WXYZ-1234" },
    ]);
  });

  it("requests the code again if it was missed without a port disconnect", async () => {
    const transport = new FakeTransport();
    const approvals = recordApprovals();
    transport.push(message({ type: "config_result", ok: true }));
    renderDialog(transport, 100);
    openDialog();
    fillWifi();
    start();
    await waitFor(() =>
      expect(
        transport.written.some(
          (line) => JSON.parse(line).type === "device_authorization",
        ),
      ).toBe(true),
    );
    transport.push(
      message({ type: "device_authorization", user_code: "ABCD-EFGH" }),
    );
    await screen.findByRole("button", { name: "承認する" });
    expect(approvals).toEqual([]);
  });

  it("reopens the port automatically when the device reboots after the config result", async () => {
    const transport = new FakeTransport();
    const approvals = recordApprovals();
    transport.push(message({ type: "config_result", ok: true }));

    renderDialog(transport);
    openDialog();
    fillWifi();
    start();

    await screen.findByText("端末の認可コードを待っています…");
    transport.closePort();
    transport.push(
      message({
        type: "device_authorization",
        user_code: "ABCD-EFGH",
        verification_uri: "https://idp.example/device",
        expires_in: 600,
      }),
    );
    transport.push(message({ type: "authorization_result", ok: true }));

    expect(await screen.findByText("端末の再接続を待っています…")).toBeTruthy();
    await screen.findByRole("button", { name: "承認する" });
    expect(approvals).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    expect(
      await screen.findByText(/初期設定が完了しました/, {}, { timeout: 3_000 }),
    ).toBeTruthy();
    expect(transport.reopenAttempts).toBe(1);
    expect(transport.written.map((line) => JSON.parse(line).type)).toContain(
      "device_authorization",
    );
    expect(approvals).toEqual([
      { eventId: "e", edgeDeviceId, userCode: "ABCD-EFGH" },
    ]);
  });

  it("falls back to selecting the port again when the automatic reopen fails", async () => {
    const transport = new FakeTransport();
    const approvals = recordApprovals();
    transport.reopenSucceeds = false;
    transport.push(message({ type: "config_result", ok: true }));

    renderDialog(transport);
    openDialog();
    fillWifi();
    start();

    await screen.findByText("端末の認可コードを待っています…");
    transport.closePort();
    transport.push(
      message({
        type: "device_authorization",
        user_code: "ABCD-EFGH",
        verification_uri: "https://idp.example/device",
        expires_in: 600,
      }),
    );
    transport.push(message({ type: "authorization_result", ok: true }));

    expect(
      await screen.findByText(
        "シリアルポートが切断されました",
        {},
        { timeout: 3_000 },
      ),
    ).toBeTruthy();
    expect(transport.reopenAttempts).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "ポートを再接続" }));

    await screen.findByRole("button", { name: "承認する" });
    expect(approvals).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    expect(
      await screen.findByText(/初期設定が完了しました/, {}, { timeout: 3_000 }),
    ).toBeTruthy();
    expect(transport.selectCount).toBe(2);
    expect(approvals).toEqual([
      { eventId: "e", edgeDeviceId, userCode: "ABCD-EFGH" },
    ]);
  });

  it("accepts a manual user code after reconnecting the port", async () => {
    const transport = new FakeTransport();
    const approvals = recordApprovals();
    transport.reopenSucceeds = false;
    transport.push(message({ type: "config_result", ok: true }));

    renderDialog(transport, 500);
    openDialog();
    fillWifi();
    start();

    await screen.findByText("端末の認可コードを待っています…");
    transport.closePort();

    expect(
      await screen.findByText(
        "シリアルポートが切断されました",
        {},
        { timeout: 3_000 },
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "ポートを再接続" }));

    expect(
      await screen.findByText(
        "ユーザーコードを受け取れませんでした",
        {},
        { timeout: 3_000 },
      ),
    ).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", { name: "ユーザーコード" }), {
      target: { value: "WXYZ-1234" },
    });
    transport.push(message({ type: "authorization_result", ok: true }));
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));

    expect(
      await screen.findByText(/初期設定が完了しました/, {}, { timeout: 3_000 }),
    ).toBeTruthy();
    expect(approvals).toEqual([
      { eventId: "e", edgeDeviceId, userCode: "WXYZ-1234" },
    ]);
  });

  it("does not expose secrets when the port reconnects", async () => {
    const transport = new FakeTransport();
    recordApprovals();
    const password = "super-secret-password";
    transport.push(message({ type: "config_result", ok: true }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    renderDialog(transport);
    openDialog();
    fillWifi("reception", password);
    start();

    await screen.findByText("端末の認可コードを待っています…");
    transport.closePort();
    transport.push(
      message({
        type: "device_authorization",
        user_code: "ABCD-EFGH",
        verification_uri: "https://idp.example/device",
        expires_in: 600,
      }),
    );
    transport.push(message({ type: "authorization_result", ok: true }));

    fireEvent.click(await screen.findByRole("button", { name: "承認する" }));
    await screen.findByText(/初期設定が完了しました/, {}, { timeout: 3_000 });

    expect(document.body.textContent).not.toContain(password);
    expect(document.body.textContent).not.toContain("wifi_password");
    const logged = [...log.mock.calls, ...error.mock.calls]
      .flat()
      .map(String)
      .join(" ");
    expect(logged).not.toContain(password);
  });

  it("never renders the Wi-Fi password or the serial config command", async () => {
    const transport = new FakeTransport();
    recordApprovals();
    const password = "super-secret-password";
    transport.push(message({ type: "config_result", ok: true }));
    transport.push(
      message({
        type: "device_authorization",
        user_code: "ABCD-EFGH",
        verification_uri: "https://idp.example/device",
        expires_in: 600,
      }),
    );
    transport.push(message({ type: "authorization_result", ok: true }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    renderDialog(transport);
    openDialog();
    fillWifi("reception", password);
    start();

    fireEvent.click(await screen.findByRole("button", { name: "承認する" }));
    await screen.findByText(/初期設定が完了しました/, {}, { timeout: 3_000 });

    expect(document.body.textContent).not.toContain(password);
    expect(document.body.textContent).not.toContain("wifi_password");
    expect(transport.written[0]).toContain(password);
    const logged = [...log.mock.calls, ...error.mock.calls]
      .flat()
      .map(String)
      .join(" ");
    expect(logged).not.toContain(password);
  });

  it("shows a clear message when Web Serial is unavailable", () => {
    render(
      <CameraProvisioningDialog
        eventId="e"
        edgeDeviceId={edgeDeviceId}
        edgeName="監視カメラ"
        triggerLabel="設定を開く"
      />,
      { wrapper: IntlTestProvider },
    );

    openDialog();

    expect(
      screen.getByText(/このブラウザは Web Serial に対応していません/),
    ).toBeTruthy();
  });

  it("closes a port whose open completes after the dialog is closed", async () => {
    const transport = new FakeTransport();
    let finishOpen!: () => void;
    const originalOpen = transport.open.bind(transport);
    vi.spyOn(transport, "open").mockImplementation(async (options) => {
      await new Promise<void>((resolve) => {
        finishOpen = resolve;
      });
      await originalOpen(options);
    });

    renderDialog(transport);
    openDialog();
    fillWifi();
    start();
    await waitFor(() => expect(finishOpen).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    finishOpen();
    await waitFor(() => expect(transport.closed).toBe(true));
    expect(transport.isOpen()).toBe(false);
  });
});
