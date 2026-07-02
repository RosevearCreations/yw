import { defineConfig } from '@playwright/test';

const executablePath = process.env.YWI_PLAYWRIGHT_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: {
    headless: true,
    launchOptions: executablePath ? { executablePath } : {}
  }
});
