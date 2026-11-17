// E2E tests run a real browser (installed Microsoft Edge) against the LOCAL EMULATOR server:
// static frontend + backend/Code.gs executed in the Apps Script emulator. Not Google infrastructure.
import { defineConfig } from '@playwright/test';

const PORT = 8788;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: process.env.PW_CHANNEL || 'msedge',
    viewport: { width: 1366, height: 900 },
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: [{
    command: `node scripts/dev-server.mjs --port ${PORT} --fresh --test-hooks --data .local/e2e.json`,
    url: `http://127.0.0.1:${PORT}/exec`,
    reuseExistingServer: false,
    timeout: 120000
  }, {
    // Separate server with synthetic demo data for responsive checks and screenshots.
    command: 'node scripts/dev-server.mjs --port 8789 --fresh --demo --data .local/demo.json',
    url: 'http://127.0.0.1:8789/exec',
    reuseExistingServer: false,
    timeout: 180000
  }]
});
