# ngrv

[![npm](https://img.shields.io/badge/npm-ngrv-green)](https://www.npmjs.com/package/ngrv)
[![issues](https://img.shields.io/github/issues/thilllon/ngrv)](https://github.com/thilllon/ngrv/issues)
[![size](https://img.shields.io/bundlephobia/minzip/ngrv)](https://www.npmjs.com/package/ngrv)
[![download](https://img.shields.io/npm/dw/ngrv)](https://www.npmjs.com/package/ngrv)
[![license](https://img.shields.io/npm/l/ngrv)](https://www.npmjs.com/package/ngrv)

`ngrv` (engrave) engraves build information and registers those as environment variables to `process.env`.

<!-- stop running the shell script to save build information. this pakcage create files that includes build information and read it and set those values into process.env, by CLI and programmatically  -->

## Usage

**Build CLI → packaged `build-info.json` → OpenTelemetry `NodeSDK()`**

This section describes the v4 API tracked in [#1](https://github.com/thilllon/ngrv/issues/1).
The npm release is currently 3.0.6; the following commands apply once v4 is published.

### 1. Capture metadata during the build

Install NGRV in your Node.js application:

```sh
pnpm add ngrv@^4
```

Run the CLI after compilation, while the source checkout is available:

```sh
pnpm build
pnpm exec ngrv generate --output dist/build-info.json --strict
```

The CLI records the checked-out Git revision, package name/version, and available CI
metadata. Include `dist/build-info.json` in the deployed application or final container
image. Every instance of that artifact reads the same captured build identity.

### 2. Register the detector in `NodeSDK()`

Install the OTel components used in this example:

```sh
pnpm add @opentelemetry/api @opentelemetry/resources @opentelemetry/sdk-node \
  @opentelemetry/exporter-trace-otlp-http @opentelemetry/auto-instrumentations-node
```

Create `instrumentation.mjs` next to `dist/`:

```js
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { envDetector, hostDetector, processDetector } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ngrvDetector } from 'ngrv/otel';

const sdk = new NodeSDK({
  resourceDetectors: [
    ngrvDetector({ file: new URL('./dist/build-info.json', import.meta.url) }),
    processDetector,
    hostDetector,
    envDetector,
  ],
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

Include this module in the deployment and preload it before the application:

```sh
node --import ./instrumentation.mjs ./dist/app.js
```

Configure the exporter for your OTel collector, and call `sdk.shutdown()` from your
application's shutdown lifecycle. This preload example assumes CommonJS application
dependencies; ESM auto-instrumentation may additionally require the
[OTel ESM loader hook](https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md).

The detector adds `service.name`, `service.version`, `vcs.ref.head.revision`, and, when
available, `cicd.pipeline.run.url.full` as Resource attributes. It only reads the
packaged JSON; Git is not needed in the running application. Custom `ngrv.*` attributes
are off by default.

Setting `resourceDetectors` replaces OTel's default list, so the example preserves
process, host, and environment detection. `envDetector` runs last to allow deliberate
deployment overrides. Resource detection must remain enabled (the SDK default).

## Legacy usage (v3)

### CLI

- Create `.ngrv` file which contains build information

```sh
# That's it! Nothing else. Default outputs will be stored in `./.ngrv`
npx ngrv

# You can pass the output directory where outputs will be stored
npx ngrv --directory my_directory

# shortly,
npx ngrv -d my_directory
```

- Read `.ngrv` file and load values as environment variables

```sh
npx ngrv read [--directory my_directory]

# or shortly,
npx ngrv r -d my_directory
```

### Programmatically

- Create `ngrv`

```ts
import { engrave } from 'ngrv';

// Create outputs with build information
const ngrvs = engrave();

console.log(ngrvs);
```

- Read `ngrv`

```ts
import { readEngrave } from 'ngrv';

// Read the files and set information into the process.env
const ngrvs = readEngrave();

console.log(ngrvs);
```

### Example

```sh
cd example
pnpm install
pnpm dev # or pnpm cli
```
