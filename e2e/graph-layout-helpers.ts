import { expect, type Page } from "@playwright/test";

export async function waitForGraphLayout(page: Page) {
  // Poll until layout, handle registration and edge rendering agree across animation frames.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const read = () =>
          [
            ...document.querySelectorAll(
              ".react-flow__viewport, .react-flow__node, .react-flow__edge-path",
            ),
          ]
            .map(
              (n) =>
                `${n.getAttribute("style") ?? ""}${n.getAttribute("d") ?? ""}`,
            )
            .join("|");
        let previous = read();
        for (let i = 0; i < 4; i++) {
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          const next = read();
          if (previous !== next) return false;
          previous = next;
        }
        return true;
      }),
    )
    .toBe(true);
}
