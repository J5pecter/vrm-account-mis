// Responsive / layout checks at the widths required by the build prompt, plus 125% and 150% zoom at 1366px
// (1093 and 911 CSS px). Environment: LOCAL EMULATOR with synthetic demo data, Microsoft Edge.
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { USERS, SHOTS, noHorizontalOverflow } from './helpers.js';

const BASE = 'http://127.0.0.1:8789';
const WIDTHS = [360, 390, 430, 768, 911, 1024, 1093, 1366, 1920];
const ROUTES = ['dashboard', 'mis', 'input', 'lookup', 'import', 'admin', 'activity', 'manage', 'account'];
const SHOT_AT = { 390: 'mobile', 768: 'tablet', 1366: 'laptop' };

test.describe.configure({ mode: 'serial' });
let page;
test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext({ baseURL: BASE, viewport: { width: 1366, height: 900 } })).newPage();
});
test.afterAll(async () => { await page.context().close(); });

test('sign-in screen fits every width', async () => {
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto('/');
    await expect(page.locator('#login-form')).toBeVisible();
    await noHorizontalOverflow(page);
    const box = await page.locator('#login-btn').boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(40);
    if (SHOT_AT[w]) await page.screenshot({ path: path.join(SHOTS, `login-${SHOT_AT[w]}-${w}.png`) });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.locator('#login-user').fill('Jayesh Mahajan');
  await page.locator('#login-pw').fill(USERS['Jayesh Mahajan'].password);
  await page.locator('#login-btn').click();
  await expect(page.locator('#main .view')).toBeVisible();
});

for (const w of WIDTHS) {
  test(`all screens at ${w}px: no page-level horizontal overflow, navigation reachable`, async () => {
    await page.setViewportSize({ width: w, height: w < 768 ? 844 : 900 });
    for (const r of ROUTES) {
      await page.evaluate((x) => { location.hash = '#/' + x; }, r);
      await expect(page.locator('#main .view')).toBeVisible();
      await page.waitForTimeout(r === 'admin' || r === 'activity' ? 700 : 200);
      await noHorizontalOverflow(page);
      const tb = await page.locator('.topbar').boundingBox();
      expect(tb.width).toBeLessThanOrEqual(w + 1);
      if (SHOT_AT[w]) await page.screenshot({ path: path.join(SHOTS, `${r}-${SHOT_AT[w]}-${w}.png`), fullPage: true });
    }
    const sidebar = page.locator('#sidebar');
    if (w <= 1100) {
      expect((await sidebar.boundingBox()).x).toBeLessThan(0);
      await page.locator('#menu-btn').click();
      await expect(page.locator('#menu-btn')).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(async () => (await sidebar.boundingBox()).x).toBeGreaterThanOrEqual(0);
      await expect(page.locator('#nav a').first()).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.locator('#menu-btn')).toHaveAttribute('aria-expanded', 'false');
      await page.locator('#menu-btn').click();
      await page.locator('#nav a[data-route="mis"]').click();
      await expect(page.locator('#page-title')).toHaveText('MIS – VRM Wise Summary');
      await expect(page.locator('#menu-btn')).toHaveAttribute('aria-expanded', 'false');
    } else {
      expect((await sidebar.boundingBox()).x).toBe(0);
      await page.locator('#menu-btn').click();
      await expect.poll(async () => (await sidebar.boundingBox()).x).toBeLessThan(0);
      await page.locator('#menu-btn').click();
      await expect.poll(async () => (await sidebar.boundingBox()).x).toBe(0);
    }
  });
}

test('light theme renders and the preference persists across reloads', async () => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.locator('.topbar .theme-btn').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('#main .view')).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, 'dashboard-light-1366.png'), fullPage: true });
  await page.locator('.topbar .theme-btn').click();
});

test('reduced motion is respected', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: BASE, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  await p.goto('/');
  const d = await p.evaluate(() => getComputedStyle(document.querySelector('.spinner') || document.body).animationDuration);
  expect(['0.001ms', '1e-06s', '0s']).toContain(d);
  await ctx.close();
});
