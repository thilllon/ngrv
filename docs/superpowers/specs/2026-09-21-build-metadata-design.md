# Node.js build metadata with OpenTelemetry

The user approved a redesign that stamps build identity into an artifact once,
then reads that identity in a deployed Node.js application. OpenTelemetry is the
primary integration. This is an additive release: existing `.ngrv` files,
`engrave`, `readEngrave`, and `create`/`read` CLI commands remain supported.

## Contract

```ts
interface BuildInfo {
  schemaVersion: 1;
  service: { name?: string; version?: string };
  source: { revision?: string; dirty?: boolean };
  build: {
    timestamp?: string;
    timestampSource?: 'clock' | 'explicit' | 'source-date-epoch';
    url?: string;
  };
}
```

The revision identifies the actual checkout used by the build. Explicit options
override discovery; checkout Git overrides provider environment fallbacks. Only
known GitHub Actions and GitLab CI fields are consumed, never the entire process
environment. Package name/version are read from `cwd/package.json`. A malformed
manifest or invalid explicit metadata is an error, not a silently missing value.
Missing information is omitted in normal mode. Strict mode requires service name,
service version, and source revision. Dirty state is observable, not a strict-mode
failure; its absence means unknown. Do not infer a clean checkout without Git.

Default timestamps use the collection clock. An explicit ISO timestamp overrides
`SOURCE_DATE_EPOCH`; `timestamp: false` omits both timestamp fields. A valid
`SOURCE_DATE_EPOCH` is UTC Unix seconds and must be tagged `source-date-epoch` to
avoid presenting source time as actual build time. Invalid dates/epoch values
fail. Full SHA-1 or SHA-256 commit IDs are accepted. URL fields accept HTTP(S)
without embedded credentials. Metadata never collects username, home directory,
CPU, memory, arbitrary environment variables, or repository remote credentials.

## Modules and APIs

- `src/build-info.ts`: types and validation; schemaVersion 1 only; safe explicit
  serialization of known fields. Validation is shared by read/write/OTel.
- `src/collect.ts`: `collectBuildInfo(options?: CollectBuildInfoOptions): BuildInfo`.
  Options: `cwd`, `env`, `name`, `version`, `revision`, `dirty`, `buildUrl`,
  `timestamp` (ISO string or false), and `strict`. Read-only collection; no file
  writes, logging, or process.env mutation. Git subprocesses use argument arrays.
- `src/storage.ts`: `writeBuildInfo(info, options?: { file?: string;
format?: 'json' | 'esm' }): string` and
  `readBuildInfo(file?: string): BuildInfo`. JSON defaults to `build-info.json`,
  ESM to `build-info.mjs`. Writes create parent directories and atomically replace
  via a same-directory temporary file. Readers parse JSON only, never execute JS.
- `src/otel.ts`: `toOtelAttributes(info): Record<string, string | boolean>` maps
  service name/version to `service.name`/`service.version`; remaining fields to
  `ngrv.source.revision`, `ngrv.source.dirty`, `ngrv.build.timestamp`,
  `ngrv.build.timestamp_source`, and `ngrv.build.url`. The `ngrv.*` keys are custom
  attributes, not claimed to be OpenTelemetry semantic conventions. No undefined
  values. No OTel runtime dependency or SDK/exporter lifecycle management.
- Root exports new APIs alongside legacy exports. `ngrv/otel` is a lean subpath
  that can validate/convert imported metadata without loading Git/fs collection.
- `NgrvError` exposes a stable `code` and propagates collection, validation, read,
  write failures. Exact message wording is not an API contract.

## CLI

`ngrv generate` supports `--cwd`, `--output`, `--format json|esm`, `--name`,
`--service-version`, `--revision`, `--build-url`, `--timestamp`, `--no-timestamp`,
and `--strict`. Write once during a build, before packaging the application.
`ngrv inspect [file]` prints validated JSON; `--otel` prints the OTel attributes.
Malformed input and filesystem failures exit nonzero with concise stderr.
Existing bare `ngrv`, `create`/`c`, `read`/`r`, and global bin aliases remain.
No global process.env mutation occurs in new code.

## Node.js / OTel usage

Document `resourceFromAttributes(toOtelAttributes(readBuildInfo(path)))` as the
resource passed to `new NodeSDK(...)`. Instrumentation initializes before the
application. Applications own their exporters and signals; NGRV only supplies
resource metadata. Include an ESM generated-module example. Do not put deployment
environment or deployment time into immutable build metadata. The JSON artifact
must be copied into the final deployment image/package, where `.git` is absent.

## Verification and delivery

Real temporary Git repositories exercise checkout precedence and dirty state;
temporary artifact directories exercise read/write/import failures and round
trips. Test strict mode, malformed schema, provider fallbacks, reproducible time,
no environment mutation, and preservation of legacy API behavior. Replace the
existing no-op e2e test with real built CLI subprocess tests. Test OTel conversion
against the real `@opentelemetry/resources` package (dev dependency only), and
smoke-test the packed package's CJS/ESM root and OTel subpath. CI runs frozen
installation, typecheck, lint, format check, build, tests on Node.js 22 and 24.

The checked-in lockfile uses pnpm 8 format while packageManager says pnpm 7;
align packageManager to pnpm 8.15.9 without unrelated dependency upgrades.
Implement in a feature worktree, commit without Co-Authored-By trailers, and open
a pull request. No merge or npm publication is requested.
