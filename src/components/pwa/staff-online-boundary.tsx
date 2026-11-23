"use client";

import { useTranslations } from "next-intl";
import {
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "@/components/ui/button";

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * Staff management pages contain no safe offline data. Unmount their forms and
 * portals on disconnect. A full reload rechecks the server session and reloads
 * data before editing is allowed again; reconnect alone must not reveal old data.
 */
export function StaffOnlineBoundary({ children }: { children: ReactNode }) {
  const t = useTranslations("StaffConnection");
  const online = useOnline();
  const [requiresReload, setRequiresReload] = useState(false);

  useEffect(() => {
    const invalidate = () => setRequiresReload(true);
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) invalidate();
    };
    if (!navigator.onLine) invalidate();
    window.addEventListener("offline", invalidate);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("offline", invalidate);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  if (online && !requiresReload) return children;

  return (
    <div
      role="alert"
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-start justify-center gap-4 p-6"
    >
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p>{t(online ? "reconnected" : "offline")}</p>
      <Button isDisabled={!online} onPress={() => window.location.reload()}>
        {t("reload")}
      </Button>
    </div>
  );
}

/** Camera detection has its own lifecycle; do not unmount it on a network loss. */
export function ObservationConnectionNotice() {
  const t = useTranslations("StaffConnection");
  const online = useOnline();
  if (online) return null;
  return (
    <p
      role="alert"
      className="border-b border-border bg-muted px-4 py-3 text-sm"
    >
      {t("cameraOffline")}
    </p>
  );
}
