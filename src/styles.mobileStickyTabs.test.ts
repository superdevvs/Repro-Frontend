import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The shared sticky filter/tab bar must stay phone-only (desktop untouched)
// and sit flush under the top nav inside the compact shell's <main> scroller.
describe('mobile-sticky-tabs utility', () => {
  const css = readFileSync(resolve(__dirname, 'index.css'), 'utf8');
  const start = css.indexOf('@media (max-width: 767px)');
  const block = css.slice(start, css.indexOf('/* Ensure TabsContent displays correctly when active */'));

  it('is defined only inside the <768px media block', () => {
    expect(start).toBeGreaterThan(-1);
    expect(css.split('.mobile-sticky-tabs {').length - 1).toBe(1);
    expect(block).toContain('.mobile-sticky-tabs {');
  });

  it('sticks under the nav with an opaque background', () => {
    const rule = block.slice(block.indexOf('.mobile-sticky-tabs {'), block.indexOf('}', block.indexOf('.mobile-sticky-tabs {')));
    expect(rule).toMatch(/position:\s*sticky/);
    expect(rule).toMatch(/top:\s*-0\.375rem/);
    expect(rule).toMatch(/z-index:\s*20/);
    expect(rule).toMatch(/background-color:\s*var\(--mobile-sticky-tabs-bg, hsl\(var\(--background\)\)\)/);
  });
});
