import { connection } from "next/server";
import { FirebaseConfigProvider } from "@/features/tenant/webrtc/components/FirebaseConfigProvider";
import { readFirebaseConfig } from "@/features/tenant/webrtc/utils/firebaseConfig";

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  return (
    <FirebaseConfigProvider config={readFirebaseConfig()}>
      {children}
    </FirebaseConfigProvider>
  );
}
