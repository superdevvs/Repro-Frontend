# Build glob advisory review

## Glob and minimatch review retired on 2026-11-07

- Sucrase 3.35.1 replaces glob 10 with tinyglobby. The older glob 7 copies used by Electron packaging fall outside the affected range. [Glob advisory](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4)
- The advisory now covers minimatch 7 through 11.0.0. The lock resolves minimatch 11.0.5 for `@electron/universal`, `app-builder-lib`, and `@typescript-eslint/typescript-estree`. These consumers use the named `minimatch` and `Minimatch` APIs. Older consumers keep their callable CommonJS versions. [Minimatch advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249)

The temporary allowance expired on November 7 and was removed after the dependency changes. The regular audit rejects any new or returning finding for these packages. Tests exercise the affected consumers' minimatch APIs and the runtime import and Rollup module guards.

The root Electron Builder pin matches the desktop workspace pins so npm applies the scoped overrides to the shared packaging graph.

The dashboard and monitor renderer builds continue to exclude the build toolchain. The edit-helper packaging CLI can import Electron Builder and the artifact allowlist keeps that CLI out of the shipped app.

## Braces review retired on 2026-11-03

The upstream advisory was withdrawn on October 23, 2026 because the issue was impractical to exploit. The former exception and its expiration gate were removed. Runtime source checks continue to keep these build tools out of the app. [Braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
