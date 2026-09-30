import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Unit chrome lives in Overview (sidebar embedded) and Tours (inline tab).
 * A full-width ShootUnitScopeBar must not sit above the Shoot Details tab row
 * on Notes/Requests/Settings/Activity/Media/etc.
 */
describe('Shoot Details unit chrome placement', () => {
  it('does not render a top ShootUnitScopeBar above modal tabs', () => {
    const source = readFileSync(
      resolve(__dirname, '../../components/shoots/details/ShootDetailsModalBody.tsx'),
      'utf8',
    );
    expect(source).toContain('ShootUnitScopeProvider');
    expect(source).not.toMatch(/ShootUnitScopeBar/);
  });

  it('does not render a top ShootUnitScopeBar above page tabs', () => {
    const source = readFileSync(
      resolve(__dirname, '../../pages/ShootDetails.tsx'),
      'utf8',
    );
    expect(source).toContain('ShootUnitScopeProvider');
    expect(source).not.toMatch(/ShootUnitScopeBar/);
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
