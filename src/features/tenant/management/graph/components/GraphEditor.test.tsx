// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { GraphEditor } from "./GraphEditor";

const saveGraph = vi.hoisted(() => vi.fn());

vi.mock("@/features/graph", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/graph")>()),
  saveGraph,
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Object.assign(window, {
    DOMMatrixReadOnly: class {
      m22 = 1;
    },
  });
});

afterEach(() => {
  cleanup();
  saveGraph.mockReset();
});

async function renderEditor() {
  render(
    <IntlTestProvider>
      <div style={{ width: 1200, height: 800 }}>
        <GraphEditor tenantId="t" eventId="e" />
      </div>
    </IntlTestProvider>,
  );
  return screen.findByRole("button", { name: "保存" });
}

describe("GraphEditor の保存", () => {
  it("検証エラーを表示し、原因のポイントを選択する", async () => {
    const { GraphValidationError } = await import("@/features/graph");
    const message = 'invalid graph document: point "ph_hall2f" has no route';
    saveGraph.mockRejectedValue(new GraphValidationError(message));

    fireEvent.click(await renderEditor());

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("ルート図に保存できない箇所があります"),
    ).toBeTruthy();
    expect(within(alert).getByText(message)).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: /ラベル/ }) as HTMLInputElement)
        .value,
    ).toBe("2F ホール");
  });

  it("検証以外の失敗では汎用のエラーを表示する", async () => {
    saveGraph.mockRejectedValue(new Error("network"));

    fireEvent.click(await renderEditor());

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(
        "保存に失敗しました。時間をおいてもう一度お試しください。",
      ),
    ).toBeTruthy();
    expect(within(alert).queryByText("network")).toBeNull();
  });

  it("保存に成功すると保存済みを知らせる", async () => {
    saveGraph.mockResolvedValue(undefined);

    fireEvent.click(await renderEditor());

    expect(await screen.findByText("保存しました")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(saveGraph).toHaveBeenCalledWith(
      { tenantId: "t", eventId: "e" },
      expect.objectContaining({ nodes: expect.any(Array) }),
    );
  });
});
