---
'ngrv': major
---

Remove the legacy engrave surface. The `engrave` and `readEngrave` root exports, their
option types and defaults, the `NGRV_*` `process.env` type declarations, the `create`/`c`
and `read`/`r` CLI commands, and the `ngrv-global` and `ngrv:global` binaries no longer
exist, and `.ngrv` files are neither written nor read.

Use `ngrv generate` (or `collectBuildInfo` with `writeBuildInfo`) during the build and
`readBuildInfo` or `ngrvDetector` from `ngrv/otel` at runtime. The single `ngrv` binary
remains, and `generate` now rejects unexpected positional arguments instead of ignoring
them.
