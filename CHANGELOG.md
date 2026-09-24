# Changelog

## 4.0.0

### Breaking changes

- Bare `ngrv` now generates a schema-version-1 JSON build artifact (`build-info.json`),
  replacing the legacy default `.ngrv` workflow. Use explicit `ngrv create` to retain
  the old behavior while migrating.

### Added

- Build-time metadata collection, validated JSON/ESM artifacts, and `generate` / `inspect` CLI.
- `ngrvDetector` for OpenTelemetry NodeSDK `resourceDetectors`, with path and file-URL support.
- Standard `service.name`, `service.version`, `vcs.ref.head.revision`, and
  `cicd.pipeline.run.url.full` mappings (semconv 1.44.0; VCS/CI/CD are Release Candidate).
- Opt-in custom dirty-state and timestamp attributes with `includeCustomAttributes`.
- Strict identity checks, checkout-first discovery, reproducible timestamps, and atomic writes.
- Node.js 22/24 CI, real NodeSDK span tests, and installed package smoke checks.

### Migration

Generate JSON during the build, include it in the deployed application, and configure
`ngrvDetector` from `ngrv/otel` at startup. Existing explicit legacy commands and APIs
remain available; see README for the full migration and initialization example.
