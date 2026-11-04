// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createOrpcHandlers } from "@/mocks/handlers";
import { server } from "@/mocks/server";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import type { ConnectionStatus, EdgeDeviceItem } from "../type";
import { AliveEdgeList } from "./AliveEdgeList";

afterEach(cleanup);

const renderList = (
  receiveStatus: ConnectionStatus,
  onDisconnect: () => void = vi.fn(),
  {
    connectedOnline = true,
    onUnregistered = vi.fn(),
  }: { connectedOnline?: boolean; onUnregistered?: () => void } = {},
) => {
  const edges: EdgeDeviceItem[] = [
    {
      edgeDeviceId: "edge-a",
      name: "入口カメラ",
      kind: "observation_page",
      cameraLinks: [],
      online: connectedOnline,
      lastHeartbeatAt: null,
      observationPoints: [],
    },
    {
      edgeDeviceId: "edge-b",
      name: "ホールカメラ",
      kind: "observation_page",
      cameraLinks: [],
      online: true,
      lastHeartbeatAt: null,
      observationPoints: [],
    },
    {
      edgeDeviceId: "edge-c",
      name: "倉庫カメラ",
      kind: "observation_page",
      cameraLinks: [],
      online: false,
      lastHeartbeatAt: new Date("2026-06-14T09:00:00.000Z"),
      observationPoints: [{ observationPointId: "point-c", name: "倉庫" }],
    },
    {
      edgeDeviceId: "camera-a",
      name: "ESP32 カメラ",
      kind: "camera",
      cameraLinks: [
        {
          cameraEdgeDeviceId: "camera-a",
          observationPointId: "point-c",
        },
      ],
      online: null,
      lastHeartbeatAt: null,
      observationPoints: [],
    },
  ];
  return render(
    <AliveEdgeList
      eventId="e"
      edges={edges}
      status="ready"
      error={null}
      onRefresh={vi.fn()}
      connectedEdgeId="edge-a"
      receiveStatus={receiveStatus}
      onConnect={vi.fn()}
      onDisconnect={onDisconnect}
      onUnregistered={onUnregistered}
    />,
    { wrapper: IntlTestProvider },
  );
};

const row = (name: string) =>
  screen
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(name));

