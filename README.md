# ngrv 4

Capture build metadata with a CLI, package the file with your application, and load it through an
OpenTelemetry Node.js ResourceDetector. Every instance of the same artifact gets the same build
identity, without needing Git in production.

**Build CLI → build-info.json → deployment package → NodeSDK.resourceDetectors**

Version 4 changes the bare `ngrv` command to generate JSON. See [migration](#migrating-from-v3).
Tested on Node.js 22 and 24 with OpenTelemetry Resources 2.x.

## Usage

### Capture metadata during the build

```sh
pnpm add ngrv@^4
```

Generate metadata **after compiling** if your build cleans `dist`, while the source checkout and
`.git` directory are still available. Include the artifact in the final image or deployment package:

```sh
pnpm build
pnpm exec ngrv generate --cwd . --output dist/build-info.json --strict
```

The generated file describes the build. Do not add deployment environment or deployment time to it;
those values change independently of the immutable artifact.

### Register the detector in NodeSDK()

Install the OpenTelemetry SDK pieces used by your application. NGRV supplies the resource detector;
your application owns its exporters, instrumentation, and SDK lifecycle.

```sh
pnpm add @opentelemetry/api @opentelemetry/resources @opentelemetry/sdk-node \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/auto-instrumentations-node
```

Create `instrumentation.mjs` next to `dist/`, include it in the deployment, and preload it before
application code. In Docker, copy both `dist/` (including `build-info.json`) and this module into the
final runtime image; the build stage's environment variables alone are not preserved automatically.

```js
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { envDetector, hostDetector, processDetector } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ngrvDetector } from 'ngrv/otel';

const sdk = new NodeSDK({
  resourceDetectors: [
    ngrvDetector({ file: new URL('./dist/build-info.json', import.meta.url) }),
    processDetector,
    hostDetector,
    envDetector,
  ],
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

Run the application with the instrumentation module loaded first:

```sh
node --import ./instrumentation.mjs ./dist/app.js
```

Supplying `resourceDetectors` replaces the SDK's default detector list, so the example keeps the
process, host, and environment detectors. `envDetector` runs last so deployment environment
attributes can override build attributes deliberately. Detection requires `autoDetectResources`
(true by default). With `autoDetectResources: false`, use `toOtelAttributes` with an explicitly
created Resource instead.

The example assumes the compiled application uses CommonJS. For ESM dependencies, also configure the
[OTel ESM loader hook](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md)
as required by your instrumentation. See the OpenTelemetry documentation for
[resources](https://opentelemetry.io/docs/languages/js/resources/) and
[instrumentation initialization](https://opentelemetry.io/docs/languages/js/instrumentation/).

`ngrvDetector({ file?, includeCustomAttributes? })` accepts a JSON path or file URL. Relative paths
are resolved when the detector is created; the default is `build-info.json`. The file is read and
validated during `detect()`, not when the package is imported. The detector never invokes Git,
reads package.json, regenerates metadata, or mutates `process.env`.

Direct `detect()` failures throw `NgrvError`. OpenTelemetry catches detector failures and skips the
failed detector (diagnostic logging can expose the error). If metadata is required for application
startup, explicitly call `readBuildInfo` before starting the SDK. Do not rely on detector failures
to terminate the application. The detector reads JSON only; import generated ESM artifacts directly
and use `toOtelAttributes` for that alternative.

## Build metadata

A JSON artifact has this shape; unavailable optional fields are omitted:

```json
{
  "schemaVersion": 1,
  "service": { "name": "checkout", "version": "2.0.0" },
  "source": { "revision": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "dirty": false },
  "build": {
    "timestamp": "2026-09-21T01:02:03.000Z",
    "timestampSource": "clock",
    "url": "https://ci.example.test/builds/42"
  }
}
```

`collectBuildInfo(options)` discovers values with these exact precedence rules:

- Service name and version: explicit `name` / `version`, then `cwd/package.json`.
- Source revision: explicit `revision`, then the checkout's Git `HEAD`, then a recognized GitHub
  Actions or GitLab CI revision.
- Dirty state: explicit `dirty`, then the checkout's Git status. It stays absent when Git cannot
  determine it; NGRV never assumes that a checkout is clean.
- CI pipeline run URL: explicit `buildUrl`, then the recognized CI provider's run URL.
- Timestamp: `timestamp: false` omits it; an explicit ISO timestamp wins over `SOURCE_DATE_EPOCH`;
  a valid `SOURCE_DATE_EPOCH` wins over the collection clock.

`SOURCE_DATE_EPOCH` is interpreted as UTC Unix seconds and produces
`timestampSource: "source-date-epoch"`. Explicit values use `"explicit"`, and the current clock uses
`"clock"`. Invalid package manifests, revisions, URLs, timestamps, and epoch values throw an
`NgrvError`. URLs must use HTTP or HTTPS and cannot contain credentials. Full SHA-1 and SHA-256
commit IDs are accepted.

Normal mode omits unavailable information. `strict: true` requires service name, service version,
and source revision. Dirty state and timestamp are not strict-mode requirements.

```ts
import { collectBuildInfo, readBuildInfo, writeBuildInfo } from 'ngrv';

const info = collectBuildInfo({
  cwd: process.cwd(),
  buildUrl: 'https://ci.example.test/builds/42',
  strict: true,
});

writeBuildInfo(info, { file: 'dist/build-info.json' });
const packagedInfo = readBuildInfo('dist/build-info.json');
```

Collection only reads metadata. `writeBuildInfo` creates parent directories and atomically replaces
the target. `readBuildInfo` parses and validates JSON without executing it.

For a generated JavaScript module, choose ESM explicitly and import it directly:

```sh
npx ngrv generate --format esm --output dist/build-info.mjs --strict
```

```js
import buildInfo from './dist/build-info.mjs';
import { toOtelAttributes } from 'ngrv/otel';

const attributes = toOtelAttributes(buildInfo);
```

`readBuildInfo` is for JSON artifacts; it intentionally does not execute generated ESM files.

## OpenTelemetry attributes

`toOtelAttributes(info, options?)` validates the input and returns only defined values. The dedicated
`ngrv/otel` entrypoint includes artifact reading and conversion, without loading the Git collector or
legacy machine-information module. No OpenTelemetry SDK is installed as a runtime dependency.

| Build metadata    | Resource attribute           |
| ----------------- | ---------------------------- |
| `service.name`    | `service.name`               |
| `service.version` | `service.version`            |
| `source.revision` | `vcs.ref.head.revision`      |
| `build.url`       | `cicd.pipeline.run.url.full` |

The mapping follows OTel semantic conventions 1.44.0. Service attributes are Stable; the
[VCS](https://opentelemetry.io/docs/specs/semconv/registry/attributes/vcs/) and
[CI/CD](https://opentelemetry.io/docs/specs/semconv/registry/attributes/cicd/) attributes are Release
Candidate. NGRV pins these names for this release; upgrading the SDK does not silently rename them.

Custom attributes are **off by default**. Pass `includeCustomAttributes: true` to the detector or
converter to additionally emit `ngrv.source.dirty`, `ngrv.build.timestamp`, and
`ngrv.build.timestamp_source`. These are NGRV-specific attributes, not OTel semantic conventions.
The artifact always retains those fields whether or not you export them as attributes.

## CLI

Generate a JSON artifact:

```sh
npx ngrv generate \
  --cwd . \
  --output dist/build-info.json \
  --name checkout \
  --service-version 2.0.0 \
  --revision bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb \
  --build-url https://ci.example.test/builds/42 \
  --strict
```

`generate` accepts `--format json|esm`, `--timestamp <ISO timestamp>`, and `--no-timestamp` in
addition to the options above. Without `--output`, JSON writes `build-info.json` and ESM writes
`build-info.mjs` in the current directory.

Bare `ngrv` is equivalent to `ngrv generate` in v4.

Inspect validated JSON or its OpenTelemetry mapping:

```sh
npx ngrv inspect dist/build-info.json
npx ngrv inspect dist/build-info.json --otel
npx ngrv inspect dist/build-info.json --otel --include-custom
```

Malformed data, invalid options, missing strict fields, and filesystem failures print a concise error
to stderr and exit nonzero.

## Migrating from v3

**Breaking change:** bare `ngrv` now creates `build-info.json` rather than `.ngrv`. Replace old build
steps with `ngrv generate --output dist/build-info.json --strict`, copy the artifact into the runtime
package, and register `ngrvDetector` during SDK initialization. An old `.ngrv` file is not a valid
JSON artifact; regenerate it during the build instead of renaming it.

Explicit legacy commands, aliases, binaries, and root exports remain for gradual migration:

```sh
npx ngrv create --directory .    # alias: `c`
npx ngrv read --directory .      # alias: `r`
```

```ts
import { engrave, readEngrave } from 'ngrv';

engrave();
readEngrave();
```

These legacy calls write or read `.ngrv` and populate their own process's `process.env`. Running the
legacy read CLI does not export variables into a parent shell or another app process. New build APIs
and the OTel detector do not mutate the environment.

## Development

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm build
pnpm exec jest --runInBand
pnpm test:package
```

Tests include temporary Git repositories, built CLI subprocesses, actual OTel resource detection,
and a real NodeSDK exporting spans from the packaged build artifact. The package smoke test installs
the tarball into an isolated consumer and verifies CommonJS/ESM imports and declarations.
