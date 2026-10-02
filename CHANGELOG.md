# ngrv

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
