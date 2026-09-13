# RE brand motion

The brand library lives in `public/brand/re/index.html`. It preserves the original Motion Studio projects for Options 19, 18, 16, 14, 15, 6, 1 and 2, together with portable animation exports and static artwork. `public/brand/re/README.md` describes formats and regeneration; its manifest records source and export hashes.

## App integration

- Option 19 is reserved for page loading through `PageLoadingOverlay` and the initial HTML boot screen. Its logo measures 112 pixels on phones and 144 pixels on larger screens.
- `DashboardLayout` keeps the page mounted beneath a translucent blur until its initial data and visible images finish loading. Pages report initial work with `usePageLoading`; route or account changes start a new cycle. Background refreshes, downloads, saves and other actions do not reopen the overlay. Navigation stays available during loading.
- Buttons, downloads and smaller sections use the compact `InlineSpinner`. Image placeholders, skeletons and progress bars retain their lightweight feedback.
- Reduced-motion users receive `loading-static.svg`; compact spinners and skeletons also respect reduced motion.
- Option 18 supplies the favicon. `public/brand/favicon-runtime.js` uses its saved frame timing and perspective sprite, caching frames and pausing when hidden. SVG, ICO and PNG assets provide static fallbacks and touch icons.
- Frontend HTML and backend browser views share the favicon assets. Unbranded property link previews retain their existing branding behavior.
- Option 16 includes PNG exports from 16 to 1024 pixels. Its animated SVG scales to any resolution.

## Verification

Browser checks cover the page overlay on desktop and mobile portrait/landscape, light/dark themes, completion and scrolling, reduced motion, the initial boot loader, animated favicon updates and the saved-option gallery. The original saved projects remain unchanged.

Component tests cover overlapping initial tasks, delayed mount requests, visible image loading and errors, nested scroll clipping, route resets, nested layouts and non-blocking refreshes. Compact spinner and download tests verify busy states, button labels, completion and retry behavior. Favicon tests cover saved timing, frame caching, reduced motion, asset failures, visibility changes and browser back/forward cache restoration.

Each release runs TypeScript, the lint baseline gate, the full test suite, the production build, source-file and bundle-size gates, and the dependency audit. The release evidence records exact results and the deployed commit.

Backend Blade includes and copied favicon assets were inspected and compared. PHP is unavailable in the current Windows PATH, so backend template compilation was not run locally. Backend CI and the production deployment workflow validate the release and compile its templates before activation; release metadata records the deployed commits.
