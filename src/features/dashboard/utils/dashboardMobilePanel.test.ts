import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_MOBILE_PANEL_CLASS,
  resolveDashboardListMaxHeight,
} from './dashboardMobilePanel';

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
  it('marks tab cards so CSS can cap them to remaining mobile height', () => {
    expect(DASHBOARD_MOBILE_PANEL_CLASS).toBe('dashboard-mobile-panel');
  });
});
