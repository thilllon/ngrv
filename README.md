# ngrv

Engrave build information to the build output. Set environment variables automatically.

## How to use?

```sh
# that's it. nothing else. no need to install.
npx ngrv

# if you want to change the directory where ngrv files will be stored to './.ngrv', then
# default outputs: `__NGRV_BUILT_AT`, `__NGRV_COMMIT_HASH`
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

## Roadmap

- [ ] add test
