---
'birthplace': major
---

First release of birthplace, the successor of the `ngrv` package.

- Renamed from `ngrv`: the package, the `birthplace` bin, and the `birthplace/otel` and
  `birthplace/attributes` entry points. There is no compatibility alias.
- Removed the legacy engrave surface: `engrave()`, `readEngrave()`, the `.ngrv` file, the `NGRV_*`
  variables, and the `create` / `read` commands. The CLI commands are `generate` (default) and
  `inspect`.
- The generated file is the birthplace file: `birthplace.json`, or `birthplace.mjs` with a default
  export only.
- API names: the `Birthplace` type, `collectBirthplace`, `readBirthplace`, `writeBirthplace`,
  `birthplaceDetector`, and `BirthplaceError` with `BIRTHPLACE_*_ERROR` codes. The validator is no
  longer exported. Custom attributes are `birthplace.source.dirty`, `birthplace.build.timestamp`,
  and `birthplace.build.timestamp_source`.
- CLI flag renames: `--name` is now `--service-name`, and `--include-custom` is now
  `--include-custom-attributes`.
- Vercel provider fallback: when no Git checkout is available, the revision and build URL come from
  `VERCEL_GIT_COMMIT_SHA` and `VERCEL_URL`.
- Opt-in build-machine capture: `--host` / `host: true` records a `host` group, exported as
  `birthplace.host.*` attributes with `--include-host-attributes` / `includeHostAttributes`.
- Object-accepting detector: `birthplaceDetector({ info })` takes an already-loaded birthplace object
  and performs no file access.

See the README for the migration table and `docs/platforms.md` for GitHub Actions, Vercel, Docker,
and Turborepo guidance.
