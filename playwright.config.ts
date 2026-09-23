import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, fullyParallel: false, workers: 1,
  use: { baseURL: process.env.APP_URL || 'http://localhost:3000', browserName: 'chromium', trace: 'retain-on-failure' },
  reporter: 'list',
});
