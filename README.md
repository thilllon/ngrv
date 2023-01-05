# ngrv

[![npm](https://img.shields.io/badge/npm-ngrv-green)](https://www.npmjs.com/package/ngrv)
[![GitHub issues](https://img.shields.io/github/issues/thilllon/ngrv)](https://github.com/thilllon/ngrv/issues)

> `ngrv` (called as engrave)

Engrave build information and set environment variables automatically.

<!-- stop running the shell script to save build information. this pakcage create files that includes build information and read it and set those values into process.env, by CLI and programmatically  -->

## Basic usage

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
