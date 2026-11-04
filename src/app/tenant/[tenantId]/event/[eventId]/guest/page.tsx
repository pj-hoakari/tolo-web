import type { Viewport } from "next";
import { getPwaMetadata } from "@/lib/pwa/manifest";
import { GuestPage } from "./_components/GuestPage";

/**
 * スマホ向けの表示設定。ノッチ・ホームバーの裏まで画面を使い（余白は env(safe-area-inset-*) で取る）、
 * ブラウザ上部の色をゲスト画面の背景（ライト / ダーク）に合わせる。
 */
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6ef" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1815" },
  ],
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  return getPwaMetadata(`/event/${encodeURIComponent(eventId)}/guest`);
}

export default async function TenantGuest({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;
  return <GuestPage tenantId={tenantId} eventId={eventId} qrLocationId="" />;
}
