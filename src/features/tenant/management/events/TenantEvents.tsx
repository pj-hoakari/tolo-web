"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { managementPath } from "../routes";
import { ArchiveEventDialog } from "./ArchiveEventDialog";
import { CreateEventForm } from "./CreateEventForm";
import { ARCHIVABLE_STATUSES } from "./type";
import { useTenantEvents } from "./useTenantEvents";

type Props = {
  tenantId: string;
};

export function TenantEvents({ tenantId }: Props) {
  const t = useTranslations("TenantManagement");
  const list = useTenantEvents(tenantId);

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6">
      <CreateEventForm tenantId={tenantId} onCreated={list.refresh} />
      <section className="flex flex-col gap-2">
        <h3 className="font-semibold text-lg">{t("list.heading")}</h3>
        {list.status === "loading" && (
          <p className="text-muted-foreground text-sm">{t("list.loading")}</p>
        )}
        {list.status === "error" && (
          <div role="alert" className="flex items-center gap-2">
            <p className="text-destructive text-sm">{t("list.error")}</p>
            <Button variant="outline" size="sm" onPress={list.refresh}>
              {t("list.retry")}
            </Button>
          </div>
        )}
        {list.status === "ready" && list.events.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("list.empty")}</p>
        )}
        {list.status === "ready" && list.events.length > 0 && (
          <ul className="divide-y rounded-md border">
            {list.events.map((event) => (
              <li
                key={event.eventId}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Link
                    href={managementPath(event.eventId)}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {event.name}
                  </Link>
                  <span className="rounded-full border px-2 py-0.5 text-muted-foreground text-xs">
                    {t(`status.${event.status}`)}
                  </span>
                </div>
                {ARCHIVABLE_STATUSES.has(event.status) && (
                  <ArchiveEventDialog event={event} onArchived={list.refresh} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
