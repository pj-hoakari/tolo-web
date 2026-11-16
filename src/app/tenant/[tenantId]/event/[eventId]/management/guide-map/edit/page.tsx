import { LocaleSelect } from "@/components/locale-select";
import { StaffOnlineBoundary } from "@/components/pwa/staff-online-boundary";
import { StaffStorageProvider } from "@/components/pwa/staff-storage-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/features/auth/LogoutButton";
import { GuideMapStudioTitle } from "@/features/guide-map-studio/editor/GuideMapStudioTitle";
import { VenueMapStudio } from "@/features/guide-map-studio/editor/VenueMapStudio";
import { guideMapEditPath } from "@/features/guide-map-studio/routes";
import { ManagementBackLink } from "@/features/tenant/management/components/ManagementBackLink";
import { getStaffPwaMetadata } from "@/lib/pwa/staff-manifest";
import { createStaffStorageScope } from "@/lib/pwa/staff-storage";
import { getViewer, requireStaff } from "@/server/auth";

export function generateMetadata() {
  return getStaffPwaMetadata();
}

export default async function TenantGuideMapEdit({
  params,
}: {
  params: Promise<{ tenantId: string; eventId: string }>;
}) {
  const { tenantId, eventId } = await params;
  await requireStaff(guideMapEditPath(eventId));
  const viewer = await getViewer();

  // 地図を大きく使う作業画面なので、戻るリンク・見出しと、言語・テーマなどの切り替えをスタジオの上の帯にまとめ、
  // 画面いっぱいをスタジオにする（帯を 1 段にして、地図を広く使う）
  return (
    <StaffOnlineBoundary>
      <StaffStorageProvider scope={createStaffStorageScope(tenantId, viewer)}>
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
                <LocaleSelect />
                <ThemeToggle />
                <LogoutButton />
              </>
            }
          />
        </div>
      </StaffStorageProvider>
    </StaffOnlineBoundary>
  );
}
