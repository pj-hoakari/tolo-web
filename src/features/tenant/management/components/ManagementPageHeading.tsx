import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ManagementNavigation } from "./ManagementShell";

export function ManagementPageHeading({
  title,
  navigation,
  className,
}: {
  title: string;
  navigation?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6",
        className,
      )}
    >
      <h2 className="text-2xl font-bold wrap-anywhere">{title}</h2>
      {navigation && (
        <ManagementNavigation aria-label={title}>
          {navigation}
        </ManagementNavigation>
      )}
    </div>
  );
}
