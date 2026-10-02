# birthplace

## 1.0.1

### Patch Changes

- 7a0d98e: Refresh the README shipped with the package.

## 1.0.0

### Major Changes

- b5c7263: First release of birthplace: record where and when an artifact was built, package that
  record with the application, and load it into OpenTelemetry Node.js resources.

  - CLI: `birthplace generate` (the default command) captures the service name and version, the
    source revision and dirty state, the CI run URL, and the build timestamp; `birthplace inspect`
    prints a validated file or its OpenTelemetry mapping. Flags include `--service-name`, `--output`, `--format`,
    `--strict`, and `--include-custom-attributes`.
  - Output: `birthplace.json`, or `birthplace.mjs` with the record as its default export.
  - API: the `Birthplace` type, `collectBirthplace`, `readBirthplace`, `writeBirthplace`,
    `toOtelAttributes`, `birthplaceDetector`, and `BirthplaceError` with `BIRTHPLACE_*_ERROR` codes.
  - OpenTelemetry entry points: `birthplace/otel` provides `birthplaceDetector` and
    `toOtelAttributes` without loading the Git collector, and `birthplace/attributes` provides the
    attribute mapping without any Node.js built-in.
  - Custom attributes are opt-in: `birthplace.source.dirty`, `birthplace.build.timestamp`, and
    `birthplace.build.timestamp_source`.
  - Vercel provider fallback: when no Git checkout is available, the revision and build URL come from
    `VERCEL_GIT_COMMIT_SHA` and `VERCEL_URL`.
  - Opt-in build-machine capture: `--host` / `host: true` records a `host` group, exported as
    `birthplace.host.*` attributes with `--include-host-attributes` / `includeHostAttributes`.
  - Object-accepting detector: `birthplaceDetector({ info })` takes an already-loaded birthplace object
    and performs no file access.

  See the README for usage and `docs/platforms.md` for GitHub Actions, Vercel, Docker, and Turborepo
  guidance.
