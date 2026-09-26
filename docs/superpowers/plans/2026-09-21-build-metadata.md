# Build Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship immutable Node.js build metadata with a dependency-free OpenTelemetry adapter and an additive CLI, then open a PR.

**Architecture:** Collection, schema validation, persistence, and OTel attribute conversion are separate modules. Applications generate metadata during the build and read it during instrumentation startup; legacy functions remain available.

**Tech Stack:** TypeScript, Node.js, Commander, Jest/SWC, tsup, pnpm 8.15.9.

**Spec:** `docs/superpowers/specs/2026-09-21-build-metadata-design.md`

## Global Constraints

- Existing `.ngrv` files, `engrave`, `readEngrave`, and `create`/`read` CLI commands remain supported.
- No OTel runtime dependency or SDK/exporter lifecycle management.
- No global process.env mutation occurs in new code.
- Full SHA-1 or SHA-256 commit IDs are accepted.
- Strict mode requires service name, service version, and source revision.
- Checkout Git overrides provider environment fallbacks; explicit options override discovery.
- CI runs on Node.js 22 and 24, with pnpm 8.15.9.
- Commit without Co-Authored-By trailers. Do not merge or publish.

## Task 1: Build metadata library and OTel conversion

**Files:** Create `src/build-info.ts`, `src/collect.ts`, `src/storage.ts`, `src/otel.ts`, `src/errors.ts`, `tests/build-info.spec.ts`. Modify `src/index.ts`.

**Interfaces:** Produce the exact BuildInfo shape and APIs in the spec; consume no legacy functions. Collection accepts cwd/env overrides so CI fallbacks can be exercised without changing global environment.

- [ ] Write failing behavioral tests for a temporary package and real Git repository: explicit name/version override package.json, actual checkout beats a different CI SHA, dirty state follows actual file edits, and collection leaves files/environment unchanged. Example expectations:

```ts
expect(collectBuildInfo({ cwd, env: {}, timestamp: false })).toMatchObject({
  schemaVersion: 1,
  service: { name: 'fixture', version: '1.2.3' },
  source: { revision: initialCommit, dirty: false },
  build: {},
});
expect(() => collectBuildInfo({ cwd: emptyDir, env: {}, strict: true })).toThrow();
```

- [ ] Run `mise exec node@22.22.0 pnpm@8.15.9 -- pnpm exec jest tests/build-info.spec.ts --runInBand` and record expected missing-feature failures.
- [ ] Implement validation, typed errors, collection, persistence, and conversion. Follow the spec for timestamps/provider fallback and explicit safe serialization. Keep each module focused; collection may use a helper module if needed for clarity.
- [ ] Add and run boundary tests: missing Git, GitHub/GitLab fallback only when provider markers exist, malformed metadata/manifest/date, epoch zero, explicit timestamp precedence, omitted timestamp, strict missing fields, round-trip JSON, dynamic import of generated ESM, failed writes, missing/corrupt read, no additional sensitive properties, and all OTel mappings with undefined fields omitted.

```ts
expect(
  toOtelAttributes({
    schemaVersion: 1,
    service: { name: 'fixture', version: '1.2.3' },
    source: { revision: 'a'.repeat(40), dirty: false },
    build: {},
  })
).toEqual({
  'service.name': 'fixture',
  'service.version': '1.2.3',
  'ngrv.source.revision': 'a'.repeat(40),
  'ngrv.source.dirty': false,
});
```

- [ ] Run focused tests, existing legacy tests, TypeScript check, and scoped lint/format checks. Commit and report RED/GREEN evidence and API details.

## Task 2: CLI, published package, OTel example, documentation, and CI

**Files:** Modify `src/cli.ts`, `package.json`, `pnpm-lock.yaml`, `tsup.config.ts`, `tsconfig.json`, `README.md`, `tests/ngrv.e2e.test.ts`, `.gitignore`. Create `tests/otel.spec.ts`, `.github/workflows/ci.yml`; a small package-smoke script is allowed if it runs the actual packed artifact.

**Interfaces:** Consume collectBuildInfo, readBuildInfo, writeBuildInfo, toOtelAttributes from Task 1. Expose `ngrv/otel` subpath for both require and import without eagerly loading collector/storage. Keep root and historical bin paths working.

- [ ] Replace the existing tautological e2e placeholder with real subprocess tests against built CLI artifacts. Assert generate followed by inspect returns fixture fields, `--otel` yields standard service fields and custom build fields, invalid format/data/missing strict fields/write failures exit nonzero, and legacy `create/read` still round-trip.

```ts
const generated = spawnSync(
  process.execPath,
  [
    cli,
    'generate',
    '--cwd',
    fixture,
    '--output',
    artifact,
    '--name',
    'demo',
    '--service-version',
    '2.0.0',
    '--revision',
    'b'.repeat(40),
    '--no-timestamp',
    '--strict',
  ],
  { encoding: 'utf8' }
);
expect(generated.status).toBe(0);
const inspected = spawnSync(process.execPath, [cli, 'inspect', artifact, '--otel'], {
  encoding: 'utf8',
});
expect(JSON.parse(inspected.stdout)['service.version']).toBe('2.0.0');
```

- [ ] Build and run focused tests; confirm missing commands fail before adding CLI implementation.
- [ ] Add commands, nonzero error reporting, correct entrypoints/exports, and a real OTel resource integration test using `@opentelemetry/resources` as a dev dependency. Preserve the legacy default command and bins.
- [ ] Align packageManager to pnpm 8.15.9 and add nonmutating `typecheck`, `lint:check`, `format:check`, and `check` scripts. Typecheck includes all new tests. Keep dependency changes scoped to the OTel test requirement and necessary compatibility.
- [ ] Rewrite README around Node.js OTel usage, JSON packaging and initialization order, API/CLI options, exact precedence, strictness, timestamp semantics and examples, custom attribute names, and migration from legacy APIs. Explain JSON read vs generated ESM import. Ensure the documented example constructs a real OTel Resource.
- [ ] Add GitHub Actions for Node.js 22 and 24: frozen install, static checks, build, real tests and package smoke. Use official action major versions verified by the controller. No publish workflow or secrets required.
- [ ] Run the complete check on Node.js 22 and 24. Pack into a temporary folder; in a fresh consumer exercise require/import for root and OTel subpath, installed CLI generate/inspect, and generated module import. Commit and report commands/results.

## Completion

- [ ] Task-scoped reviews verify spec and quality; implementer fixes findings with focused regression checks.
- [ ] Whole-branch review examines package integration and legacy compatibility.
- [ ] Push feature branch and open a PR with a reviewable problem/behavior/validation description. Inspect CI results and fix failures within scope.
