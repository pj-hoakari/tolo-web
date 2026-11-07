import { describe, expect, it } from "vitest";
import {
  eventListSearch,
  readEventListFilters,
  readListPosition,
} from "./eventListState";

describe("event list URL state", () => {
  it("round-trips search, status and archive filters including Unicode", () => {
    const filters = {
      query: "文化祭 & 展示",
      selectedStatus: "locked" as const,
      includeArchived: true,
    };
    expect(
      readEventListFilters(new URLSearchParams(eventListSearch(filters))),
    ).toEqual(filters);
  });
  it("uses safe defaults for unknown values and includes archived results for that status", () => {
    expect(
      readEventListFilters(new URLSearchParams("status=unknown&archived=true")),
    ).toEqual({ query: "", selectedStatus: "all", includeArchived: false });
    expect(
      readEventListFilters(new URLSearchParams("status=archived")),
    ).toEqual({ query: "", selectedStatus: "archived", includeArchived: true });
  });
  it("reset removes only known filters and preserves unrelated URL parameters", () => {
    expect(
      eventListSearch(
        { query: "", selectedStatus: "all", includeArchived: false },
        new URLSearchParams("q=x&status=open&archived=1&other=y"),
      ),
    ).toBe("other=y");
  });
  it("does not restore arbitrary destinations from saved data", () => {
    expect(
      readListPosition({
        search: "next=https://other.example&status=open",
        y: 120,
      }),
    ).toEqual({ search: "status=open", y: 120 });
    for (const value of [
      null,
      {},
      { search: 1, y: 10 },
      { search: "", y: -1 },
      { search: "", y: Infinity },
    ])
      expect(readListPosition(value)).toBeNull();
  });
});
