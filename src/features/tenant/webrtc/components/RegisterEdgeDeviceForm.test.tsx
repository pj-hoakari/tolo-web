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
import type { EdgeDeviceItem } from "../type";
import { RegisterEdgeDeviceForm } from "./RegisterEdgeDeviceForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const observationPageEdges: EdgeDeviceItem[] = [
  {
    edgeDeviceId: "8c1f0e2a5d4b3c6e",
    name: "入口端末",
    kind: "observation_page",
    cameraLinks: [],
    online: true,
    lastHeartbeatAt: null,
    observationPoints: [
      { observationPointId: "a1b2c3d4e5f60718", name: "入口" },
      { observationPointId: "b2c3d4e5f6071829", name: "出口" },
    ],
  },
  {
    edgeDeviceId: "3b9d77f41e2a5c08",
    name: "",
    kind: "observation_page",
    cameraLinks: [],
    online: true,
    lastHeartbeatAt: null,
    observationPoints: [
      { observationPointId: "c3d4e5f60718293a", name: "ホール" },
    ],
  },
  {
    edgeDeviceId: "5e6f708192a3b4c5",
    name: "既存のカメラ",
    kind: "camera",
    cameraLinks: [
      {
        cameraEdgeDeviceId: "5e6f708192a3b4c5",
        observationPointId: "c3d4e5f60718293a",
      },
    ],
    online: null,
    lastHeartbeatAt: null,
    observationPoints: [],
  },
];

const renderForm = (
  onRegistered: () => void = vi.fn(),
  edges: EdgeDeviceItem[] = observationPageEdges,
) =>
  render(
    <RegisterEdgeDeviceForm
      eventId="e"
      onRegistered={onRegistered}
      edges={edges}
    />,
    {
      wrapper: IntlTestProvider,
    },
  );

const kindField = () => screen.getByRole("button", { name: /種類/ });

async function chooseKind(label: string) {
  fireEvent.click(kindField());
  fireEvent.click(await screen.findByRole("option", { name: label }));
}

async function chooseCameraPoint(label: string) {
  fireEvent.click(screen.getByRole("button", { name: /紐づける観測点/ }));
  fireEvent.click(await screen.findByRole("option", { name: label }));
}

const nameField = () => screen.getByRole("textbox", { name: "デバイス名" });
const pointsField = () => screen.getByRole("textbox", { name: /^観測点名/ });
const submit = () => screen.getByRole("button", { name: "登録" });

const fill = (name: string, points: string) => {
  fireEvent.change(nameField(), { target: { value: name } });
  fireEvent.change(pointsField(), { target: { value: points } });
};

describe("RegisterEdgeDeviceForm", () => {
  it("登録すると発行 URL とこの端末で開くリンクを表示し、入力を空にして一覧の更新を求める", async () => {
    const onRegistered = vi.fn();
    renderForm(onRegistered);

    fill("受付カメラ", "受付");
    fireEvent.click(submit());

    const url = (await screen.findByRole("textbox", {
      name: "発行 URL",
    })) as HTMLInputElement;
    expect(url.value).toMatch(
      new RegExp(
        `^${window.location.origin}/event/e/observation/[0-9a-f]{16}$`,
      ),
    );
    expect(
      screen.getByRole("link", { name: "この端末で開く" }).getAttribute("href"),
    ).toBe(new URL(url.value).pathname);
    expect(screen.getByText(/「受付カメラ」を登録しました。/)).toBeTruthy();
    expect((nameField() as HTMLInputElement).value).toBe("");
    expect((pointsField() as HTMLTextAreaElement).value).toBe("");
    expect(onRegistered).toHaveBeenCalledOnce();
  });

  it("観測点名は 1 行に 1 つとして、空行と前後の空白と重複を除いて登録する", async () => {
    renderForm();

    fill("受付カメラ", "受付\n\n  出口 \n受付\n");
    fireEvent.click(submit());

    expect(await screen.findByText("観測点: 受付、出口")).toBeTruthy();
  });

  it("デバイス名か観測点名が空のあいだは登録できない", () => {
    renderForm();

    expect(submit().hasAttribute("disabled")).toBe(true);
    fill("受付カメラ", " \n ");
    expect(submit().hasAttribute("disabled")).toBe(true);
    fill(" ", "受付");
    expect(submit().hasAttribute("disabled")).toBe(true);
    fill("受付カメラ", "受付");
    expect(submit().hasAttribute("disabled")).toBe(false);
  });

  it("登録に失敗すると理由を表示し、入力を残して一覧の更新を求めない", async () => {
    server.use(
      ...createOrpcHandlers({ registerEdgeDeviceError: "BAD_REQUEST" }),
    );
    const onRegistered = vi.fn();
    renderForm(onRegistered);

    fill("受付カメラ", "受付");
    fireEvent.click(submit());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "デバイス名と観測点名を確認してください。",
    );
    expect((nameField() as HTMLInputElement).value).toBe("受付カメラ");
    expect(onRegistered).not.toHaveBeenCalled();
  });

  it("カメラは紐づける観測点が選ばれるまで登録できず、観測点名の入力を隠す", async () => {
    renderForm();
    fireEvent.change(nameField(), { target: { value: "監視カメラ" } });

    expect(pointsField()).toBeTruthy();
    expect(submit().hasAttribute("disabled")).toBe(true);

    await chooseKind("カメラ");

    expect(screen.queryByRole("textbox", { name: /^観測点名/ })).toBeNull();
    expect(submit().hasAttribute("disabled")).toBe(true);

    await chooseCameraPoint("入口端末 / 入口");

    expect(submit().hasAttribute("disabled")).toBe(false);
  });

  it("既にカメラが紐づいている観測点は選択肢に出さない", async () => {
    renderForm();
    await chooseKind("カメラ");

    fireEvent.click(screen.getByRole("button", { name: /紐づける観測点/ }));

    expect(
      await screen.findByRole("option", { name: "入口端末 / 入口" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("option", { name: "既存のカメラ / ホール" }),
    ).toBeNull();
    expect(screen.queryByRole("option", { name: /ホール/ })).toBeNull();
  });

  it("カメラを登録すると発行されたエッジデバイス ID と初期設定ボタンを表示する", async () => {
    const onRegistered = vi.fn();
    renderForm(onRegistered);
    fireEvent.change(nameField(), { target: { value: "監視カメラ" } });
    await chooseKind("カメラ");
    await chooseCameraPoint("入口端末 / 出口");

    fireEvent.click(submit());

    const id = (await screen.findByRole("textbox", {
      name: "エッジデバイス ID",
    })) as HTMLInputElement;
    expect(id.value).toMatch(/^[0-9a-f]{16}$/);
    expect(
      screen.getByText(/「監視カメラ」をカメラとして登録しました。/),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "初期設定を開く" })).toBeTruthy();
    expect(onRegistered).toHaveBeenCalledOnce();
  });

  it("URL をコピーするとクリップボードに発行 URL を書き込みコピー済みと表示する", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderForm();

    fill("受付カメラ", "受付");
    fireEvent.click(submit());
    const url = (await screen.findByRole("textbox", {
      name: "発行 URL",
    })) as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "URL をコピー" }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "コピーしました" }),
      ).toBeTruthy(),
    );
    expect(writeText).toHaveBeenCalledWith(url.value);
  });
});
