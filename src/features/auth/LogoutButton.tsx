import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { authMockingEnabled } from "@/server/auth/mocking";

export function LogoutButton() {
  const t = useTranslations("Auth");
  if (authMockingEnabled()) return null;

  return (
    <form method="post" action="/auth/logout">
      <Button type="submit" variant="ghost" size="sm">
        {t("logout")}
      </Button>
    </form>
  );
}
