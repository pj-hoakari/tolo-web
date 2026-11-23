"use client";

import { usePathname } from "next/navigation";
import { EventListBackLink } from "../events/EventListBackLink";

export function ManagementHomeTitle({
  title,
  tenantId,
  staff,
}: {
  title: string;
  tenantId: string;
  staff: boolean;
}) {
  const pathname = usePathname();
  const onEventList = pathname === "/management";

  if (staff && !onEventList) {
    return <EventListBackLink key={pathname} tenantId={tenantId} />;
  }

  return (
    <h1
      aria-current={onEventList ? "page" : undefined}
      className="min-w-0 text-lg font-semibold tracking-tight wrap-anywhere"
    >
      {title}
    </h1>
  );
}
