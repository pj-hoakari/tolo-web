import { ArrowLeft } from "lucide-react";
import { Link } from "@/components/ui/link";
import { managementPath } from "../routes";

type Props = {
  eventId: string;
};

/** 管理ページへ戻る導線（編集ページ用） */
export function ManagementBackLink({ eventId }: Props) {
  return (
    <Link
      href={managementPath(eventId)}
      variant="ghost"
      size="sm"
      className="gap-1.5"
    >
      <ArrowLeft aria-hidden className="size-4" />
      管理ページへ戻る
    </Link>
  );
}
