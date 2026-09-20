import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_MOBILE_PAGE_CLASS,
  DASHBOARD_MOBILE_PANEL_CLASS,
  resolveDashboardListMaxHeight,
} from './dashboardMobilePanel';

const indexCss = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../index.css'),
  'utf8',
);

describe('resolveDashboardListMaxHeight', () => {
  it('does not stretch compact viewports to a multi-card desktop window', () => {
    expect(
      resolveDashboardListMaxHeight({
        compactViewport: true,
        itemHeight: 320,
        visibleCount: 7.5,
      }),
    ).toBeUndefined();
  });

  it('keeps the desktop peek window from a measured card', () => {
    expect(
      resolveDashboardListMaxHeight({
        compactViewport: false,
        itemHeight: 200,
        visibleCount: 7.5,
      }),
    ).toBe('1624px');
  });

  it('counts gaps between whole rows for photographer lists', () => {
    expect(
      resolveDashboardListMaxHeight({
        compactViewport: false,
        itemHeight: 56,
        visibleCount: 8,
        gapPx: 8,
        extraPx: 24,
      }),
    ).toBe('528px');
  });

  it('uses the unmeasured desktop fallback instead of inventing a height', () => {
    expect(
      resolveDashboardListMaxHeight({
        compactViewport: false,
        itemHeight: 0,
        visibleCount: 5.5,
        unmeasuredFallback: 'calc(100vh - 14rem)',
      }),
    ).toBe('calc(100vh - 14rem)');
  });

  it('does not apply the unmeasured fallback on compact viewports', () => {
    expect(
      resolveDashboardListMaxHeight({
        compactViewport: true,
        itemHeight: 0,
        visibleCount: 5.5,
        unmeasuredFallback: 'calc(100vh - 14rem)',
      }),
    ).toBeUndefined();
  });
});

describe('DASHBOARD_MOBILE_PANEL_CLASS', () => {
  it('marks the page and cards so CSS can fill remaining mobile height', () => {
    expect(DASHBOARD_MOBILE_PAGE_CLASS).toBe('dashboard-mobile-page');
    expect(DASHBOARD_MOBILE_PANEL_CLASS).toBe('dashboard-mobile-panel');
  });
});

describe('dashboard mobile tab CSS', () => {
  it('hides inactive tab panels so they cannot share the filled viewport', () => {
    expect(indexCss).toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[hidden\]/);
    expect(indexCss).toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="inactive"\]/);
    expect(indexCss).toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="active"\] > div > div/);
    expect(indexCss).not.toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="active"\] > div > \*/);
    expect(indexCss).toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="active"\] #requests-queue/);
    expect(indexCss).toMatch(/dashboard-mobile-tabs \[role="tabpanel"\]\[data-state="active"\] #ready-to-deliver/);
  });

  it('keeps assign photographer name styles in the stylesheet, not a card sibling', () => {
    const assignCard = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../../../components/dashboard/v2/AssignPhotographersCard.tsx',
      ),
      'utf8',
    );
    expect(assignCard).not.toMatch(/<style>/);
    expect(indexCss).toMatch(/\.assign-photographer-name\s*\{/);
  });
});
