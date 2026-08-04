// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { ObservationSoftLock } from "./ObservationSoftLock";

/** メッセージを解決できるよう next-intl のプロバイダ配下で描画する */
const renderWithIntl = (ui: ReactElement) =>
  render(ui, { wrapper: IntlTestProvider });

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("ObservationSoftLock", () => {
  it("解除コードが短すぎるときは理由を画面に表示する", async () => {
    renderWithIntl(
      <ObservationSoftLock tenantId="t1" eventId="e1">
        <p>観測画面</p>
      </ObservationSoftLock>,
    );

    fireEvent.change(screen.getByLabelText("解除コード"), {
      target: { value: "ab" },
    });
    fireEvent.click(screen.getByRole("button", { name: "設定して解除" }));

    // FieldError が TextField の外にあると描画されないため、文言の有無で検出する
    expect(
      await screen.findByText("解除コードは4文字以上で入力してください"),
    ).toBeTruthy();
  });

  it("確認用の解除コードが一致しないときは理由を画面に表示する", async () => {
    renderWithIntl(
      <ObservationSoftLock tenantId="t1" eventId="e1">
        <p>観測画面</p>
      </ObservationSoftLock>,
    );

    fireEvent.change(screen.getByLabelText("解除コード"), {
      target: { value: "1234" },
    });
    fireEvent.change(screen.getByLabelText("解除コード（確認）"), {
      target: { value: "5678" },
    });
    fireEvent.click(screen.getByRole("button", { name: "設定して解除" }));

    expect(
      await screen.findByText("確認用の解除コードが一致しません"),
    ).toBeTruthy();
  });

  it("エラーが無いうちは理由を表示しない", () => {
    renderWithIntl(
      <ObservationSoftLock tenantId="t1" eventId="e1">
        <p>観測画面</p>
      </ObservationSoftLock>,
    );

    expect(
      screen.queryByText("解除コードは4文字以上で入力してください"),
    ).toBeNull();
  });
});
