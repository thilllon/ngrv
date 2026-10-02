# ngrv

## 5.0.0

### Major Changes

- 8c8e72f: Remove the legacy engrave surface. The `engrave` and `readEngrave` root exports, their
  option types and defaults, the `NGRV_*` `process.env` type declarations, the `create`/`c`
  and `read`/`r` CLI commands, and the `ngrv-global` and `ngrv:global` binaries no longer
  exist, and `.ngrv` files are neither written nor read.

  Use `ngrv generate` (or `collectBuildInfo` with `writeBuildInfo`) during the build and
  `readBuildInfo` or `ngrvDetector` from `ngrv/otel` at runtime. The single `ngrv` binary
  remains, and `generate` now rejects unexpected positional arguments instead of ignoring
  them.

### Minor Changes

- da0e9f2: Fall back to Vercel system environment variables when `VERCEL=1`: `VERCEL_GIT_COMMIT_SHA`
  supplies the source revision when no Git checkout is available, and `VERCEL_URL` supplies the
  deployment build logs URL (`https://<VERCEL_URL>/_logs`). Explicit options and the Git checkout
  still take precedence, and GitHub Actions or GitLab CI win when their marker is also set.

## 4.0.0

### Major Changes

- 9c4e371: Require Node.js 22 or later and publish separate CJS/ESM entry points with matching
  type declarations. Use the public `ngrv` and `ngrv/otel` exports instead of depending
  on old generated `.js` or IIFE file paths.
- ca9246a: Capture build metadata with the default CLI and register the packaged JSON through
  `ngrvDetector` in OpenTelemetry NodeSDK `resourceDetectors`. Emit `service.name`,
  `service.version`, `vcs.ref.head.revision`, and `cicd.pipeline.run.url.full` by default;
  custom dirty-state and timestamp attributes are opt-in.

  The bare `ngrv` command now generates `build-info.json`. Include this file in the
  application deployment and configure `ngrvDetector` from `ngrv/otel` at startup.
  This version was not published to npm. The legacy `create`/`read` commands and APIs it
  still contained are removed in the following release.
