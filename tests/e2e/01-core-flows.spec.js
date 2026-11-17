// E2E: login -> manual add -> duplicate -> import preview -> import -> filter -> dashboard total -> export -> correction -> audit -> logout -> denied API.
// Environment: LOCAL EMULATOR (static frontend + backend/Code.gs in the Apps Script emulator), Microsoft Edge.
import { test, expect } from '@playwright/test';
import { login, logout, api, currentToken, goRoute, today, daysAgo, XLSX, readDownload, SHOTS, unlabelledControls } from './helpers.js';
import path from 'node:path';

test.describe.configure({ mode: 'serial' });
let page;
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:8788', viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  page = await ctx.newPage();
});
test.afterAll(async () => { await page.context().close(); });

function ddmm(iso) { return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4); }
function dmyEvidenceDate() { for (let n = 15; n < 60; n++) { const d = daysAgo(n); if (+d.slice(8, 10) > 12) return d; } return daysAgo(20); }

test('TC-003 wrong password is rejected with a clear message and no session', async () => {
  await page.goto('/');
  await page.locator('#login-user').fill('Parth Sharma');
  await page.locator('#login-pw').fill('not-the-password');
  await page.locator('#login-btn').click();
  await expect(page.locator('#login-msg')).toContainText('Name or password is incorrect');
  expect(await currentToken(page)).toBeNull();
  await expect(page.locator('#login-pw')).toHaveValue('');
});

test('TC-001/008/009/010/011/014 member records codes: separators, blanks, case duplicates, leading zeros', async () => {
  await login(page, 'Parth Sharma');
  await expect(page.locator('#user-role')).toHaveText('VRM');
  await expect(page.locator('a[data-route="manage"]')).toHaveCount(0);
  await goRoute(page, 'input');
  await expect(page.locator('.locked')).toContainText('Parth Sharma');
  await expect(page.locator('#in-date')).toHaveValue(today());
  await page.locator('#in-codes').fill('000123, cl-e2e-1;CL-E2E-1\n\n , bad code');
  await expect(page.locator('#paste-stats')).toContainText('4 entered');
  await expect(page.locator('#in-save')).toContainText('Save 2 codes');
  await page.locator('#in-save').click();
  const result = page.locator('#in-result');
  await expect(result.locator('h4')).toContainText('Saved 2 of 4');
  await expect(result).toContainText('Repeated in paste');
  await expect(result).toContainText('Invalid code');
  await expect(page.locator('#in-codes')).toHaveValue('');
  await expect(page.locator('#in-status')).toContainText('Filed');
  await page.screenshot({ path: path.join(SHOTS, 'input-result-1366.png'), fullPage: true });
  await goRoute(page, 'dashboard');
  await expect(page.locator('.kpi.k1 .val')).toHaveText('2');
  await logout(page);
});

test('TC-012 existing code under another VRM is not added; owner is shown to the team', async () => {
  await login(page, 'Khushi Dodiya');
  await goRoute(page, 'input');
  await page.locator('#in-codes').fill('000123');
  await page.locator('#in-save').click();
  await expect(page.locator('#in-result h4')).toContainText('No new codes saved');
  await expect(page.locator('#in-result')).toContainText('Already recorded');
  await expect(page.locator('#in-result')).toContainText('Parth Sharma');
  await goRoute(page, 'lookup');
  await page.locator('#lk-codes').fill('000123, NEW-FREE-1');
  await page.locator('#lk-btn').click();
  await expect(page.locator('#lk-results')).toContainText('Already recorded');
  await expect(page.locator('#lk-results')).toContainText('Available');
  await logout(page);
});

