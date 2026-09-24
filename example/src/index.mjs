import { trace } from '@opentelemetry/api';
import { envDetector, hostDetector, processDetector } from '@opentelemetry/resources';
import { NodeSDK, tracing } from '@opentelemetry/sdk-node';
import { ngrvDetector } from 'ngrv/otel';

const sdk = new NodeSDK({
  resourceDetectors: [
    ngrvDetector({ file: new URL('../build-info.json', import.meta.url) }),
    processDetector,
    hostDetector,
    envDetector,
  ],
  traceExporter: new tracing.ConsoleSpanExporter(),
  logRecordProcessors: [],
});

sdk.start();
trace.getTracer('ngrv-example').startSpan('example-request').end();
await sdk.shutdown();
