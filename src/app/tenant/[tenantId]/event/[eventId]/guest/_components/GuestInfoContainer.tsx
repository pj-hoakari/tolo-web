import {
  type GuestInfoComponent,
  getGuestInfoComponentId,
} from "@/features/guest/info/type";

/** 1 行に並べるモジュール。配列で渡すとその行は横並び（グリッド）になる */
export type GuestInfoRow = GuestInfoComponent | GuestInfoComponent[];

export type GuestInfoContainerProps = {
  tenantId: string;
  eventId: string;
  rows: GuestInfoRow[];
};

function getRowKey(row: GuestInfoRow): string {
  return Array.isArray(row)
    ? row.map(getGuestInfoComponentId).join("-")
    : getGuestInfoComponentId(row);
}

export function GuestInfoContainer({
  tenantId,
  eventId,
  rows,
}: GuestInfoContainerProps) {
  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => {
        if (Array.isArray(row)) {
          return (
            <div key={getRowKey(row)} className="grid grid-cols-2 gap-4">
              {row.map((Component) => (
                <Component
                  key={getGuestInfoComponentId(Component)}
                  tenantId={tenantId}
                  eventId={eventId}
                />
              ))}
            </div>
          );
        }

        const Component = row;
        return (
          <div className="w-full" key={getRowKey(row)}>
            <Component tenantId={tenantId} eventId={eventId} />
          </div>
        );
      })}
    </div>
  );
}
