"use client";

import { useEffect, useState } from "react";

export const GUEST_REFRESH_INTERVAL_MS = 60_000;

export type GuestPolling<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error" };

export function useGuestPolling<T>(load: () => Promise<T>): GuestPolling<T> {
  const [state, setState] = useState<GuestPolling<T>>({ status: "loading" });

  useEffect(() => {
    let active = true;
    const fetchLatest = () =>
      load().then(
        (data) => {
          if (active) setState({ status: "ready", data });
        },
        () => {
          if (active)
            setState((prev) =>
              prev.status === "ready" ? prev : { status: "error" },
            );
        },
      );
    fetchLatest();
    const timer = setInterval(fetchLatest, GUEST_REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load]);

  return state;
}
