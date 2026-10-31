import { setBrowserMockingReady } from "@/mocks/browserReady";

if (process.env.NEXT_PUBLIC_API_MOCKING === "enabled") {
  setBrowserMockingReady(
    import("@/mocks/browser").then(({ startWorker }) => startWorker()),
  );
}
