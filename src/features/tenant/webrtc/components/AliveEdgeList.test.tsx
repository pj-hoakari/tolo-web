// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import type { ConnectionStatus } from "../type";
import { AliveEdgeList } from "./AliveEdgeList";

afterEach(cleanup);

const renderList = (
  receiveStatus: ConnectionStatus,
  onDisconnect: () => void = vi.fn(),
  { connectedOnline = true }: { connectedOnline?: boolean } = {},
) =>
  render(
    <AliveEdgeList
      edges={[
        {
          edgeDeviceId: "edge-a",
          name: "入口カメラ",
          online: connectedOnline,
          lastHeartbeatAt: null,
          observationPoints: [],
        },
        {
          edgeDeviceId: "edge-b",
          name: "ホールカメラ",
          online: true,
          lastHeartbeatAt: null,
          observationPoints: [],
        },
        {
          edgeDeviceId: "edge-c",
          name: "倉庫カメラ",
          online: false,
          lastHeartbeatAt: new Date("2026-06-14T09:00:00.000Z"),
          observationPoints: [],
        },
      ]}
      status="ready"
      error={null}
      onRefresh={vi.fn()}
      connectedEdgeId="edge-a"
      receiveStatus={receiveStatus}
      onConnect={vi.fn()}
      onDisconnect={onDisconnect}
    />,
    { wrapper: IntlTestProvider },
  );

const row = (name: string) =>
  screen
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(name));

describe("AliveEdgeList", () => {
  it("接続に失敗したエッジの行に接続状態を表示する", () => {
    renderList("error");

    expect(
      within(row("入口カメラ") as HTMLElement).getByText("接続失敗"),
    ).toBeTruthy();
    expect(
      within(row("ホールカメラ") as HTMLElement).queryByText("接続失敗"),
    ).toBeNull();
  });

  it("接続済みのエッジの行に接続状態を表示する", () => {
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
    expect(offline.getByText(/^最終応答: \S+/)).toBeTruthy();
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

  it("行ごとの接続と切断のボタンの名前にエッジ名を含める", () => {
    renderList("connected");

    expect(
      screen.getByRole("button", { name: "「入口カメラ」から切断" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "「ホールカメラ」に接続" }),
    ).toBeTruthy();
  });
});
