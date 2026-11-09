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

type NamedInstances = { db?: Firestore; auth?: Auth };

const globalForFirestore = globalThis as unknown as {
  __toloWebDb?: Firestore;
  __toloWebAuth?: Auth;
  __toloWebNamed?: Map<string, NamedInstances>;
};

function namedInstances(): Map<string, NamedInstances> {
  globalForFirestore.__toloWebNamed ??= new Map();
  return globalForFirestore.__toloWebNamed;
}

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

function appOptions(config: FirebaseConfig) {
  return {
    projectId: config.projectId,
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    appId: config.appId,
  };
}

function getDefaultApp(config: FirebaseConfig): FirebaseApp {
  return (
    getApps().find((app) => app.name === "[DEFAULT]") ??
    initializeApp(appOptions(config))
  );
}

function getNamedApp(config: FirebaseConfig, name: string): FirebaseApp {
  return (
    getApps().find((app) => app.name === name) ??
    initializeApp(appOptions(config), name)
  );
}

function createDb(config: FirebaseConfig, app: FirebaseApp): Firestore {
  const emulator = emulatorEndpoint(config.firestoreEmulatorHost, 8080);
  if (emulator?.ssl) {
    return initializeFirestore(app, {
      host: emulator.host,
      ssl: true,
    });
  }
  const db = getFirestore(app);
  if (emulator) connectFirestoreEmulator(db, emulator.host, emulator.port);
  return db;
}

function createAuth(config: FirebaseConfig, app: FirebaseApp): Auth {
  const auth = initializeAuth(app, {
    persistence: inMemoryPersistence,
  });

  const emulator = emulatorEndpoint(config.authEmulatorHost, 9099);
  if (emulator) {
    const origin = emulator.ssl
      ? `https://${emulator.host}`
      : `http://${emulator.host}:${emulator.port}`;
    connectAuthEmulator(auth, origin, { disableWarnings: true });
  }

  return auth;
}

export function getDb(config: FirebaseConfig): Firestore {
  if (globalForFirestore.__toloWebDb) {
    return globalForFirestore.__toloWebDb;
  }

  const db = createDb(config, getDefaultApp(config));
  globalForFirestore.__toloWebDb = db;
  return db;
}

export function getAuth(config: FirebaseConfig): Auth {
  if (globalForFirestore.__toloWebAuth) {
    return globalForFirestore.__toloWebAuth;
  }

  const auth = createAuth(config, getDefaultApp(config));
  globalForFirestore.__toloWebAuth = auth;
  return auth;
}

/**
 * 既定アプリとは別の Firebase アプリを使う。観測ページは
 * 「観測ページ自身の edge 役」と「ESP カメラの console 役」を同時に持つため、
 * 認証インスタンスを分ける必要がある。
 */
export function getNamedAuth(config: FirebaseConfig, name: string): Auth {
  const instances = namedInstances();
  const current = instances.get(name) ?? {};
  instances.set(name, current);
  if (current.auth) {
    return current.auth;
  }

  current.auth = createAuth(config, getNamedApp(config, name));
  return current.auth;
}

export function getNamedDb(config: FirebaseConfig, name: string): Firestore {
  const instances = namedInstances();
  const current = instances.get(name) ?? {};
  instances.set(name, current);
  if (current.db) {
    return current.db;
  }

  // Firestore が認証プロバイダを参照できるよう、Auth を先に用意する。
  getNamedAuth(config, name);
  current.db = createDb(config, getNamedApp(config, name));
  return current.db;
}
