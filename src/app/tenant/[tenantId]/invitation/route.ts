import { openInvitation } from "@/server/auth/invitation";

export function GET(request: Request) {
  return openInvitation(request);
}
