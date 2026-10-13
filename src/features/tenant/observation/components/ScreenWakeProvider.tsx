"use client";

import { createContext, type ReactNode, useContext } from "react";
import {
  type UseScreenWakeLockResult,
  useScreenWakeLock,
} from "../hooks/useScreenWakeLock";

type ScreenWakeContextValue = UseScreenWakeLockResult;

const ScreenWakeContext = createContext<ScreenWakeContextValue | null>(null);

export type ScreenWakeProviderProps = {
  children: ReactNode;
};

export function ScreenWakeProvider({ children }: ScreenWakeProviderProps) {
  const wakeLock = useScreenWakeLock();

  return (
    <ScreenWakeContext.Provider value={wakeLock}>
      {children}
    </ScreenWakeContext.Provider>
  );
}

export function useScreenWake(): ScreenWakeContextValue {
  const context = useContext(ScreenWakeContext);
  if (context === null) {
    throw new Error("useScreenWake must be used within a ScreenWakeProvider");
  }
  return context;
}
