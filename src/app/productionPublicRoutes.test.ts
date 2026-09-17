import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DEMO_PATHS = ['/test-address-lookup', '/test-client-form', '/payment-demo'] as const;

const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const sidebarSource = readFileSync(
  resolve(process.cwd(), 'src/components/layout/sidebar/SidebarLinks.tsx'),
  'utf8',
);

describe('production public router', () => {
  it.each(DEMO_PATHS)('does not register %s on the production route table', (path) => {
    expect(appSource).not.toContain(`path="${path}"`);
  });

  it('only loads demo routes behind import.meta.env.DEV', () => {
    expect(appSource).toMatch(/import\.meta\.env\.DEV/);
    expect(appSource).toMatch(/renderDevOnlyPublicRoutes/);
    const helper = readFileSync(resolve(process.cwd(), 'src/app/devOnlyPublicRoutes.tsx'), 'utf8');
    for (const path of DEMO_PATHS) {
      expect(helper).toContain(`path="${path}"`);
    }
  });

  it('does not advertise the client-form demo in production navigation', () => {
    expect(sidebarSource).toMatch(/import\.meta\.env\.DEV && \([\s\S]*to="\/test-client-form"/);
  });
});
