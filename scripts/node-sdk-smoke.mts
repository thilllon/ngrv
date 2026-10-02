import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import Module, { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { trace } from "@opentelemetry/api";
import {
  envDetector,
  hostDetector,
  processDetector,
} from "@opentelemetry/resources";
import { NodeSDK, type tracing } from "@opentelemetry/sdk-node";

const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const moduleLoader = Module as typeof Module & {
  _load(request: string, parent: unknown, isMain: boolean): unknown;
};
// `--info` hands the detector an imported ESM birthplace file instead of a JSON path.
const useInfo = process.argv.includes("--info");
const positionals = process.argv.slice(2).filter((arg) => arg !== "--info");
const cli = resolve(positionals[0] ?? join(__dirname, "../dist/cli.cjs"));
const detectorModule = resolve(
  positionals[1] ?? join(__dirname, "../dist/otel.cjs"),
);
const temporaryDirectory = mkdtempSync(join(tmpdir(), "birthplace-node-sdk-"));
const buildDirectory = join(temporaryDirectory, "build");
const runtimeDirectory = join(temporaryDirectory, "runtime");
const originalDirectory = process.cwd();
const originalLoad = moduleLoader._load;

async function verify() {
  // This script runs in its own process, independent of developer/CI OTel settings.
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("OTEL_")) {
      delete process.env[key];
    }
  }
  process.env.OTEL_LOGS_EXPORTER = "none";
  process.env.OTEL_METRICS_EXPORTER = "none";
  process.env.OTEL_RESOURCE_ATTRIBUTES =
    "deployment.environment.name=birthplace-smoke";

  mkdirSync(buildDirectory);
  mkdirSync(runtimeDirectory);
  writeFileSync(
    join(buildDirectory, "package.json"),
    JSON.stringify({
      name: "sdk-fixture",
      version: "2.0.0",
    }),
  );
  const fileName = useInfo ? "birthplace.mjs" : "birthplace.json";
  const generatedFile = join(buildDirectory, fileName);
  execFileSync(
    process.execPath,
    [
      cli,
      "generate",
      "--cwd",
      buildDirectory,
      "--output",
      generatedFile,
      "--format",
      useInfo ? "esm" : "json",
      "--revision",
      "c".repeat(40),
      "--timestamp",
      "2026-09-24T00:00:00Z",
      "--strict",
    ],
    { stdio: "pipe" },
  );
  const birthplaceFile = join(runtimeDirectory, fileName);
  copyFileSync(generatedFile, birthplaceFile);
  rmSync(buildDirectory, { recursive: true, force: true });
  process.chdir(runtimeDirectory);
  let info: unknown;
  if (useInfo) {
    info = (await import(pathToFileURL(birthplaceFile).href)).default;
    // Nothing is left on disk: the detector can only succeed from the imported object.
    rmSync(birthplaceFile);
    assert.deepEqual(readdirSync(runtimeDirectory), []);
  }

  moduleLoader._load = function (request, parent, isMain) {
    if (
      ["child_process", "node:child_process", "os", "node:os"].includes(request)
    ) {
      throw new Error(
        `Runtime detector loaded build/host discovery: ${request}`,
      );
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  const { birthplaceDetector } = require(detectorModule);
  const spans: tracing.ReadableSpan[] = [];
  const sdk = new NodeSDK({
    resourceDetectors: [
      useInfo
        ? birthplaceDetector({ info })
        : birthplaceDetector({ file: pathToFileURL(birthplaceFile) }),
      processDetector,
      hostDetector,
      envDetector,
    ],
    traceExporter: {
      export(batch, callback) {
        spans.push(...batch);
        callback({ code: 0 });
      },
      async shutdown() {
        // This in-memory exporter owns no connections or timers to release.
      },
    },
  });
  try {
    sdk.start();
    const tracer = trace.getTracer("birthplace-integration");
    tracer.startSpan("first-request").end();
    // Later filesystem changes must not change the SDK's captured build identity.
    writeFileSync(join(runtimeDirectory, "birthplace.json"), "{}");
    tracer.startSpan("second-request").end();
  } finally {
    await sdk.shutdown();
  }
  assert.equal(spans.length, 2);
  for (const span of spans) {
    const attributes = span.resource.attributes;
    assert.equal(attributes["service.name"], "sdk-fixture");
    assert.equal(attributes["service.version"], "2.0.0");
    assert.equal(attributes["vcs.ref.head.revision"], "c".repeat(40));
    assert.equal(attributes["process.pid"], process.pid);
    assert.equal(attributes["deployment.environment.name"], "birthplace-smoke");
    assert.equal(attributes["telemetry.sdk.name"], "opentelemetry");
    assert.equal(
      Object.keys(attributes).some((key) => key.startsWith("birthplace.")),
      false,
    );
  }
  console.log(
    useInfo
      ? "NodeSDK smoke passed: CLI -> imported ESM -> detector -> exported spans"
      : "NodeSDK smoke passed: CLI -> packaged JSON -> detector -> exported spans",
  );
}

verify()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    moduleLoader._load = originalLoad;
    process.chdir(originalDirectory);
    rmSync(temporaryDirectory, { recursive: true, force: true });
  });
