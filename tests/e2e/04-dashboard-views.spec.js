// E2E (v3.1): VRM-only views, dashboard period filter, day-by-day charts, quick add, admin-only team views, backups.
// Environment: LOCAL EMULATOR, Microsoft Edge.
import { test, expect } from '@playwright/test';
import { login, logout, api, goRoute, today, noHorizontalOverflow } from './helpers.js';

async function choosePeriod(page, preset, from, to) {
  await page.locator('#dash-filter summary').click();
  await page.locator(`input[name="dash-preset"][value="${preset}"]`).check();
  if (from !== undefined) { await page.locator('#dash-from').fill(from); await page.locator('#dash-to').fill(to); }
  await page.locator('[data-action="dash-apply"]').click();
}

test('VRM dashboard shows only their own data: no Active VRMs, team reporting, leaderboard, share or VRM summary', async ({ page }) => {
  await login(page, 'Parth Sharma');
  const data = (await api(page, 'getData')).data;
  expect(data.vrms.map((v) => v.name)).toEqual(['Parth Sharma']);
  expect(data.counts.every((c) => c[0] === data.me.assignedVrmId)).toBe(true);
  const labels = await page.locator('#dash-body .kpi .lbl').allInnerTexts();
  expect(labels).toEqual(['Today', 'Selected period', 'This month', 'This year', 'All time']);
  const body = page.locator('#dash-body');
  for (const gone of ['Active VRMs', 'Leaderboard', 'Team share', 'VRM summary', 'Today’s reporting']) await expect(body).not.toContainText(gone);
  await expect(page.locator('#trend-scope')).toHaveCount(0);
  await expect(page.locator('#daily-scope')).toHaveCount(0);
  await expect(page.locator('.own-status')).toBeVisible();
  await expect(page.locator('a[data-route="mis"]')).toHaveText('My MIS');
  await goRoute(page, 'mis');
  await expect(page.locator('#mis-vrm')).toHaveCount(0);
  await expect(page.locator('#mis-results')).not.toContainText('VRM wise summary');
  await expect(page.locator('#mis-results')).not.toContainText('Period by VRM');
  await expect(page.locator('#mis-results [data-chart="daily-mis"]')).toHaveCount(1);
  await page.locator('#mis-preset').selectOption('fy');
  const t = today();
  const fy = +t.slice(5, 7) >= 4 ? +t.slice(0, 4) : +t.slice(0, 4) - 1;
  await expect(page.locator('#mis-from')).toHaveValue(fy + '-04-01');
  await expect(page.locator('#mis-to')).toHaveValue((fy + 1) + '-03-31');
  await logout(page);
});

test('quick add on the dashboard saves codes for the signed-in VRM and refreshes figures', async ({ page }) => {
  await login(page, 'Parth Sharma');
  const before = Number(await page.locator('#dash-body .kpi.k1 .val').innerText());
  await expect(page.locator('.badge.qa-vrm')).toContainText('Parth Sharma');
  await page.locator('#qa-codes').fill('QA-E2E-1, qa-e2e-1; QA-E2E-2, bad code');
  await page.locator('#qa-codes').press('Enter');
  await expect(page.locator('#qa-result')).toContainText('Saved 2 of 4');
  await expect(page.locator('#qa-result')).toContainText('Repeated in paste');
  await expect(page.locator('#qa-result')).toContainText('Invalid code');
  await expect(page.locator('#qa-codes')).toHaveValue('');
  await expect(page.locator('#dash-body .kpi.k1 .val')).toHaveText(String(before + 2));
  await expect(page.locator('.own-status')).toContainText('recorded today');
  expect((await api(page, 'queryEntries', { q: 'QA-E2E' })).data.total).toBe(2);
  await logout(page);
});

