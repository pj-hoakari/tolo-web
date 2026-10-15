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
import { LabelLocaleMenu } from "./LabelLocaleMenu";

afterEach(cleanup);

const renderMenu = () =>
  render(
    <LabelLocaleMenu
      labelLocale="ko"
      onChangeLabelLocale={vi.fn()}
      labelCounts={{ ko: 1 }}
      labelTargetCount={2}
    />,
    { wrapper: IntlTestProvider },
  );

describe("LabelLocaleMenu", () => {
  it("ボタン名でラベルの言語と現在の言語を伝え、言語名にその言語を指定する", () => {
    renderMenu();

    const button = screen.getByRole("button", {
      name: "ラベルの言語（한국어）",
    });
    expect(within(button).getByText("한국어").getAttribute("lang")).toBe("ko");
  });

  it("メニューの各言語名にその言語を指定する", () => {
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: /ラベルの言語/ }));

    const item = screen.getByRole("menuitemradio", { name: /English/ });
    expect(within(item).getByText("English").getAttribute("lang")).toBe("en");
  });
});
