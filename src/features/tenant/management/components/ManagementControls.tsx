import { LocaleSelect } from "@/components/locale-select";
import { PwaInstall } from "@/components/pwa/pwa-install";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/features/auth/LogoutButton";

export function ManagementControls({
  install = false,
  logout = true,
}: {
  install?: boolean;
  logout?: boolean;
}) {
  return (
    <>
      {install && <PwaInstall compact />}
      <LocaleSelect />
      <ThemeToggle />
      {logout && <LogoutButton />}
    </>
  );
}
