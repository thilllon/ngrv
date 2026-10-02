# birthplace

[![npm version](https://img.shields.io/npm/v/birthplace)](https://www.npmjs.com/package/birthplace)
[![npm downloads](https://img.shields.io/npm/dm/birthplace)](https://www.npmjs.com/package/birthplace)
[![CI](https://github.com/thilllon/birthplace/actions/workflows/ci.yml/badge.svg)](https://github.com/thilllon/birthplace/actions/workflows/ci.yml)

Record where and when an artifact was built: capture build metadata with a CLI, package the
generated birthplace file with your application, and load it through an OpenTelemetry Node.js
ResourceDetector. Every instance of the same artifact gets the same build identity, without needing
Git in production.

**Build CLI → birthplace.json → deployment package → NodeSDK.resourceDetectors**

Tested on Node.js 22 and 24 with OpenTelemetry Resources 2.x. Coming from `ngrv`? See
[Migrating from ngrv](#migrating-from-ngrv).

## Usage

### Capture metadata during the build

```sh
pnpm add birthplace
```

Generate the birthplace file **after compiling** if your build cleans `dist`, while the source
checkout and `.git` directory are still available. Include the file in the final image or deployment
package:

```sh
pnpm build
pnpm exec birthplace generate --cwd . --output dist/birthplace.json --strict
```

The birthplace file describes the build. Do not add deployment environment or deployment time to it;
those values change independently of the immutable artifact.

### Register the detector in NodeSDK()

Install the OpenTelemetry SDK pieces used by your application. birthplace supplies the resource
detector; your application owns its exporters, instrumentation, and SDK lifecycle.

```sh
pnpm add @opentelemetry/api @opentelemetry/resources @opentelemetry/sdk-node \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/auto-instrumentations-node
```

Create `instrumentation.mjs` next to `dist/`, include it in the deployment, and preload it before
application code. In Docker, copy both `dist/` (including `birthplace.json`) and this module into the
final runtime image; the build stage's environment variables alone are not preserved automatically.

```js
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { envDetector, hostDetector, processDetector } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { birthplaceDetector } from 'birthplace/otel';

const sdk = new NodeSDK({
  resourceDetectors: [
    birthplaceDetector({ file: new URL('./dist/birthplace.json', import.meta.url) }),
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

`birthplaceDetector({ file?, includeCustomAttributes? })` accepts a JSON path or file URL. Relative
paths are resolved when the detector is created; the default is `birthplace.json`. The file is read
and validated during `detect()`, not when the package is imported. The detector never invokes Git,
reads package.json, regenerates metadata, or mutates `process.env`.

Direct `detect()` failures throw `BirthplaceError`. OpenTelemetry catches detector failures and skips
the failed detector (diagnostic logging can expose the error). If metadata is required for
application startup, explicitly call `readBirthplace` before starting the SDK. Do not rely on
detector failures to terminate the application. With `file`, the detector reads JSON only; to use a
generated ESM birthplace file, import it and pass the object as `info`, as shown next.

### Import instead of read

Bundled and serverless deployments (a single-file bundle, a serverless function, Next.js output file
tracing) ship only the files their tooling can trace from imports. A `birthplace.json` that is read
through `fs` at runtime is easily left out, and because OpenTelemetry swallows detector failures, the
missing file does not crash anything: the build attributes are silently dropped. An imported module
is always part of the bundle, so importing is the robust choice there.

Generate an ESM birthplace file inside the source tree, before bundling:

```sh
birthplace generate --format esm --output src/birthplace.mjs
```

Import it and hand the object to the detector:

```js
import { NodeSDK } from '@opentelemetry/sdk-node';
import { birthplaceDetector } from 'birthplace/otel';
import birthplace from './birthplace.mjs';

const sdk = new NodeSDK({
  resourceDetectors: [birthplaceDetector({ info: birthplace })],
});

sdk.start();
```

`birthplaceDetector({ info, includeCustomAttributes? })` performs no file access. The object is
validated during `detect()`, exactly like a file. Passing both `file` and `info` throws a
`BirthplaceError` with code `BIRTHPLACE_VALIDATION_ERROR` when the detector is created, so that
mistake is not swallowed by OpenTelemetry. The generated file is build output: add
`src/birthplace.mjs` to `.gitignore`. TypeScript projects need `allowJs` or a declaration next to
the file to import it.

`birthplace/otel` requires Node.js: it loads `node:fs`, `node:path`, `node:url`, and `node:crypto`
when imported, even if only `info` is used. For a runtime or bundle without Node.js built-ins, import
the mapping from `birthplace/attributes`, which loads no `node:` module, and build the resource
yourself:

```js
import { resourceFromAttributes } from '@opentelemetry/resources';
import { toOtelAttributes } from 'birthplace/attributes';
import birthplace from './birthplace.mjs';

const resource = resourceFromAttributes(toOtelAttributes(birthplace));
```

## Build metadata

A JSON birthplace file has this shape; unavailable optional fields are omitted:

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

`collectBirthplace(options)` discovers values with these exact precedence rules:

- Service name and version: explicit `name` / `version`, then `cwd/package.json`.
- Source revision: explicit `revision`, then the checkout's Git `HEAD`, then the recognized
  provider's revision.
- Dirty state: explicit `dirty`, then the checkout's Git status. It stays absent when Git cannot
  determine it; birthplace never assumes that a checkout is clean.
- CI pipeline run URL: explicit `buildUrl`, then the recognized CI provider's run URL.
- Timestamp: `timestamp: false` omits it; an explicit ISO timestamp wins over `SOURCE_DATE_EPOCH`;
  a valid `SOURCE_DATE_EPOCH` wins over the collection clock.

Provider values are a fallback only, and exactly one provider is used. The first matching marker
wins; values from different providers are never mixed:

| Order | Provider       | Marker                | Revision                | Run URL                                                                |
| ----- | -------------- | --------------------- | ----------------------- | ---------------------------------------------------------------------- |
| 1     | GitHub Actions | `GITHUB_ACTIONS=true` | `GITHUB_SHA`            | `<GITHUB_SERVER_URL>/<GITHUB_REPOSITORY>/actions/runs/<GITHUB_RUN_ID>` |
| 2     | GitLab CI      | `GITLAB_CI=true`      | `CI_COMMIT_SHA`         | `CI_PIPELINE_URL`                                                      |
| 3     | Vercel         | `VERCEL=1`            | `VERCEL_GIT_COMMIT_SHA` | `https://<VERCEL_URL>/_logs`                                           |

On Vercel the checkout is often unavailable: `vercel deploy` source uploads do not include `.git`,
and a monorepo Root Directory can hide it. The fallback needs Vercel's
[system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables),
so enable **Automatically expose System Environment Variables** in the project's Environment
Variables settings. `VERCEL_GIT_COMMIT_SHA` is only populated for deployments created from a
connected Git repository; an empty value is treated as unknown, so `--strict` still fails instead
of recording a guess. `VERCEL_URL` is a bare hostname without a scheme, and the run URL points at
that deployment's build logs. A `VERCEL_URL` that is empty or not a plain hostname is ignored. The
Vercel URL is stored in `build.url` and still maps to `cicd.pipeline.run.url.full`.

GitHub Actions and GitLab CI are checked before Vercel because a `vercel build` executed inside a
CI job keeps `VERCEL=1` while the CI provider is the machine that ran the build.

`SOURCE_DATE_EPOCH` is interpreted as UTC Unix seconds and produces
`timestampSource: "source-date-epoch"`. Explicit values use `"explicit"`, and the current clock uses
`"clock"`. Invalid package manifests, revisions, URLs, timestamps, and epoch values throw a
`BirthplaceError`. URLs must use HTTP or HTTPS and cannot contain credentials. Full SHA-1 and SHA-256
commit IDs are accepted.

Normal mode omits unavailable information. `strict: true` requires service name, service version,
and source revision. Dirty state and timestamp are not strict-mode requirements.

```ts
import { collectBirthplace, readBirthplace, writeBirthplace } from 'birthplace';

const info = collectBirthplace({
  cwd: process.cwd(),
  buildUrl: 'https://ci.example.test/builds/42',
  strict: true,
});

writeBirthplace(info, { file: 'dist/birthplace.json' });
const packagedInfo = readBirthplace('dist/birthplace.json');
```

Collection only reads metadata. `writeBirthplace` creates parent directories and atomically replaces
the target. `readBirthplace` parses and validates JSON without executing it.

Failures throw a `BirthplaceError` whose `code` is one of `BIRTHPLACE_VALIDATION_ERROR`,
`BIRTHPLACE_COLLECTION_ERROR`, `BIRTHPLACE_READ_ERROR`, or `BIRTHPLACE_WRITE_ERROR`.

For a generated JavaScript module, choose ESM explicitly and import it directly. The module has a
default export only:

```sh
npx birthplace generate --format esm --output dist/birthplace.mjs --strict
```

```js
import birthplace from './dist/birthplace.mjs';
import { toOtelAttributes } from 'birthplace/otel';

const attributes = toOtelAttributes(birthplace);
```

`readBirthplace` is for JSON birthplace files; it intentionally does not execute generated ESM files.

## OpenTelemetry attributes

`toOtelAttributes(info, options?)` validates the input and returns only defined values. The dedicated
`birthplace/otel` entrypoint includes birthplace file reading and conversion, without loading the Git
collector. No OpenTelemetry SDK is installed as a runtime dependency.

| Entry point             | Exports                                              | Needs Node.js built-ins |
| ----------------------- | ---------------------------------------------------- | ----------------------- |
| `birthplace`            | Collection, reading, writing, detector, and mapping  | Yes                     |
| `birthplace/otel`       | `birthplaceDetector`, `toOtelAttributes`             | Yes                     |
| `birthplace/attributes` | `toOtelAttributes`, `BirthplaceError`, and the types | No                      |

| Build metadata    | Resource attribute           |
| ----------------- | ---------------------------- |
| `service.name`    | `service.name`               |
| `service.version` | `service.version`            |
| `source.revision` | `vcs.ref.head.revision`      |
| `build.url`       | `cicd.pipeline.run.url.full` |

The mapping was checked against OTel semantic conventions 1.43.0, the version of
`@opentelemetry/semantic-conventions` in this repository's development tree. `service.name` and
`service.version` are Stable. `vcs.ref.head.revision` and `cicd.pipeline.run.url.full` in the
[VCS](https://opentelemetry.io/docs/specs/semconv/registry/attributes/vcs/) and
[CI/CD](https://opentelemetry.io/docs/specs/semconv/registry/attributes/cicd/) registries have been
Release Candidate since semantic conventions 1.43.0; they are not Stable yet. birthplace writes these
names as literals and does not import the semantic-conventions package, so upgrading the SDK does not
silently rename them.

Custom attributes are **off by default**. Pass `includeCustomAttributes: true` to the detector or
converter to additionally emit `birthplace.source.dirty`, `birthplace.build.timestamp`, and
`birthplace.build.timestamp_source`. These are birthplace-specific attributes, not OTel semantic
conventions. The birthplace file always retains those fields whether or not you export them as
attributes.

## CLI

Generate a JSON birthplace file:

```sh
npx birthplace generate \
  --cwd . \
  --output dist/birthplace.json \
  --service-name checkout \
  --service-version 2.0.0 \
  --revision bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb \
  --build-url https://ci.example.test/builds/42 \
  --strict
```

`generate` accepts `--format json|esm`, `--timestamp <ISO timestamp>`, and `--no-timestamp` in
addition to the options above. Without `--output`, JSON writes `birthplace.json` and ESM writes
`birthplace.mjs` in the current directory.

Bare `birthplace` is equivalent to `birthplace generate`.

Inspect validated JSON or its OpenTelemetry mapping:

```sh
npx birthplace inspect dist/birthplace.json
npx birthplace inspect dist/birthplace.json --otel
npx birthplace inspect dist/birthplace.json --otel --include-custom-attributes
```

Malformed data, invalid options, missing strict fields, and filesystem failures print a concise error
to stderr and exit nonzero.

## Migrating from ngrv

birthplace replaces the `ngrv` package. It is a new package name with a renamed API, CLI, and
generated file; there is no compatibility alias.

| ngrv                                     | birthplace                                                                                                     |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `ngrv` package                           | `birthplace` package                                                                                           |
| `ngrv/otel`                              | `birthplace/otel`                                                                                              |
| `.ngrv` file and `NGRV_*` variables      | Removed; see the host capture feature tracked in [issue #22](https://github.com/thilllon/birthplace/issues/22) |
| `ngrv create` / `ngrv read`              | `birthplace generate` / `birthplace inspect`                                                                   |
| `build-info.json`                        | `birthplace.json`                                                                                              |
| `ngrvDetector`                           | `birthplaceDetector`                                                                                           |
| `--name`                                 | `--service-name`                                                                                               |
| `--include-custom`                       | `--include-custom-attributes`                                                                                  |
| `BuildInfo`                              | `Birthplace`                                                                                                   |
| `collectBuildInfo` / `readBuildInfo`     | `collectBirthplace` / `readBirthplace`                                                                         |
| `writeBuildInfo`                         | `writeBirthplace`                                                                                              |
| `validateBuildInfo`                      | Not exported; `readBirthplace`, `writeBirthplace`, and `toOtelAttributes` validate their input                 |
| `NgrvError` with `NGRV_*_ERROR` codes    | `BirthplaceError` with `BIRTHPLACE_*_ERROR` codes                                                              |
| `ngrv.source.dirty`, `ngrv.build.*`      | `birthplace.source.dirty`, `birthplace.build.timestamp`, `birthplace.build.timestamp_source`                   |
| Named `buildInfo` export of the ESM file | Default export only                                                                                            |
| `engrave()` / `readEngrave()`            | `collectBirthplace` plus `writeBirthplace` at build time; `readBirthplace` or `birthplaceDetector` at runtime  |

An old `.ngrv` file is not a valid birthplace file: regenerate it during the build with
`birthplace generate --output dist/birthplace.json --strict` instead of renaming it, and copy the
result into the runtime package. A JSON `build-info.json` uses the same schema (`schemaVersion: 1`),
so only its file name changes. birthplace never mutates `process.env`.

## Development

```sh
mise install
mise run setup
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm test:packaging
```

Tests include temporary Git repositories, built CLI subprocesses, actual OTel resource detection,
and a real NodeSDK exporting spans from the packaged birthplace file and from an imported birthplace
object. The package smoke test installs the tarball into an isolated consumer and verifies
CommonJS/ESM imports and declarations, and that `birthplace/attributes` loads no Node.js built-in.

Node.js 22 or later is required. CJS and ESM have separate entry points and matching declarations;
use `birthplace`, `birthplace/otel`, and `birthplace/attributes` rather than depending on generated filenames under `dist/`.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the issue, PR, and Changesets workflow.
