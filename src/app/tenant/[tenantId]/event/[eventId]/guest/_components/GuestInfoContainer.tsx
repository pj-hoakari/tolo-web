import {
  type GuestInfoComponent,
  getGuestInfoComponentId,
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
    <div className="flex flex-col gap-4">
      {components.map((Component) => (
        <div className="w-full" key={getGuestInfoComponentId(Component)}>
          <Component tenantId={tenantId} eventId={eventId} />
        </div>
      ))}
    </div>
  );
}
