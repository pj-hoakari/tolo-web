import { LocaleSelect } from "@/components/locale-select";
import { PwaInstall } from "@/components/pwa/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { GuideMapStudioTitle } from "@/features/guide-map-studio/editor/GuideMapStudioTitle";
import { VenueMapStudio } from "@/features/guide-map-studio/editor/VenueMapStudio";
import { guideMapEditPath } from "@/features/guide-map-studio/routes";
import { ManagementBackLink } from "@/features/tenant/management/components/ManagementBackLink";
import { getPwaMetadata } from "@/lib/pwa/manifest";
import { requireStaff } from "@/server/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  return getPwaMetadata(
    `/event/${encodeURIComponent(eventId)}/management/guide-map/edit`,
  );
}

export default async function TenantGuideMapEdit({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { eventId } = await params;
  await requireStaff(guideMapEditPath(eventId));

  // 地図を大きく使う作業画面なので、戻るリンク・見出しと、言語・テーマなどの切り替えをスタジオの上の帯にまとめ、
  // 画面いっぱいをスタジオにする（帯を 1 段にして、地図を広く使う）
  return (
    <div className="h-dvh">
      <VenueMapStudio
        eventId={eventId}
        leading={
          <>
            <ManagementBackLink eventId={eventId} />
            {/* 狭い画面では見出しを隠して、マップのタブの場所を空ける */}
            <h1 className="hidden truncate text-sm font-semibold min-[1280px]:block">
              <GuideMapStudioTitle />
            </h1>
          </>
        }
        trailing={
          <>
            <PwaInstall compact />
            <LocaleSelect />
            <ThemeToggle />
            <LogoutButton />
          </>
        }
      />
    </div>
  );
}
