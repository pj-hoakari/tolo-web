import { useTranslations } from "next-intl";
import type { ComponentProps, ReactNode } from "react";
import { StatusBadge } from "../components/StatusBadge";
import type { EventStatus } from "./type";

const tones = {
  draft: "info",
  open: "positive",
  locked: "warning",
  closed: "neutral",
  archived: "neutral",
} satisfies Record<EventStatus, ComponentProps<typeof StatusBadge>["tone"]>;

export function EventStatusBadge({
  status,
  children,
}: {
  status: EventStatus;
  children?: ReactNode;
}) {
  const t = useTranslations("TenantManagement.status");
  return (
    <StatusBadge tone={tones[status]}>
      {t(status)}
      {children}
    </StatusBadge>
  );
}
