# Repository instructions

Keep this file current with maintainer decisions. `CLAUDE.md` imports it.

## Language and scope

- Write code comments, repository documentation, issues, PRs, and commits in English.
- Respond to the maintainer in their preferred language.
- Keep NGRV focused on build-time capture and reading packaged metadata at runtime.
  The OTel subpath must not load the Git collector or legacy machine discovery.
- Prefer standard OTel attributes; custom metadata remains opt-in. Document the
  semantic-convention version and stability level when changing mappings.

## Toolchain and checks

- Use mise with the Node.js LTS and the pinned stable pnpm version.
- Use Lefthook for Git hooks. Keep checks nonmutating and installations explicit.
- Use Biome for supported source/config files and Prettier for Markdown/YAML.
- Build CJS and ESM with tsdown and matching declarations. Strict publint and attw
  checks belong in the build. Keep OpenTelemetry SDK dependencies development-only.
- Keep scripts and tool configurations typed as `.mts`. Tests use `*.test.ts`.
- Unit tests run without a build; `test:packaging` verifies built CLI subprocesses,
  real NodeSDK spans, and installed CJS/ESM consumers after `build`.
- Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  and `pnpm test:packaging` before merging. CI tests Node.js 22 and 24.
- Use real temporary repositories and isolated environments for discovery tests.
  Do not let CI provider variables or generated artifacts leak into fixture identity.

## Issues, PRs, and completion

- Create a GitHub issue and acceptance checklist before each workstream. Link every
  implementation PR to its issue and keep progress current.
- Work on independent tasks in parallel where the current session permits it.
  Isolate overlapping changes and merge dependent PRs in order.
- Use Conventional Commits and mark breaking changes with `!` or a breaking footer.
- Do NOT append Co-Authored-By lines. Pass `--body ''` to `gh pr merge`.
- Merge checked squash PRs into `main` with the required `Validate` result and
  resolved review conversations. Verify the exact head and current base; do not bypass
  protections or fabricate check success.
- The maintainer authorizes normal merges and releases as part of completing work.
  Continue through npm publication and registry verification unless scope is explicitly
  narrowed. A local commit or open PR alone is not completion.
- Preserve unrelated worktrees. Report actual credential or CI blockers precisely.

## Releases

- Changesets is the single versioning and publishing engine. Include an explicit
  Changeset for publishable changes; documentation-only changes need no release.
- Do not manually increment package versions or introduce another release engine.
- Publish through `release.yml` using npm trusted-publisher OIDC and provenance.
- A run that merges a version PR must dispatch a fresh publication run. Build only
  its immutable event commit so checkout, validation, and provenance describe one SHA.
- Keep head/base/tree checks and verified CI reporting when adapting release automation.
- Verify the npm version and release tag before closing the release issue.
