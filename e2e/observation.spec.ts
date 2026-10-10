import {
  type BrowserContext,
  expect,
  type Page,
  type Route,
  test,
} from "@playwright/test";

test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
});

const code = (page: Page) =>
  page.getByRole("textbox", { name: "解除コード", exact: true });
const confirmation = (page: Page) =>
  page.getByRole("textbox", { name: "解除コード（確認）" });
const lockButton = (page: Page) =>
  page.getByRole("button", { name: "画面ロック" });

const setUpUnlockCode = async (page: Page, value: string) => {
  await code(page).fill(value);
  await confirmation(page).fill(value);
  await page.getByRole("button", { name: "設定して解除" }).click();
  await expect(lockButton(page)).toBeVisible();
};

const startButton = (page: Page) =>
  page.getByRole("button", { name: "カメラを起動" });
const stopButton = (page: Page) =>
  page.getByRole("button", { name: "停止", exact: true });
const lineName = (page: Page) =>
  page.getByRole("textbox", { name: "選択ラインの名前" });
const lineButtons = (page: Page) =>
  page.getByRole("button", { name: /: forward \d+ \/ backward \d+$/ });
const wakeToggle = (page: Page) =>
  page.getByRole("button", { name: "画面の常時点灯" });
const presetGroup = (page: Page, title: string) =>
  page
    .locator("div")
    .filter({ has: page.getByText(title, { exact: true }) })
    .filter({ has: page.getByRole("button", { name: "標準" }) })
    .last();

const canvasPoint = async (page: Page, u: number, v: number) => {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("canvas is not visible");
  return { x: box.x + box.width * u, y: box.y + box.height * v };
};

const dragOnCanvas = async (
  page: Page,
  from: [number, number],
  to: [number, number],
) => {
  const start = await canvasPoint(page, ...from);
  const end = await canvasPoint(page, ...to);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 5 });
  await page.mouse.up();
};

const clickOnCanvas = async (page: Page, u: number, v: number) => {
  const point = await canvasPoint(page, u, v);
  await page.mouse.click(point.x, point.y);
};

const addLine = async (page: Page) => {
  await page.getByRole("button", { name: "ライン生成" }).click();
  await dragOnCanvas(page, [0.2, 0.2], [0.5, 0.3]);
  await page.getByRole("button", { name: "編集モード" }).click();
};

const holdModelRequest = async (context: BrowserContext) => {
  const held = Promise.withResolvers<Route>();
  await context.route("**/models/*.onnx", held.resolve);
  return () => held.promise;
};

test.beforeEach(async ({ page }) => {
  await page.goto("/event/test/observation");
  await expect(
    page.getByRole("heading", { level: 2, name: "test 観測ページ" }),
  ).toBeVisible();
});

test.describe("画面ロック", () => {
  test("初めて観測ページを開くと解除コードの設定を求められページは操作できない", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { level: 2, name: "解除コードを設定" }),
    ).toBeVisible();
    await expect(
      page.locator("[inert]").getByRole("button", { name: "カメラを起動" }),
    ).toHaveCount(1);
  });

  test("4 文字未満の解除コードを設定しようとすると文字数不足のエラーが表示される", async ({
    page,
  }) => {
    await code(page).fill("123");
    await confirmation(page).fill("123");
    await page.getByRole("button", { name: "設定して解除" }).click();

    await expect(
      page.getByText("解除コードは4文字以上で入力してください"),
    ).toBeVisible();
    await expect(lockButton(page)).toBeHidden();
  });

  test("確認用の解除コードが一致しないと不一致のエラーが表示される", async ({
    page,
  }) => {
    await code(page).fill("1234");
    await confirmation(page).fill("1235");
    await page.getByRole("button", { name: "設定して解除" }).click();

    await expect(
      page.getByText("確認用の解除コードが一致しません"),
    ).toBeVisible();
    await expect(lockButton(page)).toBeHidden();
  });

  test("解除コードを設定するとロックが解除されページを操作できるようになる", async ({
    page,
  }) => {
    await setUpUnlockCode(page, "1234");

    await expect(page.locator("[inert]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "カメラを起動" }),
    ).toBeEnabled();
  });

  test("画面ロックを押すとロック中になり設定済みの解除コードで解除できる", async ({
    page,
  }) => {
    await setUpUnlockCode(page, "1234");

    await lockButton(page).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "画面ロック中" }),
    ).toBeVisible();

    await code(page).fill("1234");
    await page.getByRole("button", { name: "ロック解除" }).click();
    await expect(lockButton(page)).toBeVisible();
  });

  test("ロック中に誤った解除コードを入力するとエラーが表示されロックは解除されない", async ({
    page,
  }) => {
    await setUpUnlockCode(page, "1234");
    await lockButton(page).click();

    await code(page).fill("9999");
    await page.getByRole("button", { name: "ロック解除" }).click();

    await expect(page.getByText("解除コードが正しくありません")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "画面ロック中" }),
    ).toBeVisible();
  });

  test("解除コードを設定した後に再読み込みするとロック中の状態で開く", async ({
    page,
  }) => {
    await setUpUnlockCode(page, "1234");

    await page.reload();

    await expect(
      page.getByRole("heading", { level: 2, name: "画面ロック中" }),
    ).toBeVisible();
    await expect(confirmation(page)).toHaveCount(0);
  });

  test("ロック中に 4 文字未満の解除コードで解除しようとすると文字数不足のエラーが表示される", async ({
    page,
  }) => {
    await setUpUnlockCode(page, "1234");
    await lockButton(page).click();

    await code(page).fill("123");
    await page.getByRole("button", { name: "ロック解除" }).click();

    await expect(
      page.getByText("解除コードは4文字以上で入力してください"),
    ).toBeVisible();
    await expect(lockButton(page)).toBeHidden();
  });

  test("ロック中に解除コード入力欄で Enter を押すと解除コードが送信される", async ({
    page,
  }) => {
    await setUpUnlockCode(page, "1234");
    await lockButton(page).click();

    await code(page).fill("1234");
    await code(page).press("Enter");

    await expect(lockButton(page)).toBeVisible();
  });

  test("解除コードはイベントごとに設定する", async ({ page }) => {
    await setUpUnlockCode(page, "1234");

    await page.goto("/event/other/observation");

    await expect(
      page.getByRole("heading", { level: 2, name: "解除コードを設定" }),
    ).toBeVisible();
  });
});

