import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Unit chrome is visible on every multi-unit Shoot Details surface.
 * Overview uses embedded sidebar chrome; Tours uses inline tab chrome;
 * all other tabs use a compact single-row bar above the tab content.
 */
describe('Shoot Details unit chrome placement', () => {
  it('mounts compact ShootUnitScopeBar above modal tabs for non-Overview/non-Tours', () => {
    const source = readFileSync(
      resolve(__dirname, '../../components/shoots/details/ShootDetailsModalBody.tsx'),
      'utf8',
    );
    expect(source).toContain('ShootUnitScopeProvider');
    expect(source).toMatch(/activeTab !== 'overview' && activeTab !== 'tours'/);
    expect(source).toMatch(/ShootUnitScopeBar[\s\S]*variant="compact"/);
  });

  it('mounts compact ShootUnitScopeBar on the Shoot Details page for non-Tour tabs', () => {
    const source = readFileSync(
      resolve(__dirname, '../../pages/ShootDetails.tsx'),
      'utf8',
    );
    expect(source).toContain('ShootUnitScopeProvider');
    expect(source).toMatch(/activeTab !== 'tour'/);
    expect(source).toMatch(/ShootUnitScopeBar[\s\S]*variant="compact"/);
  });

  it('keeps Overview embedded and Tours inline unit selectors', () => {
    const overview = readFileSync(
      resolve(__dirname, './withShootUnitOverview.tsx'),
      'utf8',
    );
    const tours = readFileSync(
      resolve(__dirname, '../../components/shoots/tabs/ShootUnitTourTab.tsx'),
      'utf8',
    );
    expect(overview).toMatch(/ShootUnitScopeBar[\s\S]*variant="embedded"/);
    expect(tours).toMatch(/ShootUnitScopeBar[\s\S]*variant="inline"/);
  });
});
