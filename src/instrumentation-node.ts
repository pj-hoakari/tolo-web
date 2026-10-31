import { readAuthEnv } from "./server/auth/betterAuth";
import { authMockingEnabled } from "./server/auth/mocking";

try {
  if (!authMockingEnabled()) readAuthEnv();
} catch (err) {
  console.error(err);
  process.exit(1);
}
