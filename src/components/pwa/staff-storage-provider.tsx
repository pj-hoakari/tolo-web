"use client";

import { createContext, Fragment, type ReactNode, useContext } from "react";

const StaffStorageContext = createContext<string | undefined>(undefined);

export function StaffStorageProvider({
  scope,
  children,
}: {
  scope: string;
  children: ReactNode;
}) {
  return (
    <StaffStorageContext.Provider value={scope}>
      <Fragment key={scope}>{children}</Fragment>
    </StaffStorageContext.Provider>
  );
}

export function useStaffStorageScope(): string {
  const scope = useContext(StaffStorageContext);
  if (typeof scope !== "string" || !scope.trim()) {
    throw new Error(
      "useStaffStorageScope requires a valid scope from StaffStorageProvider.",
    );
  }
  return scope;
}
