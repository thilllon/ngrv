# ngrv

[![npm](https://img.shields.io/badge/npm-ngrv-green)](https://www.npmjs.com/package/ngrv)
[![GitHub issues](https://img.shields.io/github/issues/thilllon/ngrv)](https://github.com/thilllon/ngrv/issues)

Engrave build information to the build output. Set environment variables automatically.

<!-- ##  -->
<!-- stop running the shell script to save build information. this pakcage craete files that includes build information and read it and set those values into process.env, by CLI and programmatically  -->

## Usage

### CLI

```sh
# that's it. nothing else. no need to install.
# default outputs: `__NGRV_BUILT_AT`, `__NGRV_COMMIT_HASH`
npx ngrv

# if you want to change the directory where ngrv files will be stored to './.ngrv', then
# default outputs: `./.ngrv/__NGRV_BUILT_AT`, `./.ngrv/__NGRV_COMMIT_HASH`
npx ngrv create -d .ngrv

# or
npx ngrv c -d .ngrv
```

```sh
npx ngrv read
# or
npx ngrv r
# or
npx ngrv r -d .ngrv

```

### Programmatically

```ts
import { engrave } from 'ngrv';

// create files with build information
engrave();
```

```ts
import { readEngrave } from 'ngrv';

// read the files and set information into the process.env
readEngrave();
```
# ngrv
# ngrv
