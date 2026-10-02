# Platform guides

Where to run `birthplace generate`, and what each build platform changes about the result.

The statements about birthplace itself are covered by this repository's tests. The statements about
GitHub Actions, Vercel, Docker, and Turborepo come from their documentation and were **not verified
on a live deployment**; in particular, nothing here was tested on a real Vercel deployment. Inspect
the generated file in your own pipeline (`birthplace inspect <file>`) before relying on it.

- [The build script](#the-build-script)
- [GitHub Actions](#github-actions)
- [Vercel](#vercel)
- [Docker](#docker)
- [Turborepo and other task caches](#turborepo-and-other-task-caches)
- [OpenTelemetry SDK behavior](#opentelemetry-sdk-behavior)

## The build script

Run exactly one `birthplace generate` call during the build, from the `build` script in
`package.json`. Do not put it in GitHub or Vercel settings: the script travels with the repository
and behaves the same on every machine that builds it.

Chain it explicitly, and choose the position by how the application loads the file.

When the application reads the file with `fs` at runtime, generate **after** compiling, because a
build that cleans `dist` would delete a file generated earlier:

```json
{
  "scripts": {
    "build": "tsc && birthplace generate --output dist/birthplace.json"
  }
}
```

When the application imports the file, generate **before** the bundler, so the module exists when
the bundler resolves the import:

```json
{
  "scripts": {
    "build": "birthplace generate --format esm --output src/birthplace.mjs && next build"
  }
}
```

Do not rely on `prebuild` / `postbuild` scripts:

- pnpm 6 to 8 do not run pre and post scripts by default; pnpm 9 and later and npm do. The same
  repository can therefore build with or without the birthplace file depending on the package
  manager version.
- Vercel runs the `vercel-build` script if it exists, then `now-build`, then `build`. A
  `buildCommand` in `vercel.json` or a Build Command override in the dashboard bypasses the
  `package.json` scripts entirely.

An explicit `&&` chain inside the script that actually runs has neither problem.

## GitHub Actions

No workflow change is needed. `actions/checkout` with its default depth of 1 is enough: birthplace
reads only `HEAD` and the working tree status.

- **Pull requests build a merge commit.** On `pull_request` events, the checked-out `HEAD` and
  `GITHUB_SHA` are a temporary merge commit of the pull request into its base branch, not the commit
  you pushed. That revision does not exist on any branch. If you want the pull request head instead,
  check it out:

  ```yaml
  - uses: actions/checkout@v4
    with:
      ref: ${{ github.event.pull_request.head.sha }}
  ```

  or keep the default checkout and pass
  `--revision ${{ github.event.pull_request.head.sha }}` to `birthplace generate`.

- **Git wins over the provider.** The checkout's `HEAD` is used when Git can read it; `GITHUB_SHA`
  is only the fallback. The run URL
  (`<GITHUB_SERVER_URL>/<GITHUB_REPOSITORY>/actions/runs/<GITHUB_RUN_ID>`) is filled in from the
  environment without any flag.
- **Dirty state is the real working tree.** `source.dirty` is `true` when `git status --porcelain`
  reports anything, including untracked files that are not ignored. Build output that is not listed
  in `.gitignore` makes a CI build dirty.

## Vercel

Not verified on a live Vercel deployment.

- **Git-triggered builds** use a shallow clone (depth 10), which is enough for `HEAD` and the
  status.
- **The checkout is often unavailable.** `vercel deploy` source uploads do not include `.git`, and a
  monorepo Root Directory may hide it. birthplace then falls back to the Vercel provider:
  `VERCEL_GIT_COMMIT_SHA` for the revision and `https://<VERCEL_URL>/_logs` for the build URL.
- **The fallback needs system environment variables.** Enable **Automatically expose System
  Environment Variables** in the project's Environment Variables settings. `VERCEL_GIT_COMMIT_SHA`
  is only populated for deployments created from a connected Git repository; an empty value is
  treated as unknown, so `--strict` fails instead of recording a guess.
- **`vercel build` with `vercel deploy --prebuilt`** runs the build on your own machine or CI, not
  on Vercel. Vercel's system environment variables are absent at build time, so the revision comes
  from the local checkout or the CI provider. Pass `--revision` when neither is available.
- **Script precedence.** Vercel runs `vercel-build`, then `now-build`, then `build`, and a
  `buildCommand` or dashboard override bypasses all of them (see
  [The build script](#the-build-script)). Put `birthplace generate` in the script that actually
  runs.

### Prefer the import-based setup

Files read with `fs` at runtime can be missing from a function bundle, and a missing file drops the
attributes silently (see [OpenTelemetry SDK behavior](#opentelemetry-sdk-behavior)). Generate an ESM
birthplace file before the bundler and import it:

```json
{
  "scripts": {
    "build": "birthplace generate --format esm --output src/birthplace.mjs && next build"
  }
}
```

```js
import { birthplaceDetector } from 'birthplace/otel';
import birthplace from './birthplace.mjs';

const detector = birthplaceDetector({ info: birthplace });
```

Add `src/birthplace.mjs` to `.gitignore`. See
[Import instead of read](../README.md#import-instead-of-read) for the TypeScript notes.

`@vercel/otel` already maps `VERCEL_GIT_COMMIT_SHA` to a resource attribute at runtime, and its
`registerOTel` accepts `resourceDetectors`. Pass the detector there if you use that package. The
combination was not tested in this repository.

## Docker

Generate the birthplace file in the build stage and copy it into the runtime stage. The runtime
image needs neither Git nor the repository.

```dockerfile
FROM node:24 AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build   # "build": "tsc && birthplace generate --output dist/birthplace.json"

FROM node:24-slim
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
CMD ["node", "dist/app.js"]
```

- **`.dockerignore` commonly excludes `.git`.** Then the build stage has no checkout, the revision
  is absent, and `--strict` fails. Either keep `.git` in the build context or pass the revision as a
  build argument:

  ```dockerfile
  ARG REVISION
  RUN npm run build -- --revision "$REVISION"
  ```

  ```sh
  docker build --build-arg REVISION="$(git rev-parse HEAD)" .
  ```

  `npm run build -- <flags>` appends the flags to the end of the script, so this works only when
  `birthplace generate` is the last command in the chain. With an explicit `--revision` and no
  checkout, `source.dirty` is omitted: birthplace never assumes that a checkout is clean.

- **Slim images lack `git`.** Without the `git` executable birthplace behaves as if there were no
  checkout, even when `.git` was copied. Generate in a stage whose image has Git (the full `node`
  image does; `node:*-slim` and `node:*-alpine` do not), or pass `--revision`.
- **CI provider variables do not cross into the build.** `GITHUB_SHA` and the other provider
  variables exist in the CI job, not inside `docker build`, unless you forward them as build
  arguments.
- **Copy the file.** A file generated in the build stage is not in the runtime stage until a `COPY`
  puts it there. If it lives outside `dist`, copy it explicitly.

## Turborepo and other task caches

A task cache restores the outputs of an earlier run. If `birthplace generate` is part of a cached
`build` task and the birthplace file is one of its outputs, a cache hit restores a birthplace file
from an **older commit**: the revision, timestamp, and build URL describe the run that populated the
cache, not the current one. This applies to Turborepo, Nx, and any remote or CI cache that restores
build output.

Pick one remedy:

1. **Run generate as an uncached task after the build.** This fits a file that is read at runtime.

   In `package.json`, split the build into two scripts:

   ```json
   {
     "scripts": {
       "build": "tsc",
       "build:metadata": "birthplace generate --output dist/birthplace.json"
     }
   }
   ```

   In `turbo.json`, make the second task depend on the first and disable its cache:

   ```json
   {
     "tasks": {
       "build": { "outputs": ["dist/**"] },
       "build:metadata": { "dependsOn": ["build"], "cache": false }
     }
   }
   ```

   Run `turbo run build:metadata` wherever you ran `turbo run build`, including the platform's build
   command.

2. **Accept per-commit cache busting.** When the file is imported, it is baked into the bundle, so
   it cannot be regenerated after the build. Make the commit part of the task's cache key instead,
   for example by listing the provider's commit variable (`GITHUB_SHA`, `VERCEL_GIT_COMMIT_SHA`) in
   the `env` of the `build` task in `turbo.json`. Every new commit then rebuilds that package.

## OpenTelemetry SDK behavior

Two SDK behaviors matter on every platform.

**Passing `resourceDetectors` replaces the defaults.** `NodeSDK` uses its environment, process, and
host detectors only when `resourceDetectors` is not set. List them again, with `envDetector` last so
that `OTEL_RESOURCE_ATTRIBUTES` and `OTEL_SERVICE_NAME` can deliberately override build attributes:

```js
import { envDetector, hostDetector, processDetector } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { birthplaceDetector } from 'birthplace/otel';

const sdk = new NodeSDK({
  resourceDetectors: [
    birthplaceDetector({ file: new URL('./dist/birthplace.json', import.meta.url) }),
    processDetector,
    hostDetector,
    envDetector,
  ],
});
```

**A failing detector is logged and skipped.** OpenTelemetry catches the error, so a missing or
invalid birthplace file does not stop the application: the build attributes are dropped silently
unless diagnostic logging is enabled. If the metadata must be present, read it yourself before
starting the SDK, which throws a `BirthplaceError`:

```js
import { fileURLToPath } from 'node:url';
import { readBirthplace } from 'birthplace';
import { birthplaceDetector } from 'birthplace/otel';

// readBirthplace takes a path string; a relative path resolves against the working directory.
const file = fileURLToPath(new URL('./dist/birthplace.json', import.meta.url));
const info = readBirthplace(file);
const detector = birthplaceDetector({ info });
```

The import-based setup has the same effect without a runtime read: a missing module fails the build
or the import instead of being skipped.
