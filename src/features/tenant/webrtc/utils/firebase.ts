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

  const db = getFirestore(getApp());

  const emulatorHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST;
  if (emulatorHost) {
    const { host, port } = parseHostPort(emulatorHost, 8080);
    connectFirestoreEmulator(db, host, port);
  }

  globalForFirestore.__toloWebDb = db;
  return db;
}

export function getAuth(): Auth {
  if (globalForFirestore.__toloWebAuth) {
    return globalForFirestore.__toloWebAuth;
  }

  const auth = initializeAuth(getApp(), { persistence: inMemoryPersistence });

  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulatorHost) {
    const { host, port } = parseHostPort(emulatorHost, 9099);
    connectAuthEmulator(auth, `http://${host}:${port}`, {
      disableWarnings: true,
    });
  }

  globalForFirestore.__toloWebAuth = auth;
  return auth;
}
