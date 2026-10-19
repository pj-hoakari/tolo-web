export type FirebaseConfig = {
  projectId: string;
  apiKey: string;
  authDomain?: string;
  appId?: string;
  firestoreEmulatorHost?: string;
  authEmulatorHost?: string;
};

export function readFirebaseConfig(
  env: Record<string, string | undefined> = process.env,
): FirebaseConfig {
  return {
    projectId: env.FIREBASE_PROJECT_ID ?? "tolo-signaling",
    apiKey: env.FIREBASE_API_KEY ?? "demo-tolo-web",
    authDomain: env.FIREBASE_AUTH_DOMAIN,
    appId: env.FIREBASE_APP_ID,
    firestoreEmulatorHost: env.FIRESTORE_EMULATOR_HOST,
    authEmulatorHost: env.FIREBASE_AUTH_EMULATOR_HOST,
  };
}
