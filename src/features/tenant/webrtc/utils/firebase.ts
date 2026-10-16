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

function getApp(): FirebaseApp {
  return (
    getApps()[0] ??
    initializeApp({
      projectId:
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "tolo-signaling",
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "demo-tolo-web",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    })
  );
}

export function getDb(): Firestore {
  if (globalForFirestore.__toloWebDb) {
    return globalForFirestore.__toloWebDb;
  }

  const emulator = emulatorEndpoint(
    process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST,
    8080,
  );
  let db: Firestore;
  if (emulator?.ssl) {
    db = initializeFirestore(getApp(), { host: emulator.host, ssl: true });
  } else {
    db = getFirestore(getApp());
    if (emulator) connectFirestoreEmulator(db, emulator.host, emulator.port);
  }

  globalForFirestore.__toloWebDb = db;
  return db;
}

export function getAuth(): Auth {
  if (globalForFirestore.__toloWebAuth) {
    return globalForFirestore.__toloWebAuth;
  }

  const auth = initializeAuth(getApp(), { persistence: inMemoryPersistence });

  const emulator = emulatorEndpoint(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
    9099,
  );
  if (emulator) {
    const origin = emulator.ssl
      ? `https://${emulator.host}`
      : `http://${emulator.host}:${emulator.port}`;
    connectAuthEmulator(auth, origin, { disableWarnings: true });
  }

  globalForFirestore.__toloWebAuth = auth;
  return auth;
}
