import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { readAuthEnv } from "./server/auth/betterAuth";
import { authMockingEnabled } from "./server/auth/mocking";

if (
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
) {
  new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME || "tolo-web",
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [],
    logRecordProcessors: [],
  }).start();
}

try {
  if (!authMockingEnabled()) readAuthEnv();
} catch (err) {
  console.error(err);
  process.exit(1);
}
