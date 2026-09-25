---
'ngrv': major
---

Capture build metadata with the default CLI and register the packaged JSON through
`ngrvDetector` in OpenTelemetry NodeSDK `resourceDetectors`. Emit `service.name`,
`service.version`, `vcs.ref.head.revision`, and `cicd.pipeline.run.url.full` by default;
custom dirty-state and timestamp attributes are opt-in.

The bare `ngrv` command now generates `build-info.json`. Include this file in the
application deployment and configure `ngrvDetector` from `ngrv/otel` at startup.
Explicit legacy `create`/`read` commands and APIs remain available for migration.
