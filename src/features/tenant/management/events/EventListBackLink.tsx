"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/components/ui/link";
import {
  type EventListPosition,
  listStorageKey,
  readListPosition,
} from "./eventListState";

export function EventListBackLink({ tenantId }: { tenantId: string }) {
  const t = useTranslations("TenantManagement.list");
  const [position, setPosition] = useState<EventListPosition | null>(null);
  useEffect(() => {
    try {
      setPosition(
        readListPosition(
          JSON.parse(
            sessionStorage.getItem(listStorageKey(tenantId)) ?? "null",
          ),
        ),
      );
    } catch {
      /* No saved list is a valid direct visit. */
    }
  }, [tenantId]);
  return (
    <Link
      href={`/management${position?.search ? `?${position.search}` : ""}`}
      variant="ghost"
      size="sm"
      className="min-h-11 gap-2 self-start"
      onPress={() => {
        if (position)
          try {
            sessionStorage.setItem(
              `${listStorageKey(tenantId)}:restore`,
              JSON.stringify(position),
            );
          } catch {
            /* The URL still restores the filters. */
          }
      }}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {t("backToList")}
    </Link>
  );
}