test.describe("検出設定", () => {
  test.beforeEach(async ({ page }) => {
    await setUpUnlockCode(page, "1234");
  });

  test("選択ラインの名前を変えるとラインの表示名が変わる", async ({ page }) => {
    await page
      .getByRole("textbox", { name: "選択ラインの名前" })
      .fill("ホールA入口");

    await expect(
      page.getByRole("button", { name: "ホールA入口: forward 0 / backward 0" }),
    ).toBeVisible();
  });

  for (const { preset, field, value } of [
    { preset: "厳しめ", field: "検出感度", value: "0.3" },
    { preset: "追従優先", field: "追跡のつながりやすさ", value: "0.95" },
    { preset: "省負荷", field: "検出間隔 ms", value: "250" },
  ]) {
    test(`プリセット「${preset}」を選ぶと詳細調整の「${field}」が ${value} になる`, async ({
      page,
    }) => {
      await page.getByRole("button", { name: preset }).click();
      await page.getByRole("button", { name: "詳細調整" }).click();

      await expect(page.getByRole("spinbutton", { name: field })).toHaveValue(
        value,
      );
    });
  }

  for (const { field, input, value } of [
    { field: "検出感度", input: "5", value: "1" },
    { field: "検出感度", input: "0", value: "0.05" },
    { field: "追跡のつながりやすさ", input: "0", value: "0.1" },
    { field: "検出間隔 ms", input: "2000", value: "1000" },
    { field: "検出間隔 ms", input: "123.6", value: "124" },
  ]) {
    test(`詳細調整の「${field}」に ${input} を入れると ${value} に丸められる`, async ({
      page,
    }) => {
      await page.getByRole("button", { name: "詳細調整" }).click();
      const spinbutton = page.getByRole("spinbutton", { name: field });

      await spinbutton.fill(input);

      await expect(spinbutton).toHaveValue(value);
    });
  }

  for (const { title, preset, value, standard } of [
    { title: "検出感度", preset: "広め", value: "0.10", standard: "0.15" },
    {
      title: "追跡のつながりやすさ",
      preset: "安定",
      value: "0.60",
      standard: "0.80",
    },
    { title: "検出頻度", preset: "高頻度", value: "50ms", standard: "100ms" },
  ]) {
    test(`「${title}」のプリセット「${preset}」を選ぶと見出しの値が ${value} になり「標準」で ${standard} に戻る`, async ({
      page,
    }) => {
      const group = presetGroup(page, title);
      await expect(group).toContainText(standard);

      await group.getByRole("button", { name: preset }).click();
      await expect(group).toContainText(value);

      await group.getByRole("button", { name: "標準" }).click();
      await expect(group).toContainText(standard);
    });
  }

  test("詳細調整を閉じると入力欄が消える", async ({ page }) => {
    await page.getByRole("button", { name: "詳細調整" }).click();
    await expect(page.getByRole("spinbutton")).toHaveCount(3);

    await page.getByRole("button", { name: "詳細調整を閉じる" }).click();

    await expect(page.getByRole("spinbutton")).toHaveCount(0);
  });
});

