// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrpcHandlers } from "@/mocks/handlers";
import { server } from "@/mocks/server";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import type { SerialTransport } from "../provisioning/transport";
import { CameraProvisioningDialog } from "./CameraProvisioningDialog";

class FakeTransport implements SerialTransport {
  readonly written: string[] = [];
  openedAt: number | null = null;
  selected = false;
  closed = false;
  private readonly queued: string[] = [];
  private readonly readers: ((line: string) => void)[] = [];

  isAvailable(): boolean {
    return true;
  }

  async selectPort(): Promise<void> {
    this.selected = true;
  }

  async open({ baudRate }: { baudRate: number }): Promise<void> {
    this.openedAt = baudRate;
  }

  async writeLine(line: string): Promise<void> {
    this.written.push(line);
  }

  readLine(): Promise<string> {
    const queued = this.queued.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    return new Promise((resolve) => {
      this.readers.push(resolve);
    });
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  push(line: string): void {
    const reader = this.readers.shift();
    if (reader) {
      reader(line);
      return;
    }
    this.queued.push(line);
  }
}

const edgeDeviceId = "0123456789abcdef";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderDialog(transport: FakeTransport, timeoutMs = 2_000) {
  render(
    <CameraProvisioningDialog
      eventId="e"
      edgeDeviceId={edgeDeviceId}
      edgeName="監視カメラ"
      transport={transport}
      timeoutMs={timeoutMs}
      triggerLabel="設定を開く"
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
      edge_device_id: edgeDeviceId,
    });
    expect(approvals).toEqual([
      { eventId: "e", edgeDeviceId, userCode: "ABCD-EFGH" },
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
});
