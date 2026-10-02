# Contributing

Open a GitHub issue with an acceptance checklist before implementation. Link the
implementation PR to it, keep independent work isolated, and use Conventional
Commit titles. Breaking changes use `!` or a `BREAKING CHANGE:` footer.

## Development

Install [mise](https://mise.jdx.dev/), then run `mise install` and `mise run setup`.
The repository pins pnpm and hook tools; Node.js follows the LTS channel.

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:packaging
pnpm test:example
```

`pnpm format` rewrites formatting. The checks above do not modify source files.
Unit tests use temporary repositories and require no build or cloud credentials.
Packaging tests run after the build and inspect installed artifacts, type declarations,
CLI behavior, and real OpenTelemetry spans.

Hooks scan for secrets: Gitleaks checks staged changes before a commit, and
TruffleHog checks unpushed commits before a push and tries to verify what it finds.
CI repeats both scans over the whole pushed range. Mark an intentional
credential-shaped test fixture with a `trufflehog:ignore` comment.

Keep build metadata immutable after capture. Include the generated JSON in the
application deployment; the runtime detector must never probe Git or regenerate it.

## Release changes

Include a Changeset naming `ngrv` for publishable changes. Use major for breaking
API/runtime changes, minor for compatible features, and patch for fixes. Documentation,
tests, and repository-only tooling do not require their own release.

Merge checked squash PRs into `main`. The release workflow prepares version updates,
validates and merges them, and publishes the resulting immutable revision through npm
trusted publishing. Do not manually bump package versions or publish an unmerged tree.
See [release automation](docs/releases.md) for owner setup, validation and retries.

Do not add Co-Authored-By trailers. See [AGENTS.md](AGENTS.md) for repository rules.
