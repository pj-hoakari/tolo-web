// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { IntlTestProvider } from "@/test/IntlTestProvider";
import messages from "../../../messages/ja.json";
import {
  ObservationConnectionNotice,
  StaffOnlineBoundary,
} from "./staff-online-boundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function connectivity(initial = true) {
  let online = initial;
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  return (next: boolean) => {
    online = next;
    fireEvent(window, new Event(next ? "online" : "offline"));
  };
}

function ProtectedForm({
  dispose,
  save,
}: {
  dispose: () => void;
  save: () => void;
}) {
  useEffect(() => dispose, [dispose]);
  return <Button onPress={save}>protected operation</Button>;
}

function Camera({ dispose }: { dispose: () => void }) {
  useEffect(() => dispose, [dispose]);
  return <p>camera</p>;
}

describe("staff online boundary", () => {
  it("unmounts protected information and operations, and keeps them hidden after reconnect", () => {
    const changeOnline = connectivity();
    const dispose = vi.fn();
    const save = vi.fn();
    render(
      <StaffOnlineBoundary>
        <ProtectedForm dispose={dispose} save={save} />
      </StaffOnlineBoundary>,
      { wrapper: IntlTestProvider },
    );
    expect(
      screen.getByRole("button", { name: "protected operation" }),
    ).toBeTruthy();
    act(() => changeOnline(false));
    expect(dispose).toHaveBeenCalledOnce();
    expect(screen.queryByText("protected operation")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      messages.StaffConnection.offline,
    );
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    act(() => changeOnline(true));
    expect(screen.queryByText("protected operation")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      messages.StaffConnection.reconnected,
    );
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it("blocks an offline initial mount", () => {
    connectivity(false);
    render(<StaffOnlineBoundary>private information</StaffOnlineBoundary>, {
      wrapper: IntlTestProvider,
    });
    expect(screen.queryByText("private information")).toBeNull();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("requires server revalidation after a BFCache restore", () => {
    connectivity();
    render(<StaffOnlineBoundary>private information</StaffOnlineBoundary>, {
      wrapper: IntlTestProvider,
    });
    fireEvent(window, new PageTransitionEvent("pageshow", { persisted: true }));
    expect(screen.queryByText("private information")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      messages.StaffConnection.reconnected,
    );
  });

  it("leaves ordinary pageshow events alone and removes listeners", () => {
    connectivity();
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(
      <StaffOnlineBoundary>private information</StaffOnlineBoundary>,
      { wrapper: IntlTestProvider },
    );
    fireEvent(
      window,
      new PageTransitionEvent("pageshow", { persisted: false }),
    );
    expect(screen.getByText("private information")).toBeTruthy();
    unmount();
    expect(remove).toHaveBeenCalledWith("pageshow", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("online", expect.any(Function));
  });

  it("warns about offline local detections without unmounting the camera", () => {
    const changeOnline = connectivity();
    const dispose = vi.fn();
    render(
      <>
        <ObservationConnectionNotice />
        <Camera dispose={dispose} />
      </>,
      { wrapper: IntlTestProvider },
    );
    expect(screen.queryByRole("alert")).toBeNull();
    act(() => changeOnline(false));
    expect(screen.getByRole("alert").textContent).toBe(
      messages.StaffConnection.cameraOffline,
    );
    expect(screen.getByText("camera")).toBeTruthy();
    expect(dispose).not.toHaveBeenCalled();
  });
});
