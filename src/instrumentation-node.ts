import { authMockingEnabled } from "./server/auth/mocking";

try {
  authMockingEnabled();
} catch (err) {
  console.error(err);
  process.exit(1);
}
