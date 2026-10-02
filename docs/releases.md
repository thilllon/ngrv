# Release automation

birthplace follows the Changesets and npm trusted-publishing workflow used by
[nestjs-kit](https://github.com/thilllon/nestjs-kit). Changesets is the only
versioning and publishing engine. The root `birthplace` package is explicitly included
in `pnpm-workspace.yaml`; `example` is private and is never published.

## From a change to npm

1. Open an issue and implement a PR with a Changeset for publishable changes.
   Run `pnpm changeset`, select `birthplace` and describe the user-facing change.
   Use major for breaking APIs or runtime requirements, minor for compatible
   features and patch for compatible fixes. Documentation-only changes need none.
2. After the checked PR merges, Release checks out its immutable event SHA.
   `changeset version` consumes pending Changesets, updates the package version
   and changelog, and refreshes the lockfile. Multiple entries combine into one
   bump using the strongest requested level.
3. Automation opens or refreshes `automation/releases` and dispatches full CI on
   that exact commit. CI rejects an unexpected SHA. Release verifies the
   repository, workflow, run key, commit and successful `Validate` job before
   reporting the linked result on the PR head through the Checks API.
4. Release merges only when the PR head and original main base still match the
   validated commits. It verifies the resulting merged tree. Branch protections
   apply to the bot too; no bypass or personal GitHub token is used.
5. A run that merges the version PR never publishes. It dispatches a fresh Release
   run on main. That run validates its own immutable event commit and publishes
   only when no pending Changesets require another version PR.
6. Publication builds CJS/ESM and their matching declarations, runs strict
   publint/attw checks and installed-consumer tests, then runs
   `pnpm release:publish`. Changesets publishes versions absent from npm through
   pnpm, using OIDC and `publishConfig.provenance`.
7. `changeset git-tag` recovers missing current-version tags after publication.
   The workflow pushes tags without changing a branch. Verify the npm version
   and tag before closing the release issue.

Do not move or rename `.github/workflows/release.yml`: npm trust names this
calling workflow. A separate fresh publication run ensures `GITHUB_SHA`, checkout,
validation and signed provenance all refer to the commit used to build the archive.

## One-time owner setup

The `birthplace` name is claimed and released in three steps, in this order:

1. The owner claims the name with a manual placeholder publish of version `0.0.0`.
   npm can only attach a trusted publisher to a package that already exists, and
   `package.json` stays at `0.0.0` until the first Changesets release. This is the
   only manual publish; it is done once from the owner's machine, never by automation.
2. The owner registers the npm trusted publisher for repository
   `thilllon/birthplace` and workflow `release.yml` using these settings:

   | Setting           | Value            |
   | ----------------- | ---------------- |
   | npm package       | `birthplace`     |
   | GitHub owner      | `thilllon`       |
   | Repository        | `birthplace`     |
   | Workflow filename | `release.yml`    |
   | Environment       | Leave empty      |
   | Permission        | Allow publishing |

   An authenticated package owner with 2FA can use npm's native command:

   ```sh
   npm trust github birthplace --repository thilllon/birthplace --file release.yml --allow-publish
   npm trust list birthplace
   ```

3. `release.yml` publishes `1.0.0`. The single major Changeset of the rename
   workstream moves the version from `0.0.0` to exactly `1.0.0`, Changesets creates
   `CHANGELOG.md` with that one entry, and the workflow publishes it through OIDC
   with provenance. No `CHANGELOG.md` exists in the repository before that release.

Allow GitHub Actions to create pull requests. Set repository Actions variable
`NPM_PUBLISH_ENABLED=true` only after verifying trust. Before that, version PRs
can run but publication stays disabled. The publish job grants `id-token: write`
on a GitHub-hosted runner; no long-lived npm token is stored in Actions secrets.

Main requires an up-to-date squash PR, successful GitHub Actions `Validate`, and
resolved review conversations. Force pushes and deletion are blocked. No actor
bypasses the rules; zero mandatory approvals supports solo maintenance.

## Verified CI reporting

GitHub's dispatched workflow job checks do not satisfy required PR checks by
themselves. Release reports a `Validate` check only after independently verifying
the full successful CI run for the exact release head, and links to that run.
The validation job does not check out or execute package code.

A bot-opened PR can also receive a pull-request run awaiting approval. After the
version PR merges, cleanup removes that unapproved run only when it has no jobs
and its check suite has no checks. The real CI run and verified result are retained.

## Retries and verification

For a failed publication or tag push, rerun the failed job in the original
publication workflow run. Its immutable event commit remains the source for
validation, build and tags. Do not use a later checkout to repair an older tag.
Changesets skips versions already present on npm, so a retry does not overwrite
published packages. Use a new manual Release run to intentionally release the
latest main revision or to enable publication after owner setup.

```sh
pnpm exec changeset status
pnpm exec changeset publish-plan
npm view birthplace version
git ls-remote --tags origin
```

`pnpm release:publish` performs an actual publication. Its local invocation is not
protected by the GitHub Actions variable; use the workflow for normal releases.

See the official [npm trusted publishing guide](https://docs.npmjs.com/trusted-publishers/),
[npm trust command](https://docs.npmjs.com/cli/v11/commands/npm-trust/),
[Changesets commands](https://github.com/changesets/changesets/blob/main/docs/command-line-options.md),
and [GitHub required-check guidance](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks#checks-from-some-workflow-jobs-are-not-evaluated).