test.describe("カウントライン", () => {
  test.beforeEach(async ({ page }) => {
    await setUpUnlockCode(page, "1234");
    await page.getByRole("button", { name: "非表示" }).click();
  });

  test("ライン生成モードで映像上をドラッグすると新しいラインが追加され選択される", async ({
    page,
  }) => {
    await lineName(page).fill("ホールA入口");
    await page.getByRole("button", { name: "ライン生成" }).click();
    await expect(
      page.getByRole("button", { name: "編集モード" }),
    ).toBeVisible();

    await dragOnCanvas(page, [0.2, 0.2], [0.5, 0.3]);

    await expect(
      page.getByRole("button", { name: "ライン 2: forward 0 / backward 0" }),
    ).toBeVisible();
    await expect(lineName(page)).toHaveValue("");
  });

  test("編集モードでラインをドラッグすると移動し移動先を押すとそのラインが選択される", async ({
    page,
  }) => {
    await lineName(page).fill("ホールA入口");
    await addLine(page);
    await dragOnCanvas(page, [0.7, 0.6], [0.7, 0.9]);
    await page
      .getByRole("button", { name: "ライン 2: forward 0 / backward 0" })
      .click();

    await clickOnCanvas(page, 0.7, 0.6);
    await expect(lineName(page)).toHaveValue("");

    await clickOnCanvas(page, 0.7, 0.9);
    await expect(lineName(page)).toHaveValue("ホールA入口");
  });

  test("ラインが 1 本のときは選択ラインを削除できず 2 本あれば削除できる", async ({
    page,
  }) => {
    const deleteButton = page.getByRole("button", { name: "選択ラインを削除" });
    await expect(deleteButton).toBeDisabled();

    await addLine(page);
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();

    await expect(
      page.getByRole("button", { name: "ライン 2: forward 0 / backward 0" }),
    ).toHaveCount(0);
    await expect(lineButtons(page)).toHaveCount(1);
    await expect(deleteButton).toBeDisabled();
  });

  test("ラインを初期位置に戻すと追加したラインと名前が消え初期のラインだけになる", async ({
    page,
  }) => {
    await lineName(page).fill("ホールA入口");
    await addLine(page);

    await page.getByRole("button", { name: "ラインを初期位置に戻す" }).click();

    await expect(lineButtons(page)).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "ライン 1: forward 0 / backward 0" }),
    ).toBeVisible();
    await expect(lineName(page)).toHaveValue("");
  });

  test("ライン一覧のボタンを押すとそのラインが選択される", async ({ page }) => {
    await lineName(page).fill("ホールA入口");
    await addLine(page);
    await expect(lineName(page)).toHaveValue("");

    await page
      .getByRole("button", { name: "ホールA入口: forward 0 / backward 0" })
      .click();

    await expect(lineName(page)).toHaveValue("ホールA入口");
  });
});

