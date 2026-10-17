import { defineConfig } from '@playwright/test';
import base from './playwright.config';
import os from 'node:os';
import path from 'node:path';

const output = process.env.SEARCH_E2E_OUTPUT_DIR ?? (process.platform === 'win32'
  ? path.join(os.homedir(), 'Desktop/Projects/ui exploration/time picker/contextual-search-20261017')
  : path.join(os.tmpdir(), 'contextual-search-e2e'));

export default defineConfig({
  ...base,
  testMatch: '**/contextual-search.e2e.ts',
  workers: 2,
  outputDir: path.join(output, 'test-results'),
  use: { ...base.use, baseURL: 'http://127.0.0.1:48152', video: 'off', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 48152 --strictPort', url: 'http://127.0.0.1:48152', reuseExistingServer: false, timeout: 120_000 },
});
