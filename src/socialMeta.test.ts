import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const workerSource = readFileSync(
  resolve(process.cwd(), 'workers/link-preview/src/index.js'),
  'utf8',
);

describe('crawler-visible social images', () => {
  it('pins homepage og and twitter images to the public origin', () => {
    expect(indexHtml).toContain('property="og:image" content="https://reprodashboard.com/og-image.jpg"');
    expect(indexHtml).toContain('name="twitter:image" content="https://reprodashboard.com/og-image.jpg"');
    expect(indexHtml).not.toMatch(/api\.reprodashboard\.com/);
  });

  it('rewrites api-host card URLs before injecting Open Graph tags', () => {
    expect(workerSource).toMatch(/toPublicCrawlerUrl/);
    expect(workerSource).toMatch(/api\.reprodashboard\.com/);
  });
});
