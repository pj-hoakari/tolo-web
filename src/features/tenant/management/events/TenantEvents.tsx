"use client";

import {
  Archive,
  CalendarDays,
  CheckCircle2,
  FileText,
  Layers,
  List,
  Lock,
  Radio,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "@/components/ui/link";
import { Toggle, ToggleButtonGroup } from "@/components/ui/toggle";
import { matchesSearch } from "@/lib/matchesSearch";
import { ListFilters } from "../components/ListFilters";
import { managementPath } from "../routes";
import { ArchiveEventDialog } from "./ArchiveEventDialog";
import { CreateEventForm } from "./CreateEventForm";
import { EventId } from "./EventId";
import { EventStatusControl } from "./EventStatusControl";
import { RestoreEventButton } from "./RestoreEventButton";
import {
  ARCHIVABLE_STATUSES,
  type EventStatus,
  RESTORABLE_STATUSES,
} from "./type";
import { useTenantEvents } from "./useTenantEvents";

type Props = {
  tenantId: string;
  header: ReactNode;
};

export function TenantEvents({ tenantId, header }: Props) {
  const t = useTranslations("TenantManagement");
  const tManagement = useTranslations("Management");
  const tFilters = useTranslations("Management.filters");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<EventStatus | "all">(
    "all",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const list = useTenantEvents(tenantId, includeArchived);
  const visibleEvents =
    list.events?.filter(
      (event) =>
        (selectedStatus === "all" || event.status === selectedStatus) &&
        matchesSearch(query, event.name, event.eventId),
    ) ?? [];

  function selectStatus(value: EventStatus | "all") {
    setSelectedStatus(value);
    if (value === "archived") setIncludeArchived(true);
  }

  function handleCreated() {
    setQuery("");
    setSelectedStatus("all");
    setNotice(t("create.success"));
    list.refresh();
  }

  const views = [
    { id: "all", label: t("workspace.allEvents"), icon: List },
    { id: "draft", label: t("status.draft"), icon: FileText },
    { id: "open", label: t("status.open"), icon: Radio },
    { id: "locked", label: t("status.locked"), icon: Lock },
    { id: "closed", label: t("status.closed"), icon: CheckCircle2 },
    { id: "archived", label: t("status.archived"), icon: Archive },
  ] as const;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-border border-r bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-[73px] shrink-0 items-center gap-3 px-5">
          <span className="flex size-8 items-center justify-center rounded-lg border border-sidebar-border bg-background">
            <Layers aria-hidden className="size-4" />
          </span>
          <span className="font-semibold text-base tracking-tight">
            {t("workspace.brand")}
          </span>
        </div>
        <div className="px-4 pt-4 pb-8">
          <CreateEventForm
            tenantId={tenantId}
            onCreated={handleCreated}
            triggerClassName="w-full justify-start"
          />
        </div>
        <nav aria-label={t("workspace.navigation")} className="px-3">
          <p className="mb-3 px-3 font-medium text-muted-foreground text-xs">
            {t("list.heading")}
          </p>
          <ToggleButtonGroup
            orientation="vertical"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[selectedStatus]}
            onSelectionChange={(keys) => {
              const view = views.find((item) => keys.has(item.id));
              if (view) selectStatus(view.id);
            }}
            aria-label={t("workspace.navigation")}
            className="items-stretch gap-1"
          >
            {views.map(({ id, label, icon: Icon }) => (
              <Toggle
                key={id}
                id={id}
                className="relative h-10 justify-start gap-3 selected:bg-primary/10 px-3 selected:font-semibold selected:text-foreground text-sidebar-foreground/70 hover:bg-sidebar-accent selected:hover:bg-primary/15 hover:text-sidebar-accent-foreground dark:selected:bg-sidebar-accent dark:selected:font-medium dark:selected:text-sidebar-accent-foreground dark:selected:hover:bg-sidebar-accent"
              >
                {selectedStatus === id && (
                  <span
                    aria-hidden
                    className="absolute inset-y-2 left-0 w-1 rounded-r bg-primary dark:hidden"
                  />
                )}
                <Icon aria-hidden className="size-4 shrink-0" />
                <span>{label}</span>
              </Toggle>
            ))}
          </ToggleButtonGroup>
        </nav>
        <div className="mt-auto border-sidebar-border border-t px-5 py-5 text-muted-foreground text-xs">
          <p className="break-all leading-5">
            {tManagement("tenantId", { id: tenantId })}
          </p>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {header}
        <main className="min-w-0 flex-1">
          <div className="flex justify-end border-border border-b px-4 py-3 lg:hidden">
            <CreateEventForm tenantId={tenantId} onCreated={handleCreated} />
          </div>
          {notice && (
            <p
              role="status"
              className="border-border border-b bg-muted/40 px-4 py-3 text-sm sm:px-6"
            >
              {notice}
            </p>
          )}
          <section
            aria-label={t("list.heading")}
            className="min-w-0 bg-background text-foreground"
          >
            <div className="border-border border-b px-4 py-4 sm:px-6">
              <ListFilters<EventStatus | "all">
                query={query}
                onQueryChange={setQuery}
                searchLabel={t("list.search")}
                filterLabel={t("list.state")}
                selected={selectedStatus}
                onSelectionChange={selectStatus}
                options={[
                  { id: "all", label: t("list.allStatuses") },
                  ...(
                    ["draft", "open", "locked", "closed", "archived"] as const
                  ).map((id) => ({ id, label: t(`status.${id}`) })),
                ]}
                resetLabel={tFilters("reset")}
                isResetDisabled={
                  !query && selectedStatus === "all" && !includeArchived
                }
                onReset={() => {
                  setQuery("");
                  setSelectedStatus("all");
                  setIncludeArchived(false);
                }}
                additionalFilters={
                  <Checkbox
                    className="min-h-10 text-sm"
                    isSelected={includeArchived}
                    onChange={(value) => {
                      setIncludeArchived(value);
                      if (!value && selectedStatus === "archived")
                        setSelectedStatus("all");
                      setNotice(null);
                    }}
                  >
                    {t("list.showArchived")}
                  </Checkbox>
                }
              />
            </div>
            <div className="grid grid-cols-1 items-center gap-4 border-border border-b bg-muted/40 px-4 py-3 sm:px-6 md:grid-cols-[minmax(0,1fr)_8rem_10rem]">
              <div className="flex min-w-0 items-center gap-2">
                <CalendarDays
                  aria-hidden
                  className="size-4 text-muted-foreground"
                />
                <h2 className="font-medium text-sm">{t("list.heading")}</h2>
                {list.status === "ready" && (
                  <p
                    role="status"
                    className="text-muted-foreground text-xs tabular-nums"
                  >
                    {query.trim() || selectedStatus !== "all"
                      ? t("list.results", {
                          shown: visibleEvents.length,
                          total: list.events.length,
                        })
                      : t("list.count", { count: list.events.length })}
                  </p>
                )}
              </div>
              <span
                aria-hidden
                className="hidden text-muted-foreground text-xs md:block"
              >
                {t("list.state")}
              </span>
              <span
                aria-hidden
                className="hidden text-right text-muted-foreground text-xs md:block"
              >
                {t("list.actions")}
              </span>
            </div>
            {list.status === "loading" && (
              <p
                role="status"
                className="px-6 py-10 text-muted-foreground text-sm"
              >
                {t("list.loading")}
              </p>
            )}
            {list.status === "error" && (
              <div
                role="alert"
                className="flex flex-wrap items-center gap-3 px-6 py-10"
              >
                <p className="text-destructive text-sm">{t("list.error")}</p>
                <Button variant="outline" size="sm" onPress={list.refresh}>
                  {t("list.retry")}
                </Button>
              </div>
            )}
            {list.status === "ready" && list.events.length === 0 && (
              <p className="px-6 py-10 text-muted-foreground text-sm">
                {t("list.empty")}
              </p>
            )}
            {list.status === "ready" &&
              list.events.length > 0 &&
              visibleEvents.length === 0 && (
                <p className="px-6 py-10 text-muted-foreground text-sm">
                  {t("list.noResults")}
                </p>
              )}
            {list.status === "ready" && visibleEvents.length > 0 && (
              <ul className="divide-y divide-border">
                {visibleEvents.map((event) => (
                  <li
                    key={event.eventId}
                    className="grid grid-cols-[minmax(0,1fr)_9rem] items-center gap-x-4 gap-y-2 px-4 py-2 transition-colors duration-150 focus-within:bg-muted/50 hover:bg-muted/50 sm:px-6 md:min-h-16 md:grid-cols-[minmax(0,1fr)_8rem_10rem]"
                  >
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      <Link
                        href={managementPath(event.eventId)}
                        className="block min-w-0 rounded-sm font-medium text-sm leading-5 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-ring"
                      >
                        <span title={event.name} className="block truncate">
                          {event.name}
                        </span>
                      </Link>
                      <EventId id={event.eventId} name={event.name} />
                    </div>
                    <div className="min-w-0">
                      <span className="sr-only">{t("list.state")}: </span>
                      <EventStatusControl
                        event={event}
                        onChanged={(updated) => {
                          setNotice(
                            t("transition.success", {
                              name: updated.name,
                              status: t(`status.${updated.status}`),
                            }),
                          );
                          list.refresh();
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2">
                      <Link
                        href={managementPath(event.eventId)}
                        variant="outline"
                        size="sm"
                        className="h-10 w-full md:h-8 md:text-xs"
                        aria-label={t("list.openLabel", { name: event.name })}
                      >
                        {t("list.open")}
                      </Link>
                      {ARCHIVABLE_STATUSES.has(event.status) ? (
                        <div className="justify-self-end">
                          <ArchiveEventDialog
                            event={event}
                            actionsLabel={t("list.moreActions", {
                              name: event.name,
                            })}
                            onArchived={() => {
                              setNotice(
                                t("archive.success", { name: event.name }),
                              );
                              list.refresh();
                            }}
                          />
                        </div>
                      ) : RESTORABLE_STATUSES.has(event.status) ? (
                        <RestoreEventButton
                          event={event}
                          onRestored={() => {
                            setNotice(
                              t("restore.success", { name: event.name }),
                            );
                            list.refresh();
                          }}
                        />
                      ) : (
                        <span aria-hidden />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
