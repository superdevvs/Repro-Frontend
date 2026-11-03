# Build glob advisory review

## Braces review retired — 2026-11-03

The upstream [GHSA-vfj7-8cjw-p6xm advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
was withdrawn on October 23, 2026 because it was not practically exploitable.
The primary advisory was checked again on November 3. The npm registry still
lists braces 3.0.3 and micromatch 4.0.8 as their latest releases.

The former braces exception and its November 3 expiration gate have been
removed. They were not extended: a future braces advisory, or a renewed report
for the withdrawn advisory, fails the normal audit policy and requires review.
The application/workspace import checks still prevent these build tools from
entering runtime source. The separate glob/minimatch review below and its
exact version, import, module-graph and expiration checks remain in force.

## Separate glob/minimatch review — 2026-10-31

This review covers only these advisory IDs and is independent of the retired
braces review:

- [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4):
  glob versions 9.0.0–14.0.1 can continue filesystem traversal after an
  AbortSignal cancellation. The upstream patch is 14.0.2.
- [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249):
  minimatch versions before 11.0.1 are flagged for pattern amplification during
  optimized preprocessing. The upstream patch is 11.0.1.

The exact locked installations and affected parent packages are recorded in
`scripts/build-glob-review.mjs`. The observed chains are:

| Build tool | Locked glob/minimatch paths |
| --- | --- |
| Tailwind 3.4.19 → sucrase 3.35.0 | glob 10.5.0 → minimatch 9.0.9 |
| ESLint 9.34.0 and its config packages | minimatch 3.1.5 |
| typescript-eslint 8.71.1 → typescript-estree | minimatch 10.2.6 |
| electron-builder 26.15.3 → app-builder-lib | minimatch 10.2.6 |
| app-builder-lib → @electron/asar 3.4.1 | glob 7.2.3 → minimatch 3.1.5 |
| app-builder-lib → @electron/universal 2.0.3 / dir-compare 4.2.0 | minimatch 9.0.9 / 3.1.5 |
| app-builder-lib → ejs → jake → filelist | minimatch 5.1.9 |
| electron-winstaller → temp → rimraf 2.6.3 | glob 7.2.3 → minimatch 3.1.5 |

The broad npm minimatch range includes the older installations; this review
does not assume they are unaffected. Forcing every consumer to minimatch 11
would change the legacy callable CommonJS API used by older toolchains.

Application and workspace sources were inspected, including `.cjs`/`.mjs`
desktop and server files. They do not import these glob engines or consume
customer glob patterns through the affected dependency chains. The sole
electron-builder import is the existing `packages/edit-helper/release.cjs`
packaging CLI. Its fixed artifact allowlist excludes that CLI and build tooling.
The editor helper's runtime uses Node built-ins, Electron and local modules;
the monitor desktop package copies explicit runtime files and its Vite renderer.
The dashboard is a static Vite build. A dependency's npm `dev` flag alone is
not proof here: Tailwind's transitive glob is hoisted without that flag.

The temporary review expires **2026-11-07 00:00 UTC**. Its audit gate requires
the exact reviewed advisory/package pairs and every locked version/location;
new advisories, parent packages, installations or versions fail closed.
Source scanning rejects direct imports of the reviewed toolchain from all
application/workspace JS/TS/CJS/MJS files, with only the packaging CLI's existing
electron-builder import allowed. Runtime imports of that CLI are also rejected.
Both dashboard and monitor renderer builds reject the reviewed tools anywhere
in their Rollup module graphs, including nested dependencies. Regression tests
exercise expiry, scope/version drift, runtime imports and module-graph rejection.

Residual risk remains in development and packaging: repository-controlled
patterns still execute with affected tools. Do not pass customer patterns into
builds or build unreviewed source with privileged credentials. Reassess before
expiry and migrate compatible upstream consumers to the patched majors; this
is not a blanket severity allowance or a statement that npm reports zero issues.
The unrelated follow-redirects advisory GHSA-mrwp-f3q8-3g9p is addressed by
upgrading its locked version from 1.16.1 to patched 1.16.2, not by this review.
