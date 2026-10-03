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
