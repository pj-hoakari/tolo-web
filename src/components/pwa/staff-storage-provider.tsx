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

export function useStaffStorageScope() {
  return useContext(StaffStorageContext);
}
