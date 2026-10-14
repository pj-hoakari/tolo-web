import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  layoutFixture,
  layoutFixtureNames,
  layoutSearchSeeds,
} from "../src/mocks/fixtures/graphLayout";
import { waitForGraphLayout } from "./graph-layout-helpers";

test.use({ viewport: { width: 1600, height: 1000 }, trace: "on" });
test.describe.configure({ mode: "parallel" });
const snapshot = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>(".react-flow__node")].map(
      (n) => {
        const matrix = new DOMMatrix(n.style.transform),
          group = n.classList.contains("react-flow__node-graphGroup");
        return {
          id: n.dataset.id ?? "",
          group,
          x: matrix.e + (group ? 0 : n.offsetWidth / 2),
          y: matrix.f + (group ? 0 : n.offsetHeight / 2),
          width: n.offsetWidth,
          height: n.offsetHeight,
        };
      },
    ),
  );
const searchMode = process.env.LAYOUT_REPRO_SEARCH === "1";
const cases = searchMode
  ? layoutSearchSeeds.map((seed) => `issue249-seed-${seed}`)
  : layoutFixtureNames;
for (const name of cases)
  test(`${name}: 修正前の連続整列で入れ替わり・グループ移動を探索`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    const fixture = layoutFixture(name);
    if (!fixture) throw new Error(name);
    const parents = new Map(fixture.nodes.map((n) => [n.id, n.parentId]));
    await page.goto(`/event/test/management/graph/edit?layoutFixture=${name}`);
    await expect(page.getByRole("button", { name: "自動整列" })).toBeVisible();
    await expect(page.locator(".react-flow__node")).toHaveCount(
      fixture.nodes.length + 1,
    );
    await waitForGraphLayout(page);
    const records = [];
    let before: Awaited<ReturnType<typeof snapshot>> | undefined;
    for (let step = 1; step <= 6; step++) {
      await page.getByRole("button", { name: "自動整列" }).click();
      await waitForGraphLayout(page);
      const after = await snapshot(page);
      await expect(page.locator(".react-flow__edge")).toHaveCount(
        fixture.edges.length,
      );
      await page.screenshot({ path: testInfo.outputPath(`align-${step}.png`) });
      if (before) {
        const byId = new Map(after.map((n) => [n.id, n]));
        expect(after.map((n) => n.id).sort()).toEqual(
          before.map((n) => n.id).sort(),
        );
        const groupChanges = before
          .filter((n) => n.group)
          .map((n) => {
            const next = byId.get(n.id);
            if (!next) throw new Error(n.id);
            const dx = next.x - n.x,
              dy = next.y - n.y;
            return { id: n.id, dx, dy, distance: Math.hypot(dx, dy) };
          });
        const moves = groupChanges.filter((m) => m.distance >= 300);
        const swaps = [];
        const points = before.filter((n) => !n.group && parents.has(n.id));
        for (let i = 0; i < points.length; i++)
          for (let j = i + 1; j < points.length; j++) {
            const a = points[i],
              b = points[j];
            if (parents.get(a.id) !== parents.get(b.id)) continue;
            const c = byId.get(a.id),
              d = byId.get(b.id);
            if (!c || !d) throw new Error("missing point");
            for (const axis of ["x", "y"] as const)
              if (
                Math.abs(a[axis] - b[axis]) >= 20 &&
                Math.abs(c[axis] - d[axis]) >= 20 &&
                (a[axis] - b[axis]) * (c[axis] - d[axis]) < 0
              )
                swaps.push({
                  a: a.id,
                  b: b.id,
                  axis,
                  before: [a[axis], b[axis]],
                  after: [c[axis], d[axis]],
                });
          }
        records.push({
          from: step - 1,
          to: step,
          before,
          after,
          groupChanges,
          moves,
          swaps,
        });
        if (
          searchMode
            ? moves.length || swaps.length
            : name === "issue249-group-movement"
              ? moves.length
              : swaps.length
        )
          break;
      }
      before = after;
    }
    const evidence = testInfo.outputPath("layout-transitions.json");
    await writeFile(
      evidence,
      JSON.stringify({ name, base: "04d5ea4", fixture, records }, null, 2),
    );
    await testInfo.attach("layout-transitions", {
      path: evidence,
      contentType: "application/json",
    });
    if (!searchMode && name === "issue249-seed-1") {
      const reversal = records.find((r) =>
        r.swaps.some((s) => s.a === "n0" && s.b === "n1" && s.axis === "x"),
      );
      expect(reversal, "n0とn1の左右逆転が再現する").toBeDefined();
      if (reversal) {
        expect(reversal.groupChanges.every((g) => g.distance < 0.1)).toBe(true);
        const afterById = new Map(reversal.after.map((n) => [n.id, n]));
        for (const n of reversal.before) {
          const after = afterById.get(n.id);
          if (n.group) expect(after).toEqual(n);
          if (n.id === "n0" || n.id === "n1") expect(after?.y).toBe(n.y);
        }
      }
    }
    if (!searchMode)
      expect(
        records.some((r) =>
          name === "issue249-group-movement" ? r.moves.length : r.swaps.length,
        ),
        "実際の順序逆転またはグループ座標移動が再現したか",
      ).toBe(true);
  });
