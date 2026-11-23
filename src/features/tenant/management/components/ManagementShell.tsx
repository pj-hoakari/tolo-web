import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./management-shell.module.css";

export function ManagementShell({
  header,
  children,
}: {
  header: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      data-management-shell
      className={cn(styles.shell, "min-h-dvh min-w-0 flex-1 bg-background")}
    >
      {header}
      {children}
    </div>
  );
}

export function ManagementBanner({
  className,
  ...props
}: ComponentProps<"header">) {
  return (
    <header className={cn("w-full min-w-0 shrink-0", className)} {...props} />
  );
}

export function ManagementMain({
  className,
  ...props
}: ComponentProps<"main">) {
  return <main className={cn("min-w-0 flex-1", className)} {...props} />;
}

export function ManagementNavigation({
  className,
  ...props
}: ComponentProps<"nav">) {
  return (
    <nav
      className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}