test('TC-019/021/022/024 import: preview, aliases, row-level exceptions, commit and reconciliation', async () => {
  await login(page, 'Jayesh Mahajan');
  await goRoute(page, 'import');
  const y = daysAgo(1), ev = dmyEvidenceDate();
  const csv = ['VRM,Date,Client Code',
    `Parth Sharma,${y},0009001`,
    `khushi mahesh dodiya,${ddmm(ev)},CL-IMP-2`,
    `Pavan Soni,${y},000123`,
    `Pavan Soni,${y},0009001`,
    'Pavan Soni,2026-02-30,CL-IMP-5',
    `Neha Kulkarni,${y},CL-IMP-6`,
    `Pavan Soni,${istFuture()},CL-IMP-7`].join('\r\n');
  await page.locator('#imp-file').setInputFiles({ name: 'e2e-import.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿' + csv, 'utf8') });
  await expect(page.locator('#imp-map')).toBeVisible();
  await expect(page.locator('#imp-cvrm')).toHaveValue('0');
  await expect(page.locator('#imp-cdate')).toHaveValue('1');
  await expect(page.locator('#imp-ccode')).toHaveValue('2');
  await page.locator('#imp-prev-btn').click();
  const chips = page.locator('.chips[role="group"]');
  await expect(chips).toBeVisible();
  const n = async (g) => (await page.locator(`[data-g="${g}"] .n`).textContent()).trim();
  expect(await n('all')).toBe('7');
  expect(await n('ready')).toBe('2');
  expect(await n('existing')).toBe('1');
  expect(await n('infile')).toBe('1');
  expect(await n('invalid')).toBe('2');
  expect(await n('vrm')).toBe('1');
  await expect(page.locator('#imp-body')).toContainText('→ Khushi Dodiya');
  await expect(page.locator('#imp-body')).toContainText('Create VRM “Neha Kulkarni”');
  await page.screenshot({ path: path.join(SHOTS, 'import-preview-1366.png'), fullPage: true });
  await page.locator('[data-action="import-commit"]').click();
  await page.locator('#m-ok').click();
  await expect(page.locator('.recon')).toBeVisible({ timeout: 30000 });
  const recon = await page.locator('.recon').innerText();
  expect(recon).toMatch(/Data rows in file\s+7/);
  expect(recon).toMatch(/Rejected before upload \(file checks\)\s+3/);
  expect(recon).toMatch(/Sent to the server\s+4/);
  expect(recon).toMatch(/— Saved\s+2/);
  expect(recon).toMatch(/— Already recorded\s+1/);
  await expect(page.locator('#imp-body')).toContainText('✓ Sent rows reconcile');
  await expect(page.locator('#imp-body')).toContainText('accepted 2');
  await page.screenshot({ path: path.join(SHOTS, 'import-result-1366.png'), fullPage: true });
  const dl = page.waitForEvent('download');
  await page.locator('[data-action="import-exceptions"]').click();
  const exc = (await readDownload(await dl)).toString('utf8');
  expect(exc.split('\r\n').filter(Boolean).length).toBe(1 + 5);
  expect(exc).toContain('Invalid date');
});

test('TC-026/027/028/030/031 MIS filters, reversed range, exports reconcile with the screen', async () => {
  await goRoute(page, 'mis');
  await page.locator('#mis-from').fill(today());
  await page.locator('#mis-to').fill(daysAgo(3));
  await page.locator('#mis-to').dispatchEvent('change');
  await expect(page.locator('#mis-results')).toContainText('From date is after To date');
  await expect(page.locator('#mis-year')).toBeDisabled();
  await page.locator('[data-action="mis-clear-range"]').click();
  await expect(page.locator('#mis-year')).toBeEnabled();
  await page.locator('#mis-from').fill(daysAgo(400));
  await page.locator('#mis-from').dispatchEvent('change');
  await page.locator('#mis-to').fill(today());
  await page.locator('#mis-to').dispatchEvent('change');
  const total = Number((await page.locator('#mis-results .kpi.k1 .val').textContent()).replace(/,/g, ''));
  expect(total).toBe(4); // 000123, CL-E2E-1, 0009001, CL-IMP-2
  const foot = await page.locator('#mis-results tfoot').innerText();
  expect(foot).toContain('Team total');
  await page.screenshot({ path: path.join(SHOTS, 'mis-1366.png'), fullPage: true });
  let dl = page.waitForEvent('download');
  await page.locator('[data-action="mis-export"][data-fmt="csv"]').first().click();
  const csv = (await readDownload(await dl)).toString('utf8');
  const lines = csv.replace(/^﻿/, '').split('\r\n');
  const detailStart = lines.indexOf('Detail') + 2;
  const detail = lines.slice(detailStart).filter(Boolean);
  expect(detail.length).toBe(total);
  expect(lines.find((l) => l.startsWith('TOTAL,'))).toBe(`TOTAL,,${total},100%`);
  expect(csv).toContain(',000123,');
  dl = page.waitForEvent('download');
  await page.locator('[data-action="mis-export"][data-fmt="xlsx"]').first().click();
  const wb = XLSX.read(await readDownload(await dl), { type: 'buffer' });
  expect(wb.SheetNames).toEqual(['Report', 'Summary', 'Detail']);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets.Detail, { header: 1, raw: false });
  expect(rows.length - 1).toBe(total);
  const codeCell = Object.entries(wb.Sheets.Detail).find(([k, c]) => k.startsWith('C') && c && c.v === '000123');
  expect(codeCell, 'leading-zero code kept as text in XLSX').toBeTruthy();
  expect(codeCell[1].t).toBe('s');
  const sum = XLSX.utils.sheet_to_json(wb.Sheets.Summary, { header: 1 });
  expect(sum[sum.length - 1][2]).toBe(total);
  // Single VRM scope
  await page.locator('#mis-vrm').selectOption({ label: 'Parth Sharma' });
  await expect(page.locator('#mis-results .kpi.k1 .val')).toHaveText('3');
});

