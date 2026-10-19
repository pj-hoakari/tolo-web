// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createOrpcHandlers } from "@/mocks/handlers";
import { MOCK_SERVER_MESSAGE } from "@/mocks/router";
import { server } from "@/mocks/server";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { GraphEditor } from "./GraphEditor";

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
  it("検証エラーを違反の種類の文言で表示し、原因のポイントを選択する", async () => {
    server.use(
      ...createOrpcHandlers({
        saveGraphError: {
          code: "BAD_REQUEST",
          violations: [
            {
              kind: "NODE_WITHOUT_ROUTE",
              elementKind: "node",
              elementId: "ph_hall2f",
              relatedIds: [],
            },
          ],
        },
      }),
    );

    fireEvent.click(await renderEditor());

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText("ルート図に保存できない箇所があります"),
    ).toBeTruthy();
    expect(
      within(alert).getByText("ルートがつながっていないポイントがあります。"),
    ).toBeTruthy();
    expect(within(alert).queryByText(MOCK_SERVER_MESSAGE)).toBeNull();
    expect(
      (screen.getByRole("textbox", { name: /ラベル/ }) as HTMLInputElement)
        .value,
    ).toBe("2F ホール");
  });

  it("違反が複数あると、ID を持つ要素をすべて選択する", async () => {
    server.use(
      ...createOrpcHandlers({
        saveGraphError: {
          code: "BAD_REQUEST",
          violations: [
            {
              kind: "NODE_WITHOUT_ROUTE",
              elementKind: "node",
              elementId: "ph_hall2f",
              relatedIds: [],
            },
            {
              kind: "GROUP_WITHOUT_MEMBERS",
              elementKind: "group",
              elementId: "ph_floor2",
              relatedIds: [],
            },
            {
              kind: "SELF_LOOP_EDGE",
              elementKind: "edge",
              elementId: "ph_e1",
              relatedIds: ["ph_hall2f"],
            },
            {
              kind: "EMPTY_NODE_ID",
              elementKind: "node",
              elementId: "",
              relatedIds: [],
            },
          ],
        },
      }),
    );

    fireEvent.click(await renderEditor());

    const panel = await screen.findByRole("complementary");
    expect(await within(panel).findByText("ノード: 1件")).toBeTruthy();
    expect(within(panel).getByText("矢印: 1件")).toBeTruthy();
    expect(within(panel).getByText("グループ: 1件")).toBeTruthy();
  });

  it("検証以外の失敗では汎用のエラーを表示する", async () => {
    server.use(http.post("*/rpc/graph/saveGraph", () => HttpResponse.error()));

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
    fireEvent.click(await renderEditor());

    expect(await screen.findByText("保存しました")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
