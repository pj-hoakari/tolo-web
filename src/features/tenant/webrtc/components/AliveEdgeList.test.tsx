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
) =>
  render(
    <AliveEdgeList
      edges={[
        {
          edgeDeviceId: "edge-a",
          name: "入口カメラ",
          lastHeartbeatAt: null,
          observationPoints: [],
        },
        {
          edgeDeviceId: "edge-b",
          name: "ホールカメラ",
          lastHeartbeatAt: null,
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
