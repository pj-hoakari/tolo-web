"use client";

import { createContext, type ReactNode, useContext } from "react";
import { useScreenWakeLock } from "../hooks/useScreenWakeLock";

type ScreenWakeContextValue = {
  isSupported: boolean;
  enabled: boolean;
  isActive: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
};

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
