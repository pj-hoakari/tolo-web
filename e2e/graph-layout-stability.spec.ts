import { expect, type Page, test } from "@playwright/test";
import {
  layoutFixture,
  layoutFixtureNames,
  layoutSearchSeeds,
} from "../src/mocks/fixtures/graphLayout";
import { waitForGraphLayout } from "./graph-layout-helpers";

test.use({ viewport: { width: 1600, height: 1000 } });
test.describe.configure({ mode: "parallel" });
const cases = [
  ...new Set([
    ...layoutFixtureNames,
    ...layoutSearchSeeds.map((s) => `issue249-seed-${s}`),
  ]),
];
const snapshot = (page: Page) =>
  page.evaluate(() => ({
    nodes: [...document.querySelectorAll<HTMLElement>(".react-flow__node")].map(
      (n) => {
        const matrix = new DOMMatrix(n.style.transform);
        return {
          id: n.dataset.id,
          x: matrix.e,
          y: matrix.f,
          width: n.offsetWidth,
          height: n.offsetHeight,
        };
      },
    ),
    paths: [...document.querySelectorAll(".react-flow__edge")].map((n) => ({
      id: n.getAttribute("data-id"),
      d: n.querySelector(".react-flow__edge-path")?.getAttribute("d"),
    })),
    handles: [...document.querySelectorAll(".react-flow__handle")].map((n) => ({
      node: n.getAttribute("data-nodeid"),
      handle: n.getAttribute("data-handleid"),
      position: n.getAttribute("data-handlepos"),
      style: n.getAttribute("style"),
    })),
  }));

for (const name of cases)
  test(`${name}: consecutive alignment retains the first layout`, async ({
    page,
  }) => {
    const fixture = layoutFixture(name);
    if (!fixture) throw new Error(name);
    await page.goto(`/event/test/management/graph/edit?layoutFixture=${name}`);
    const align = page.getByRole("button", { name: "自動整列" });
    await expect(align).toBeVisible();
    await expect(page.locator(".react-flow__node")).toHaveCount(
      fixture.nodes.length + 1,
    );
    await waitForGraphLayout(page);
    await align.click();
    await waitForGraphLayout(page);
    const first = await snapshot(page);
    expect(first.paths).toHaveLength(fixture.edges.length);
    for (let step = 2; step <= 10; step++) {
      await align.click();
      await waitForGraphLayout(page);
      expect(await snapshot(page), `alignment ${step}`).toEqual(first);
    }
  });
