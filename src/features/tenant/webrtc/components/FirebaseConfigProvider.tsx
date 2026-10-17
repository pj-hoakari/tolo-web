"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import type { FirebaseConfig } from "../utils/firebaseConfig";

const FirebaseConfigContext = createContext<FirebaseConfig | null>(null);

export type FirebaseConfigProviderProps = {
  config: FirebaseConfig;
  children: ReactNode;
};

export function FirebaseConfigProvider({
  config,
  children,
}: FirebaseConfigProviderProps) {
  const [value] = useState(config);

  return (
    <FirebaseConfigContext.Provider value={value}>
      {children}
    </FirebaseConfigContext.Provider>
  );
}

export function useFirebaseConfig(): FirebaseConfig {
  const context = useContext(FirebaseConfigContext);
  if (context === null) {
    throw new Error(
      "useFirebaseConfig must be used within a FirebaseConfigProvider",
    );
  }
  return context;
}