test('TC-034/035 + correction: admin corrects, deletes and restores with reasons; audit shows actor', async () => {
  await goRoute(page, 'lookup');
  await page.locator('#lg-q').fill('0009001');
  await page.locator('#ledger-form button[type="submit"]').click();
  await expect(page.locator('#ledger-body tbody tr')).toHaveCount(1);
  await page.locator('[data-action="entry-correct"]').click();
  await page.locator('#c-vrm').selectOption({ label: 'Khushi Dodiya' });
  await page.locator('#m-ok').click();
  await expect(page.locator('#m-err')).toContainText('reason');
  await page.locator('#c-reason').fill('Recorded under the wrong VRM');
  await page.locator('#m-ok').click();
  await expect(page.locator('#modal-root')).toBeEmpty();
  await expect(page.locator('#ledger-body tbody tr').first()).toContainText('Khushi Dodiya');
  await page.locator('[data-action="entry-delete"]').click();
  await page.locator('#d-reason').fill('Duplicate paperwork');
  await page.locator('#m-ok').click();
  await expect(page.locator('#ledger-body')).toContainText('No entries match');
  await page.locator('#lg-status').selectOption('all');
  await page.locator('#ledger-form button[type="submit"]').click();
  await expect(page.locator('#ledger-body tbody tr').first()).toContainText('Deleted');
  await page.locator('[data-action="entry-restore"]').click();
  await page.locator('#r-reason').fill('Deleted in error');
  await page.locator('#m-ok').click();
  await expect(page.locator('#ledger-body tbody tr').first()).toContainText('Active');
  await goRoute(page, 'activity');
  await expect(page.locator('#log-body')).toContainText('Entry corrected');
  await expect(page.locator('#log-body')).toContainText('Entry restored');
  await expect(page.locator('#log-body')).toContainText('Jayesh Mahajan');
  await page.screenshot({ path: path.join(SHOTS, 'activity-1366.png'), fullPage: false });
  await goRoute(page, 'admin');
  await expect(page.locator('#admin-body')).toContainText('Corrections (30 days)');
  await page.locator('[data-action="integrity"]').click();
  await expect(page.locator('#admin-body')).toContainText('All checks passed');
  await page.screenshot({ path: path.join(SHOTS, 'admin-1366.png'), fullPage: true });
});

test('every screen: controls have accessible names', async () => {
  for (const r of ['dashboard', 'mis', 'input', 'lookup', 'import', 'admin', 'activity', 'manage', 'account']) {
    await goRoute(page, r);
    await page.waitForTimeout(300);
    expect(await unlabelledControls(page), r).toEqual([]);
  }
});

test('TC-005/036 logout revokes the token server-side; replay fails', async () => {
  const token = await currentToken(page);
  await logout(page);
  const r = await api(page, 'getData', {}, token);
  expect(r.ok).toBe(false);
  expect(r.error.code).toBe('SESSION_REVOKED');
  expect(await currentToken(page)).toBeNull();
});

test('TC-006/007 member: admin APIs and other VRMs are refused server-side; admin pages blocked', async () => {
  await login(page, 'Parth Sharma');
  const vrms = (await api(page, 'getData')).data.vrms;
  const khushi = vrms.find((v) => v.name === 'Khushi Dodiya').id;
  expect((await api(page, 'addEntries', { vrmId: khushi, date: today(), codes: ['HACK-1'] })).error.code).toBe('FORBIDDEN');
  expect((await api(page, 'addVRM', { name: 'Evil Person' })).error.code).toBe('FORBIDDEN');
  expect((await api(page, 'getLogs')).error.code).toBe('FORBIDDEN');
  expect((await api(page, 'softDeleteEntry', { entryId: 'x', reason: 'x x x' })).error.code).toBe('FORBIDDEN');
  await goRoute(page, 'manage');
  await expect(page.locator('#main')).toContainText('Not available for your role');
  await logout(page);
});

function istFuture() { const d = new Date(Date.now() + 3 * 86400000); return d.toISOString().slice(0, 10); }
