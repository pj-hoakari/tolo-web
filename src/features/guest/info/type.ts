import type { ComponentType } from "react";

export type GuestInfoComponentProps = {
  tenantId: string;
  eventId: string;
};

/**
 * グリッド上で占有する列数
 * - `2`（既定）: 1 行全体を占有する基本サイズ（`col-span-2`）
 * - `1`: 横に 2 つ並ぶ小さいサイズ（`col-span-1`）
 */
export type GuestInfoComponentSpan = 1 | 2;

export type GuestInfoComponentOptions = {
  span?: GuestInfoComponentSpan;
};

type GuestInfoComponentMeta = {
  id: string;
  span: GuestInfoComponentSpan;
};

const guestInfoSymbol: unique symbol = Symbol("guestInfoComponentId");

export type GuestInfoComponent = ComponentType<GuestInfoComponentProps> & {
  readonly [guestInfoSymbol]: GuestInfoComponentMeta;
};

export function defineGuestInfoComponent(
  id: string,
  component: ComponentType<GuestInfoComponentProps>,
  options?: GuestInfoComponentOptions,
): GuestInfoComponent {
  return Object.assign(component, {
    [guestInfoSymbol]: {
      id,
      span: options?.span ?? 2,
    } satisfies GuestInfoComponentMeta,
  }) as GuestInfoComponent;
}

export function getGuestInfoComponentId(component: GuestInfoComponent): string {
  return component[guestInfoSymbol].id;
}

export function getGuestInfoComponentSpan(
  component: GuestInfoComponent,
): GuestInfoComponentSpan {
  return component[guestInfoSymbol].span;
}
