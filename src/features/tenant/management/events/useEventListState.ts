"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  type EventListFilters,
  eventListSearch,
  listStorageKey,
  readEventListFilters,
  readListPosition,
} from "./eventListState";

export function useEventListState(tenantId: string) {
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const filters = readEventListFilters(new URLSearchParams(search));

  function updateFilters(patch: Partial<EventListFilters>, replace = false) {
    const params = new URLSearchParams(window.location.search);
    const next = eventListSearch(
      { ...readEventListFilters(params), ...patch },
      params,
    );
    const url = `/management${next ? `?${next}` : ""}`;
    if (url === window.location.pathname + window.location.search) return;
    // Let Next copy its router metadata. Passing __NA back would bypass its
    // native-history integration and leave useSearchParams on the old URL.
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
  }

  function rememberList() {
    const position = {
      search: eventListSearch(
        readEventListFilters(new URLSearchParams(window.location.search)),
      ),
      y: window.scrollY,
    };
    try {
      sessionStorage.setItem(
        listStorageKey(tenantId),
        JSON.stringify(position),
      );
    } catch {
      /* Storage may be unavailable; history still works. */
    }
    window.history.replaceState(
      { ...window.history.state, toloEventList: { tenantId, ...position } },
      "",
    );
  }

  return { ...filters, updateFilters, rememberList };
}

export function useEventListPosition(tenantId: string, ready: boolean) {
  const search = useSearchParams().toString();
  useEffect(() => {
    if (!ready) return;
    const entry = window.history.state?.toloEventList;
    let position =
      entry?.tenantId === tenantId ? readListPosition(entry) : null;
    try {
      const pendingKey = `${listStorageKey(tenantId)}:restore`;
      const pending = sessionStorage.getItem(pendingKey);
      if (pending) {
        position = readListPosition(JSON.parse(pending));
        sessionStorage.removeItem(pendingKey);
      }
    } catch {
      /* Direct links and unavailable storage use the normal position. */
    }
    const frame =
      position &&
      position.search ===
        eventListSearch(readEventListFilters(new URLSearchParams(search)))
        ? requestAnimationFrame(() =>
            window.scrollTo({ top: position.y, behavior: "instant" }),
          )
        : null;
    const save = () => {
      if (
        window.location.pathname !== "/management" ||
        new URLSearchParams(window.location.search).toString() !== search
      )
        return;
      window.history.replaceState(
        {
          ...window.history.state,
          toloEventList: {
            tenantId,
            search: eventListSearch(
              readEventListFilters(new URLSearchParams(search)),
            ),
            y: window.scrollY,
          },
        },
        "",
      );
    };
    window.addEventListener("scroll", save, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", save);
      window.removeEventListener("pagehide", save);
    };
  }, [ready, search, tenantId]);
}
