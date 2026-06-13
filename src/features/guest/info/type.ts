import type { ComponentType } from "react";

export type GuestInfoComponentProps = {
  tenantId: string;
  eventId: string;
};

const guestInfoSymbol: unique symbol = Symbol("guestInfoComponentId");

export type GuestInfoComponent = ComponentType<GuestInfoComponentProps> & {
  readonly [guestInfoSymbol]: string;
};

export function defineGuestInfoComponent(
  id: string,
  component: ComponentType<GuestInfoComponentProps>,
): GuestInfoComponent {
  return Object.assign(component, {
    [guestInfoSymbol]: id,
  }) as GuestInfoComponent;
}

export function getGuestInfoComponentId(component: GuestInfoComponent): string {
  return component[guestInfoSymbol];
}
