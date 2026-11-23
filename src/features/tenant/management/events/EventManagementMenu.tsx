"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopover, MenuTrigger } from "@/components/ui/menu";
import { guideMapEditPath } from "@/features/guide-map-studio/routes";
import { observationPath } from "@/features/tenant/observation/routes";
import { managementPath } from "../routes";
import {
  type EventNavigationAccess,
  getEventNavigationAccess,
} from "./navigationAccess";
import type { TenantEvent } from "./type";

type Props = {
  event: TenantEvent;
  rememberList: () => void;
};

export function EventManagementMenu({
  event: { eventId, name },
  rememberList,
}: Props) {
  const t = useTranslations("TenantManagement.list");
  const tManagement = useTranslations("Management");
  const tObservation = useTranslations("ObservationDevices");
  const [isOpen, setIsOpen] = useState(false);
  const [access, setAccess] = useState<EventNavigationAccess | null>(null);
  const label = t("openLabel", { name });

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    getEventNavigationAccess(eventId).then(
      (result) => {
        if (active) setAccess(result);
      },
      () => {
        if (active) setAccess(null);
      },
    );
    return () => {
      active = false;
    };
  }, [eventId, isOpen]);

  return (
    <MenuTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        setAccess(null);
        setIsOpen(open);
      }}
    >
      <Button
        variant="outline"
        size="sm"
        className="group min-h-11 w-full gap-1 px-2 lg:min-h-8 lg:text-xs"
        aria-label={label}
      >
        {t("open")}
        <ChevronDown
          aria-hidden
          className="size-3 shrink-0 group-aria-expanded:rotate-180"
        />
      </Button>
      <MenuPopover placement="bottom end" className="max-w-[calc(100vw-2rem)]">
        <Menu aria-label={label}>
          <MenuItem
            href={managementPath(eventId)}
            onAction={rememberList}
            className="min-h-11"
          >
            {tObservation("managementLink")}
          </MenuItem>
          {access?.canEditGuideMap && (
            <MenuItem
              href={guideMapEditPath(eventId)}
              onAction={rememberList}
              className="min-h-11"
            >
              {tManagement("guideMapEditLink")}
            </MenuItem>
          )}
          {access?.canViewObservationDevices && (
            <MenuItem
              href={observationPath(eventId)}
              onAction={rememberList}
              className="min-h-11"
            >
              {tManagement("observationDevicesLink")}
            </MenuItem>
          )}
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  );
}
