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
import { RegisterEdgeDeviceForm } from "./RegisterEdgeDeviceForm";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderForm = (onRegistered: () => void = vi.fn()) =>
  render(<RegisterEdgeDeviceForm eventId="e" onRegistered={onRegistered} />, {
    wrapper: IntlTestProvider,
  });

const nameField = () => screen.getByRole("textbox", { name: "端末名" });
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

  it("端末名か観測点名が空のあいだは登録できない", () => {
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
      "端末名と観測点名を確認してください。",
    );
    expect((nameField() as HTMLInputElement).value).toBe("受付カメラ");
    expect(onRegistered).not.toHaveBeenCalled();
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
