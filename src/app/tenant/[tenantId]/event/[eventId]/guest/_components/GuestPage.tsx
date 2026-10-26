"use client";

import "@/features/guest/guest-theme.css";
import { useEffect, useState } from "react";
import Congestion from "@/features/guest/info/Congestion";
import Floor from "@/features/guest/info/Floor";
import GuideMap from "@/features/guest/info/GuideMap";
import Queues from "@/features/guest/info/Queues";
import {
  type GuestInfoComponent,
  isGuestInfoComponentShown,
} from "@/features/guest/info/type";
import {
  DEFAULT_GUEST_PAGE_COMPONENTS,
  type GuestPageComponent,
} from "@/features/guest/pageComponents";
import { orpc } from "@/lib/orpc";
import { GuestHeader } from "./GuestHeader";
import { GuestInfoContainer } from "./GuestInfoContainer";

const SESSION_ID_KEY = "tolo:guest-session";

// 各コンポーネントが自身の span（col-span-1 / col-span-2）を宣言
// フラットな配列で並び順だけを指定
// 現在のフロアは案内マップの文脈なので、地図の直上に横長の帯として置く
const infoComponents: GuestInfoComponent[] = [
  Floor,
  GuideMap,
  Queues,
  Congestion,
];

function guestSessionId(): string {
  try {
    const stored = localStorage.getItem(SESSION_ID_KEY);
    if (stored) return stored;
    const created = crypto.randomUUID();
    localStorage.setItem(SESSION_ID_KEY, created);
    return created;
  } catch {
    return "";
  }
}

export type GuestPageProps = {
  tenantId: string;
  eventId: string;
  qrLocationId: string;
};

export function GuestPage({ tenantId, eventId, qrLocationId }: GuestPageProps) {
  // TODO: Fetch tenant details using tenantId
  const tenantName = tenantId;

  const [pageComponents, setPageComponents] = useState<
    readonly GuestPageComponent[]
  >([]);

  useEffect(() => {
    let active = true;
    orpc.guest
      .openGuestPage({ eventId, qrLocationId, sessionId: guestSessionId() })
      .then(
        ({ components }) => {
          if (active) setPageComponents(components);
        },
        () => {
          if (active) setPageComponents(DEFAULT_GUEST_PAGE_COMPONENTS);
        },
      );
    return () => {
      active = false;
    };
  }, [eventId, qrLocationId]);

  return (
    <div className="guest-theme guest-glow min-h-full">
      <GuestHeader
        tenantName={tenantName}
        tenantId={tenantId}
        eventId={eventId}
        showStaffMessages={pageComponents.includes("staffMessages")}
      />
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <GuestInfoContainer
          tenantId={tenantId}
          eventId={eventId}
          qrLocationId={qrLocationId}
          components={infoComponents.filter((component) =>
            isGuestInfoComponentShown(component, pageComponents),
          )}
        />
      </main>
    </div>
  );
}
