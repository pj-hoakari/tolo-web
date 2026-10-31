import type { ReactNode } from "react";
import { LocaleSelect } from "@/components/locale-select";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthScreen({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex w-full items-center justify-between px-10 py-5">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex items-center gap-2">
          <LocaleSelect />
          <ThemeToggle />
        </div>
      </header>
      <main className="flex w-full flex-1 justify-center px-10 py-5">
        <div className="flex w-full max-w-md flex-col items-start gap-4">
          {children}
        </div>
      </main>
    </div>
  );
}
