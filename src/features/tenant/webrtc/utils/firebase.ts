import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  type Auth,
  connectAuthEmulator,
  initializeAuth,
  inMemoryPersistence,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
  initializeFirestore,
} from "firebase/firestore";
import type { FirebaseConfig } from "./firebaseConfig";

const globalForFirestore = globalThis as unknown as {
  __toloWebDb?: Firestore;
  __toloWebAuth?: Auth;
};

function parseHostPort(
  value: string,
  fallbackPort: number,
): { host: string; port: number } {
  const [host, port] = value.split(":");
  return { host: host || "127.0.0.1", port: Number(port) || fallbackPort };
}

function emulatorEndpoint(
  configuredHost: string | undefined,
  fallbackPort: number,
  page: Pick<Location, "protocol" | "host"> | undefined = globalThis.location,
):
  | { ssl: true; host: string }
  | { ssl: false; host: string; port: number }
  | undefined {
  if (!configuredHost) return undefined;
  if (page?.protocol === "https:") return { ssl: true, host: page.host };
  return { ssl: false, ...parseHostPort(configuredHost, fallbackPort) };
}

function getApp(config: FirebaseConfig): FirebaseApp {
  return (
    getApps()[0] ??
    initializeApp({
      projectId: config.projectId,
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      appId: config.appId,
    })
  );
}

export function getDb(config: FirebaseConfig): Firestore {
  if (globalForFirestore.__toloWebDb) {
    return globalForFirestore.__toloWebDb;
  }

  const emulator = emulatorEndpoint(config.firestoreEmulatorHost, 8080);
  let db: Firestore;
  if (emulator?.ssl) {
    db = initializeFirestore(getApp(config), {
      host: emulator.host,
      ssl: true,
    });
  } else {
    db = getFirestore(getApp(config));
    if (emulator) connectFirestoreEmulator(db, emulator.host, emulator.port);
  }

  globalForFirestore.__toloWebDb = db;
  return db;
}

export function getAuth(config: FirebaseConfig): Auth {
  if (globalForFirestore.__toloWebAuth) {
    return globalForFirestore.__toloWebAuth;
  }

  const auth = initializeAuth(getApp(config), {
    persistence: inMemoryPersistence,
  });

  const emulator = emulatorEndpoint(config.authEmulatorHost, 9099);
  if (emulator) {
    const origin = emulator.ssl
      ? `https://${emulator.host}`
      : `http://${emulator.host}:${emulator.port}`;
    connectAuthEmulator(auth, origin, { disableWarnings: true });
  }

  globalForFirestore.__toloWebAuth = auth;
  return auth;
}
