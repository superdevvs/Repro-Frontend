# Build glob advisory review — 2026-10-03

GHSA-vfj7-8cjw-p6xm affects braces 3.0.3 and currently has no patched release:
https://github.com/advisories/GHSA-vfj7-8cjw-p6xm

Deeply nested attacker-controlled brace patterns can exhaust the Node stack.
The locked dependency paths here are TypeScript ESLint and Tailwind (including
the development-only Lovable tagger), through fast-glob/micromatch or chokidar.
Their patterns come from reviewed repository configuration, not dashboard
requests, uploaded media, worker payloads, or customer input. The production
dashboard serves a static Vite build; it does not expose these build tools as an API.
The monitor application packages do not import these tools either.

The temporary audit exception is limited to this advisory and its enumerated
affected dependency chain, braces 3.0.3 / micromatch 4.0.8, and expires on
2026-11-03. Source scanning rejects imports of these build tools from application
and workspace code. A Rollup module-graph guard additionally fails the build if
the glob tools are bundled transitively into any shipped browser chunk. All
other advisories still fail the audit. npm run audit:raw retains the full report.

Residual risk: builds still execute repository-controlled patterns with vulnerable
tools. Do not feed customer-supplied patterns to them or run unreviewed repository
changes in a privileged build. Replace the exception with the upstream fix once
available, or reassess it before expiry.

## Separate glob/minimatch review — 2026-10-31

This review covers only these newly published advisory IDs; it does not change
the braces review or its November 3 expiry:

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
