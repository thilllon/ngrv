# NGRV 4: build artifacts and an OpenTelemetry resource detector

The user approved a new major version with two primary entry points: a CLI that
captures metadata at build time, and a Node.js OpenTelemetry ResourceDetector
that reads the packaged artifact at application startup. This supersedes the
OTel mapping and default CLI behavior in the September 21 additive design.

## Public behavior

- Release version: 4.0.0. Bare `ngrv` runs `generate`, producing `build-info.json`.
  Explicit legacy `create`/`c`, `read`/`r`, and legacy APIs remain available for
  migration; legacy behavior is no longer the default workflow.
- The existing schema-version-1 artifact, collection, JSON/ESM storage, strict
  validation, checkout precedence, and deterministic timestamp behavior remain.
- `toOtelAttributes(info, options?)` emits `service.name`, `service.version`,
  `vcs.ref.head.revision`, and `cicd.pipeline.run.url.full` when present. `build.url`
  represents the CI pipeline run URL. VCS and CI/CD conventions are documented
  as Release Candidate, with mapping pinned/documented to semconv 1.44.0.
- `includeCustomAttributes: true` additionally emits `ngrv.source.dirty`,
  `ngrv.build.timestamp`, and `ngrv.build.timestamp_source`; these are off by
  default. All fields remain accessible in the artifact regardless of mapping.
- `ngrvDetector({ file?, includeCustomAttributes? })` is exported from `ngrv/otel`
  and the root. It returns a structurally compatible OTel 2.x ResourceDetector.
  It reads and validates JSON when `detect()` runs, returning `{ attributes }`.
  The default file is `build-info.json`. File paths and file URLs are supported;
  relative paths are resolved at factory creation. It never collects Git, reads
  package.json, writes files, or mutates the environment at runtime.
- Direct detector failures retain NgrvError codes. OTel's detection mechanism may
  log and skip a failed detector; document explicit artifact validation for apps
  that require startup to fail when metadata is unavailable. Never fabricate
  metadata or fall back to runtime collection.
- Keep SDK/exporters owned by the application. No OTel runtime dependency is
  introduced. Detector shape is type-checked against real OTel types in tests.
  The runtime subpath may load artifact-reading code but must not load Git
  collection or legacy machine-information code.

## Documentation and verification

README centers on build CLI -> copied artifact -> NodeSDK.resourceDetectors.
Preserve env/process/host detectors in examples, place envDetector last to permit
deployment overrides, and initialize SDK before application code. Show a robust
file URL relative to instrumentation.mjs, build-after-compile packaging order,
and v3 migration. Update the existing example and add a 4.0.0 changelog.

Regression tests cover standard mapping, opt-in custom fields, lazy JSON reads,
file URLs, missing/malformed files, no runtime Git/OS probing, and the new default
CLI. Run an actual NodeSDK against the packed package and inspect exported spans.
Use frozen pnpm 8 installation and Node 22/24 checks, build, tests, package smoke.
Work in an isolated v4 checkout. The implementation was initially prepared locally;
the user's subsequent request extends completion to merging into `main` and
publishing version 4.0.0 to npm, with registry verification after release.
