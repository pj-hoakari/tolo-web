"use client";

import { type ReactNode, useEffect, useState } from "react";

const mockingEnabled = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

export function MswBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!mockingEnabled);

  useEffect(() => {
    if (!mockingEnabled) {
      return;
    }
    let active = true;
    void (async () => {
      const { startWorker } = await import("@/mocks/browser");
      await startWorker();
      if (active) {
        setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return null;
  }
  return <>{children}</>;
}