test.describe("検出の開始", () => {
  test.use({ permissions: ["camera"] });

  test("検出モデルを取得できないときにカメラを起動すると検出状態がエラーになり理由が表示される", async ({
    page,
    context,
  }) => {
    await context.route("**/models/*.onnx", (route) =>
      route.fulfill({ status: 404 }),
    );
    await setUpUnlockCode(page, "1234");

    await page.getByRole("button", { name: "カメラを起動" }).click();

    await expect(page.getByText("検出状態: エラー")).toBeVisible();
    await expect(
      page.getByText(
        "検出モデルの読み込みに失敗しました（404: /models/yolo26n.onnx）",
      ),
    ).toBeVisible();
  });

  test("カメラを起動すると起動中になり停止すると後から検出モデルの取得に失敗してもエラーにならない", async ({
    page,
    context,
  }) => {
    await setUpUnlockCode(page, "1234");
    const heldModelRequest = await holdModelRequest(context);

    await startButton(page).click();
    await expect(page.getByText("検出状態: 起動中")).toBeVisible();
    await expect(page.getByText("起動中…")).toBeVisible();
    await expect(startButton(page)).toBeDisabled();
    await expect(stopButton(page)).toBeEnabled();
    const route = await heldModelRequest();

    await stopButton(page).click();
    await expect(page.getByText("検出状態: 停止中")).toBeVisible();
    const response = page.waitForResponse("**/models/*.onnx");
    await route.fulfill({ status: 404 });
    await response;
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );

    await expect(page.getByText("検出状態: 停止中")).toBeVisible();
    await expect(
      page.getByText("検出モデルの読み込みに失敗しました"),
    ).toHaveCount(0);
  });

  test("検出モデルの取得に失敗した後にもう一度起動すると取得を再試行する", async ({
    page,
    context,
  }) => {
    await setUpUnlockCode(page, "1234");
    let requests = 0;
    await context.route("**/models/*.onnx", (route) => {
      requests += 1;
      return route.fulfill({ status: 404 });
    });
    await expect(page.getByText("検出状態: 停止中")).toBeVisible();
    await expect(stopButton(page)).toBeDisabled();

    await startButton(page).click();
    await expect(page.getByText("検出状態: エラー")).toBeVisible();
    await expect(stopButton(page)).toBeDisabled();
    await expect(startButton(page)).toBeEnabled();

    await startButton(page).click();

    await expect.poll(() => requests).toBe(2);
    await expect(page.getByText("検出状態: エラー")).toBeVisible();
    await expect(
      page.getByText(/^検出モデルの読み込みに失敗しました/),
    ).toHaveCount(1);
  });

  test("起動中は映像ファイルの選択とループ再生の切り替えができない", async ({
    page,
    context,
  }) => {
    await setUpUnlockCode(page, "1234");
    await holdModelRequest(context);

    await startButton(page).click();

    await expect(
      page.getByRole("button", { name: "映像ファイルを選択" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("checkbox", { name: "ループ再生" }),
    ).toBeDisabled();
  });
});

test.describe("映像ソース", () => {
  test.beforeEach(async ({ page }) => {
    await setUpUnlockCode(page, "1234");
  });

  test("映像ファイルを選ぶと映像ソースがそのファイルになりカメラに戻せる", async ({
    page,
  }) => {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "映像ファイルを選択" }).click();
    await (await chooser).setFiles({
      name: "sample.mp4",
      mimeType: "video/mp4",
      buffer: Buffer.from(""),
    });

    await expect(page.getByText(/^現在: sample\.mp4/)).toBeVisible();

    await page.getByRole("button", { name: "カメラに戻す" }).click();
    await expect(page.getByText(/^現在: カメラ/)).toBeVisible();
  });

  test("映像ソースの非表示を押すと映像ソースのパネルが消える", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "非表示" }).click();

    await expect(
      page.getByRole("button", { name: "映像ファイルを選択" }),
    ).toHaveCount(0);
  });
});

test.describe("画面の常時点灯", () => {
  test.use({ permissions: ["screen-wake-lock"] });

  test.beforeEach(async ({ page }) => {
    await setUpUnlockCode(page, "1234");
  });

  test("常時点灯を ON にすると案内が変わり OFF にすると戻る", async ({
    page,
  }) => {
    await expect(wakeToggle(page)).toHaveAttribute("aria-pressed", "false");

    await wakeToggle(page).click();
    await expect(wakeToggle(page)).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText("観測中は画面が自動で消灯しません"),
    ).toBeVisible();

    await wakeToggle(page).click();
    await expect(wakeToggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.getByText("観測中は画面が自動で消灯しません"),
    ).toHaveCount(0);
  });

  test("常時点灯は Space キーでも切り替えられる", async ({ page }) => {
    await wakeToggle(page).focus();

    await page.keyboard.press("Space");
    await expect(wakeToggle(page)).toHaveAttribute("aria-pressed", "true");

    await page.keyboard.press("Space");
    await expect(wakeToggle(page)).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("画面の常時点灯が許可されないとき", () => {
  test.beforeEach(async ({ page }) => {
    await setUpUnlockCode(page, "1234");
  });

  test("常時点灯を ON にしようとすると OFF に戻りエラーが表示される", async ({
    page,
  }) => {
    test.fail();
    await wakeToggle(page).click();

    await expect(
      page.getByRole("alert").filter({ hasText: /Wake Lock/ }),
    ).toBeVisible();
    await expect(wakeToggle(page)).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("Screen Wake Lock に対応していないブラウザ", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      delete (Navigator.prototype as { wakeLock?: unknown }).wakeLock;
    });
    await page.reload();
  });

  test("非対応の案内が表示され常時点灯の切り替えは出ない", async ({ page }) => {
    await expect(page.getByRole("note")).toContainText(
      "画面の常時点灯（Screen Wake Lock）に対応していません",
    );
    await expect(wakeToggle(page)).toHaveCount(0);
  });
});

test("エッジデバイス付きの URL でも観測ページが表示される", async ({
  page,
}) => {
  await page.goto("/event/test/observation/0123456789abcdef");

  await expect(
    page.getByRole("heading", { level: 2, name: "test 観測ページ" }),
  ).toBeVisible();
});
