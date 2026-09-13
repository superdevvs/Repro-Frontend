# RE brand assets

Open `/brand/re/index.html` for all eight selected options.

- Main loader: Option 19, `loading.svg` with `loading-static.svg` for reduced motion.
- Favicon: compact Option 18, `favicon-static.svg`, nine PNG sizes and `favicon.ico` (16/32/48). Animated frames are in `favicon-sprite.png`; timing and layout are in `favicon-animation.json`.
- Option 16: `options/16/loop.svg` and HTML, plus settled PNGs at 16, 24, 32, 48, 64, 96, 128, 192, 256, 512, 1024 px.
- Saved Options 14, 15, 6, 1 and 2 are retained alongside 19, 18 and 16.

Every option contains the byte-identical original saved `project.json`, native-keyframe HTML loop and entrance exports, and a settled SVG. Two-dimensional options also have the Motion Studio animated SVG export. Options 14 and 18 retain 3D movement in HTML; SVG is provided for the settled mark.

The loader uses a centered 384px viewBox. The favicon uses a centered 280px viewBox that contains Option 18's complete motion and keeps the letter proportions intact. Its 64 perspective-rendered frames preserve native timing, rotations, original gradient colors and transparent edges. No source project is changed.

Regenerate with `node public/brand/re/export-brand-library.mjs` in Motion Studio while its local API is running. Set `RE_BRAND_NODE_MODULES` if the bundled sharp dependency is elsewhere; an optional first argument chooses the output directory. `manifest.json` records source and output SHA-256 hashes.
