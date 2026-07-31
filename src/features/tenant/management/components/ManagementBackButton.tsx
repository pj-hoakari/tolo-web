"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { managementPath } from "../routes";

type Props = {
  eventId: string;
};

/** 管理ページへ戻る導線（編集ページのヘッダ用） */
export function ManagementBackButton({ eventId }: Props) {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      onPress={() => router.push(managementPath(eventId))}
      className="gap-1.5"
    >
      <ArrowLeft aria-hidden className="size-4" />
      管理ページへ戻る
    </Button>
  );
}
