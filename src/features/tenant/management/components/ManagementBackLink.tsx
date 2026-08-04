import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/components/ui/link";
import { managementPath } from "../routes";

type Props = {
  eventId: string;
};

/** 管理ページへ戻る導線（編集ページ用） */
export function ManagementBackLink({ eventId }: Props) {
  const t = useTranslations("Management");

  return (
    <Link
      href={managementPath(eventId)}
      variant="ghost"
      size="sm"
      className="gap-1.5"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {t("backLink")}
    </Link>
  );
}
