---
'ngrv': minor
---

Fall back to Vercel system environment variables when `VERCEL=1`: `VERCEL_GIT_COMMIT_SHA`
supplies the source revision when no Git checkout is available, and `VERCEL_URL` supplies the
deployment build logs URL (`https://<VERCEL_URL>/_logs`). Explicit options and the Git checkout
still take precedence, and GitHub Actions or GitLab CI win when their marker is also set.
