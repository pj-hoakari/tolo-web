// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import { EventManagementMenu } from "./EventManagementMenu";
import { getEventNavigationAccess } from "./navigationAccess";

vi.mock("./navigationAccess", () => ({
  getEventNavigationAccess: vi.fn(),
}));

afterEach(cleanup);

it("shows only the authorized destinations for read-only staff", async () => {
  const eventId = "0000000000000002";
  vi.mocked(getEventNavigationAccess).mockResolvedValue({
    canEditGuideMap: false,
    canViewObservationDevices: true,
  });
  render(
    <EventManagementMenu
      event={{ eventId, name: "Event B", status: "open" }}
      rememberList={vi.fn()}
    />,
    { wrapper: IntlTestProvider },
  );

  const button = screen.getByRole("button", { name: "「Event B」を管理" });
  fireEvent.keyDown(button, { key: "ArrowDown" });

  const devices = await screen.findByRole("menuitem", {
    name: "観測デバイス管理",
  });
  expect(devices.getAttribute("href")).toBe(`/event/${eventId}/observation`);
  expect(
    screen.queryByRole("menuitem", { name: "案内マップを編集" }),
  ).toBeNull();
  expect(getEventNavigationAccess).toHaveBeenCalledWith(eventId);
});
