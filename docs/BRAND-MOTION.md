# RE brand motion

The brand library lives in `public/brand/re/index.html`. It preserves the original Motion Studio projects for Options 19, 18, 16, 14, 15, 6, 1 and 2, together with portable animation exports and static artwork. `public/brand/re/README.md` describes formats and regeneration; its manifest records source and export hashes.

## App integration

- Option 19 is the shared `BrandLoader` in `src/components/ui/brand-loader.tsx`, used by page, button, image, download and other indeterminate loading states. The initial HTML boot screen uses the same artwork before React loads.
- Reduced-motion users receive `loading-static.svg`. Structural skeletons remain static; actual progress bars still display measured completion.
- Option 18 supplies the favicon. `public/brand/favicon-runtime.js` uses its saved frame timing and perspective sprite, caching frames and pausing when hidden. SVG, ICO and PNG assets provide static fallbacks and touch icons.
- Frontend HTML and backend browser views share the favicon assets. Unbranded property link previews retain their existing branding behavior.
- Option 16 includes PNG exports from 16 to 1024 pixels. Its animated SVG scales to any resolution.

## Verification

Browser checks cover the actual loader at 16, 24, 48 and 96 pixels on light/dark backgrounds, the initial boot loader, animated favicon updates, reduced-motion fallback, and the saved-option gallery. The original saved projects are unchanged; exported HTML, SVG, PNG, ICO and sprite integrity checks pass.

Component and download tests verify busy states, button labels, completion and retry behavior. Favicon tests cover saved timing, frame caching, reduced motion, asset failures, visibility changes and browser back/forward cache restoration.

TypeScript, the lint baseline gate, the production build, the source-file size gate and the bundle-size gate pass. The complete frontend suite passes 1,827 tests across 299 files. The motion export suite also passes 55 relevant checks. Focused app verification includes 22 component/download tests and seven favicon tests.

Backend Blade includes and copied favicon assets were inspected and compared. PHP is unavailable in the current Windows PATH, so backend template compilation was not run locally. Backend CI and the production deployment workflow validate the release and compile its templates before activation; release metadata records the deployed commits.
