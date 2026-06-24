"use client";

import {
  type GuestInfoComponent,
  getGuestInfoComponentId,
  getGuestInfoComponentSpan,
} from "@/features/guest/info/type";

export type GuestInfoContainerProps = {
  tenantId: string;
  eventId: string;
  components: GuestInfoComponent[];
};

export function GuestInfoContainer({
  tenantId,
  eventId,
  components,
}: GuestInfoContainerProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {components.map((Component) => (
        <div
          key={getGuestInfoComponentId(Component)}
          className={
            getGuestInfoComponentSpan(Component) === 1
              ? "col-span-1"
              : "col-span-2"
          }
        >
          <Component tenantId={tenantId} eventId={eventId} />
        </div>
      ))}
    </div>
  );
}
