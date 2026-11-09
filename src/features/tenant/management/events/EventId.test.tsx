// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { EventId } from "./EventId";

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(navigator, "clipboard");
});

function setup(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  render(<EventId id="0000000000000001" name="Event A" />, {
    wrapper: IntlTestProvider,
  });
  return screen.getByRole("button", {
    name: "「Event A」のイベントIDをコピー",
  });
}

describe("EventId", () => {
  it("先頭のゼロを含むID全体をコピーし、完了後に成功を通知する", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const button = setup(writeText);
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "「Event A」のイベントIDをコピーしました。",
      ),
    );
    expect(writeText).toHaveBeenCalledWith("0000000000000001");
  });

  it("コピーを拒否されたときは成功を通知せず、手動コピーの案内とIDを残す", async () => {
    const button = setup(
      vi.fn().mockRejectedValue(new Error("NotAllowedError")),
    );
    fireEvent.click(button);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "コピーできませんでした。IDを選択してコピーしてください。",
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText("0000000000000001")).toBeTruthy();
    expect(button.hasAttribute("disabled")).toBe(false);
  });
});
