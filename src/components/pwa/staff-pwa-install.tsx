"use client";

import { PwaInstall } from "./pwa-install";
import { usePwaInstall } from "./pwa-provider";

/** Only A pages and the staff entry promote installation. Guest UI is separate. */
export function StaffPwaInstall({ compact = false }: { compact?: boolean }) {
  const { secure, platform, canPrompt } = usePwaInstall();
  if (!secure || (!canPrompt && platform === "other")) return null;
  return <PwaInstall compact={compact} />;
}
