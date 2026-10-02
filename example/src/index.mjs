import { trace } from "@opentelemetry/api";
import {
  envDetector,
  hostDetector,
  processDetector,
} from "@opentelemetry/resources";
import { NodeSDK, tracing } from "@opentelemetry/sdk-node";
import { birthplaceDetector } from "birthplace/otel";

const sdk = new NodeSDK({
  resourceDetectors: [
    birthplaceDetector({
      file: new URL("../birthplace.json", import.meta.url),
    }),
    processDetector,
    hostDetector,
    envDetector,
  ],
  traceExporter: new tracing.ConsoleSpanExporter(),
  logRecordProcessors: [],
});

sdk.start();
trace.getTracer("birthplace-example").startSpan("example-request").end();
await sdk.shutdown();
