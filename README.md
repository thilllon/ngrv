# ngrv

[![npm](https://img.shields.io/badge/npm-ngrv-green)](https://www.npmjs.com/package/ngrv)
[![GitHub issues](https://img.shields.io/github/issues/thilllon/ngrv)](https://github.com/thilllon/ngrv/issues)

`egrv`(called as engrave) build information to the build output. Set environment variables automatically.

<!-- stop running the shell script to save build information. this pakcage create files that includes build information and read it and set those values into process.env, by CLI and programmatically  -->

## Basic usage

### CLI

```sh
# That's it! Nothing else.
# Default outputs: `./.ngrv`
npx ngrv

# You can pass the output directory where outputs will be stored
npx ngrv --directory my_directory

# shortly,
npx ngrv -d my_directory
```

### read `.ngrv` file and load values as environment variables

```sh
npx ngrv read [--directory my_directory]

# or shortly,
npx ngrv r -d my_directory
```

### Programmatically

```ts
import { engrave } from 'ngrv';

// Create outputs with build information
const ngrvs = engrave();

console.log(ngrvs);
```

```ts
import { readEngrave } from 'ngrv';

// read the files and set information into the process.env
const ngrvs = readEngrave();

console.log(ngrvs);
```
