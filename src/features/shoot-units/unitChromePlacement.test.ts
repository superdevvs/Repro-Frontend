import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Unit chrome is Overview-style embedded inside content panels — never a
 * full-width strip above the Shoot Details tab row.
 */
describe('Shoot Details unit chrome placement', () => {
  it('does not mount a full-width ShootUnitScopeBar above modal tabs', () => {
    const source = readFileSync(
      resolve(__dirname, '../../components/shoots/details/ShootDetailsModalBody.tsx'),
      'utf8',
    );
    expect(source).toContain('ShootUnitScopeProvider');
    expect(source).not.toMatch(/variant="compact"/);
    expect(source).not.toMatch(/border-b bg-background px-2 py-1[\s\S]*ShootUnitScopeBar/);
    expect(source).toContain('ShootDetailsPanelUnitChrome');
    expect(source).toMatch(/activeTab !== 'overview' && activeTab !== 'tours'/);
  });

  it('does not mount a full-width ShootUnitScopeBar above page tabs', () => {
    const source = readFileSync(
      resolve(__dirname, '../../pages/ShootDetails.tsx'),
      'utf8',
    );
    expect(source).toContain('ShootUnitScopeProvider');
    expect(source).not.toMatch(/variant="compact"/);
    expect(source).not.toMatch(/border-b bg-background px-3 py-1[\s\S]*ShootUnitScopeBar/);
    expect(source).toContain('ShootDetailsPanelUnitChrome');
  });

  it('panel chrome uses flush panel ShootUnitScopeBar (not Location top-rule)', () => {
    const panel = readFileSync(
      resolve(__dirname, './ShootDetailsPanelUnitChrome.tsx'),
      'utf8',
    );
    expect(panel).toMatch(/variant="panel"/);
    expect(panel).toMatch(/mb-1\.5/);
    expect(panel).not.toMatch(/mb-2[^-\d]/);
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
