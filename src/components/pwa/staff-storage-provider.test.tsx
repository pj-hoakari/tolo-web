// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { scopeStaffStorageKey } from "@/lib/pwa/staff-storage";
import {
  StaffStorageProvider,
  useStaffStorageScope,
} from "./staff-storage-provider";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function RememberedData({ onDispose }: { onDispose: () => void }) {
  const scope = useStaffStorageScope();
  const [data] = useState(() =>
    localStorage.getItem(scopeStaffStorageKey("draft", scope)),
  );
  useEffect(() => onDispose, [onDispose]);
  return <p>{data}</p>;
}

it("unmounts previous user state and reads only the current user's namespace", () => {
  localStorage.setItem("draft", "legacy owner unknown");
  localStorage.setItem(scopeStaffStorageKey("draft", "alice"), "alice private");
  localStorage.setItem(scopeStaffStorageKey("draft", "bob"), "bob private");
  const dispose = vi.fn();
  const { rerender } = render(
    <StaffStorageProvider scope="alice">
      <RememberedData onDispose={dispose} />
    </StaffStorageProvider>,
  );
  expect(screen.getByText("alice private")).toBeTruthy();
  rerender(
    <StaffStorageProvider scope="bob">
      <RememberedData onDispose={dispose} />
    </StaffStorageProvider>,
  );
  expect(dispose).toHaveBeenCalledOnce();
  expect(screen.queryByText("alice private")).toBeNull();
  expect(screen.queryByText("legacy owner unknown")).toBeNull();
  expect(screen.getByText("bob private")).toBeTruthy();
  expect(localStorage.getItem(scopeStaffStorageKey("draft", "alice"))).toBe(
    "alice private",
  );
  expect(localStorage.getItem("draft")).toBe("legacy owner unknown");
});