test('period filter: presets, FY quarters, custom range validation, and the day-by-day chart follows it', async ({ page }) => {
  await login(page, 'Parth Sharma');
  await expect(page.locator('#dash-filter summary')).toContainText('Period:');
  await choosePeriod(page, 'lastMonth');
  const t = today(), lm = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 2, 1));
  await expect(page.locator('#dash-filter summary')).toContainText(lm.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' }));
  const days = new Date(Date.UTC(lm.getUTCFullYear(), lm.getUTCMonth() + 1, 0)).getUTCDate();
  // The daily table always lists every day of the period (the chart shows an empty state when all days are zero).
  await expect(page.locator('#dash-body details.table-alt').first().locator('tbody tr')).toHaveCount(days);
  await choosePeriod(page, 'q1');
  await expect(page.locator('#dash-filter summary')).toContainText(/Q1 FY \d{4}-\d{2} \(Apr–Jun \d{4}\)/);
  await choosePeriod(page, 'custom', t, '2000-01-02');
  await expect(page.locator('#dash-filter-err')).toContainText('From date is after To date');
  await expect(page.locator('#dash-filter')).toHaveAttribute('open', '');
  await page.locator('#dash-from').fill('2000-01-01');
  await page.locator('#dash-to').fill('2000-01-03');
  await page.locator('[data-action="dash-apply"]').click();
  await expect(page.locator('[data-chart="daily-dash"]')).toContainText('No activations recorded');
  await expect(page.locator('#dash-body .kpi.k2 .val')).toHaveText('0');
  await choosePeriod(page, 'all');
  await expect(page.locator('#dash-filter summary')).toContainText('All time');
  await expect(page.locator('#dash-body .kpi.k2 .val')).toHaveText(await page.locator('#dash-body .kpi.k6 .val').innerText());
  await noHorizontalOverflow(page);
  await logout(page);
});

test('admin dashboard keeps team views, scope selectors and forces an explicit VRM for quick add', async ({ page }) => {
  await login(page, 'Jayesh Mahajan');
  const labels = await page.locator('#dash-body .kpi .lbl').allInnerTexts();
  expect(labels).toContain('Active VRMs');
  for (const shown of ['Today’s reporting', 'Leaderboard', 'Team share', 'VRM summary']) await expect(page.locator('#dash-body')).toContainText(shown);
  await expect(page.locator('#trend-scope')).toHaveCount(1);
  await page.locator('#daily-scope').selectOption({ label: 'Parth Sharma' });
  await expect(page.locator('#daily-scope')).toHaveValue(/.+/);
  await expect(page.locator('#qa-vrm')).toHaveValue('');
  await page.locator('#qa-codes').fill('ADMIN-QA-1');
  await page.locator('#qa-save').click();
  await expect(page.locator('#toasts')).toContainText('Choose the VRM');
  await page.locator('#qa-vrm').selectOption({ label: 'Pavan Soni' });
  await page.locator('#qa-save').click();
  await expect(page.locator('#qa-result')).toContainText('Saved 1 of 1');
  await expect(page.locator('#qa-result')).toContainText('Pavan Soni');
  await goRoute(page, 'mis');
  await expect(page.locator('#mis-results')).toContainText('VRM wise summary');
  await logout(page);
});

test('admin overview: install the daily backup schedule and take a backup now', async ({ page }) => {
  await login(page, 'Jayesh Mahajan');
  await goRoute(page, 'admin');
  const panel = page.locator('.status-panel', { hasText: 'backup' }).first();
  await expect(panel).toContainText('Not scheduled');
  await page.locator('[data-action="schedule-install"]').click();
  await expect(panel).toContainText('Daily backup on');
  await expect(panel).toContainText('01:00 IST');
  await expect(page.locator('[data-action="schedule-install"]')).toHaveCount(0);
  await page.locator('[data-action="schedule-backup"]').click();
  await expect(page.locator('#toasts')).toContainText('Backup created');
  await expect(panel).toContainText('VRM MIS backup');
  const st = (await api(page, 'scheduleStatus')).data;
  expect([st.backupInstalled, st.maintenanceInstalled, !!st.lastBackupAt]).toEqual([true, true, true]);
  await logout(page);
});
