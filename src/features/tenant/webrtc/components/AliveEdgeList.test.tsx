// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import type { ConnectionStatus } from "../type";
import { AliveEdgeList } from "./AliveEdgeList";

afterEach(cleanup);

const renderList = (receiveStatus: ConnectionStatus) =>
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
      onDisconnect={vi.fn()}
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

  it("切断した後の行では状態と操作を別の語で表示する", () => {
    renderList("disconnected");

    const connected = within(row("入口カメラ") as HTMLElement);
    expect(connected.getByText("切断済み")).toBeTruthy();
    expect(connected.getByRole("button", { name: /切断$/ })).toBeTruthy();
  });

  it("行ごとの接続と切断のボタンの名前にエッジ名を含める", () => {
    renderList("error");

    expect(
      screen.getByRole("button", { name: "「入口カメラ」に接続" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "「入口カメラ」から切断" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "「ホールカメラ」に接続" }),
    ).toBeTruthy();
  });
});