describe("AliveEdgeList", () => {
  it("接続に失敗した観測デバイスの行に接続状態を表示する", () => {
    renderList("error");

    expect(
      within(row("入口カメラ") as HTMLElement).getByText("接続失敗"),
    ).toBeTruthy();
    expect(
      within(row("ホールカメラ") as HTMLElement).queryByText("接続失敗"),
    ).toBeNull();
  });

  it("接続済みの観測デバイスの行に接続状態を表示する", () => {
    renderList("connected");

    expect(
      within(row("入口カメラ") as HTMLElement).getByText("接続済み"),
    ).toBeTruthy();
  });

  it.each<ConnectionStatus>(["disconnected", "error"])(
    "%s の行では状態を表示し、切断の代わりに接続と閉じるを出す",
    (status) => {
      const onDisconnect = vi.fn();
      renderList(status, onDisconnect);

      const connected = within(row("入口カメラ") as HTMLElement);
      expect(
        connected.getByText(
          status === "disconnected" ? "切断済み" : "接続失敗",
        ),
      ).toBeTruthy();
      expect(
        connected.getByRole("button", { name: "「入口カメラ」に接続" }),
      ).toBeTruthy();
      expect(connected.queryByRole("button", { name: /切断$/ })).toBeNull();

      fireEvent.click(
        connected.getByRole("button", { name: "「入口カメラ」の映像を閉じる" }),
      );
      expect(onDisconnect).toHaveBeenCalledOnce();
    },
  );

  it.each<ConnectionStatus>(["connecting", "negotiating", "connected"])(
    "%s の行では接続を出さずに切断だけを出す",
    (status) => {
      renderList(status);

      const connected = within(row("入口カメラ") as HTMLElement);
      expect(
        connected.getByRole("button", { name: "「入口カメラ」から切断" }),
      ).toBeTruthy();
      expect(connected.queryByRole("button", { name: /に接続$/ })).toBeNull();
      expect(connected.queryByRole("button", { name: /閉じる$/ })).toBeNull();
    },
  );

  it.each<ConnectionStatus>(["connecting", "negotiating", "connected"])(
    "%s の端末がオフラインになっても、切断できる",
    (status) => {
      const onDisconnect = vi.fn();
      renderList(status, onDisconnect, { connectedOnline: false });

      const connected = within(row("入口カメラ") as HTMLElement);
      expect(connected.getByText("オフライン")).toBeTruthy();

      fireEvent.click(
        connected.getByRole("button", { name: "「入口カメラ」から切断" }),
      );
      expect(onDisconnect).toHaveBeenCalledOnce();
    },
  );

  it("オフラインの端末の行にオフラインと最終応答時刻を表示し、接続を押せなくする", () => {
    renderList("idle");

    const offline = within(row("倉庫カメラ") as HTMLElement);
    expect(offline.getByText("オフライン")).toBeTruthy();
    expect(offline.queryByText(/^最終応答: \S+/)).toBeNull();
    expect(offline.queryByText(/不明/)).toBeNull();
    expect(
      offline
        .getByRole("button", { name: "「倉庫カメラ」に接続" })
        .hasAttribute("disabled"),
    ).toBe(true);

    const online = within(row("ホールカメラ") as HTMLElement);
    expect(online.queryByText("オフライン")).toBeNull();
    expect(
      online
        .getByRole("button", { name: "「ホールカメラ」に接続" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it.each<ConnectionStatus>(["disconnected", "error"])(
    "%s の端末がオフラインになっても、映像を閉じられる",
    (status) => {
      const onDisconnect = vi.fn();
      renderList(status, onDisconnect, { connectedOnline: false });

      const connected = within(row("入口カメラ") as HTMLElement);
      expect(connected.getByText("オフライン")).toBeTruthy();
      expect(
        connected
          .getByRole("button", { name: "「入口カメラ」に接続" })
          .hasAttribute("disabled"),
      ).toBe(true);

      fireEvent.click(
        connected.getByRole("button", { name: "「入口カメラ」の映像を閉じる" }),
      );
      expect(onDisconnect).toHaveBeenCalledOnce();
    },
  );

  it("行ごとの接続と切断のボタンの名前に観測デバイス名を含める", () => {
    renderList("connected");

    expect(
      screen.getByRole("button", { name: "「入口カメラ」から切断" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "「ホールカメラ」に接続" }),
    ).toBeTruthy();
  });

  it("オフラインの端末の行には観測ページを開くリンクを出す", () => {
    renderList("idle");

    expect(
      within(row("倉庫カメラ") as HTMLElement)
        .getByRole("link", { name: "「倉庫カメラ」をこの端末で開く" })
        .getAttribute("href"),
    ).toBe("/event/e/observation/edge-c");
  });

  it("カメラの行にバッジと紐づけ先を表示し、稼働状態と接続と観測ページリンクを出さない", () => {
    renderList("idle");

    const camera = within(row("ESP32 カメラ") as HTMLElement);
    expect(camera.getByText("カメラ")).toBeTruthy();
    expect(camera.getByText("紐づけ先: 倉庫")).toBeTruthy();
    expect(camera.queryByText("オフライン")).toBeNull();
    expect(camera.queryByText(/最終応答/)).toBeNull();
    expect(camera.queryByRole("button", { name: /に接続$/ })).toBeNull();
    expect(camera.queryByRole("link")).toBeNull();
    expect(
      camera.getByRole("button", { name: "「ESP32 カメラ」を設定" }),
    ).toBeTruthy();
    expect(
      camera.getByRole("button", {
        name: "「ESP32 カメラ」のカメラ認可をやり直す",
      }),
    ).toBeTruthy();
    expect(
      camera.getByRole("button", { name: "「ESP32 カメラ」を一時停止" }),
    ).toBeTruthy();
    expect(
      camera.getByRole("button", { name: "「ESP32 カメラ」の登録を解除" }),
    ).toBeTruthy();
  });

  it("カメラの認可をやり直すボタンで一時停止の解除を明示した初期設定ダイアログを開く", () => {
    renderList("idle");

    fireEvent.click(
      screen.getByRole("button", {
        name: "「ESP32 カメラ」のカメラ認可をやり直す",
      }),
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByText(/一時停止中のカメラの認可をやり直します/),
    ).toBeTruthy();
  });

  it("カメラを一時停止すると登録は解除せず一覧の更新を求める", async () => {
    const onUnregistered = vi.fn();
    renderList("idle", vi.fn(), { onUnregistered });

    fireEvent.click(
      screen.getByRole("button", { name: "「ESP32 カメラ」を一時停止" }),
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain(
      "「ESP32 カメラ」の配信を一時停止します。",
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "一時停止する" }),
    );

    await waitFor(() => expect(onUnregistered).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("カメラの設定ボタンで初期設定ダイアログを開く", () => {
    renderList("idle");

    fireEvent.click(
      screen.getByRole("button", { name: "「ESP32 カメラ」を設定" }),
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("ESP32 カメラの初期設定")).toBeTruthy();
  });

  it("登録解除を確認すると端末の登録を解除し、一覧の更新を求める", async () => {
    const onUnregistered = vi.fn();
    renderList("idle", vi.fn(), { onUnregistered });

    fireEvent.click(
      screen.getByRole("button", { name: "「倉庫カメラ」の登録を解除" }),
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("「倉庫カメラ」の登録を解除します。");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "登録を解除する" }),
    );

    await waitFor(() => expect(onUnregistered).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("登録解除に失敗すると確認ダイアログに理由を表示し、一覧の更新を求めない", async () => {
    server.use(
      ...createOrpcHandlers({ unregisterEdgeDeviceError: "NOT_FOUND" }),
    );
    const onUnregistered = vi.fn();
    renderList("idle", vi.fn(), { onUnregistered });

    fireEvent.click(
      screen.getByRole("button", { name: "「倉庫カメラ」の登録を解除" }),
    );
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "登録を解除する",
      }),
    );

    expect(
      (await within(screen.getByRole("alertdialog")).findByRole("alert"))
        .textContent,
    ).toBe(
      "観測デバイスが見つからないか、既に登録が解除されています。一覧を更新してください。",
    );
    expect(onUnregistered).not.toHaveBeenCalled();
  });
});
