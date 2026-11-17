// E2E: failure handling, sessions, security and admin management. Environment: LOCAL EMULATOR, Microsoft Edge.
import { test, expect } from '@playwright/test';
import { login, logout, api, hook, goRoute, today, daysAgo, USERS } from './helpers.js';

test.afterEach(async ({ request }) => { await hook(request, 'clock', { now: 0 }); await hook(request, 'fail-next', { mode: null }); });

test('TC-038 response lost after the server saved: no false success; "Retry safely" confirms without duplicates', async ({ page, request }) => {
  await login(page, 'Pavan Soni');
  await goRoute(page, 'input');
  await page.locator('#in-codes').fill('NET-1, NET-2');
  // Two drops: the original POST and the browser's own silent re-send of it on a fresh connection.
  await hook(request, 'fail-next', { mode: 'drop-response', times: 2 });
  await page.locator('#in-save').click();
  await expect(page.locator('#in-result')).toContainText('Not confirmed');
  expect((await api(page, 'queryEntries', { q: 'NET-' })).data.total, 'server committed before the response was lost').toBe(2);
  await expect(page.locator('#in-codes')).toHaveValue('NET-1, NET-2');
  await page.locator('[data-action="input-retry"]').click();
  await expect(page.locator('#in-result h4')).toContainText('Saved 2 of 2');
  await expect(page.locator('#in-result')).toContainText('confirmed after retry');
  const q = await api(page, 'queryEntries', { q: 'NET-' });
  expect(q.data.total).toBe(2);
});

test('a POST silently re-sent by the browser after a dropped connection is absorbed by idempotency', async ({ page, request }) => {
  await login(page, 'Pavan Soni');
  await goRoute(page, 'input');
  await page.locator('#in-codes').fill('AUTO-1, AUTO-2');
  await hook(request, 'fail-next', { mode: 'drop-response', times: 1 });
  await page.locator('#in-save').click();
  await expect(page.locator('#in-result h4')).toContainText('Saved 2 of 2');
  expect((await api(page, 'queryEntries', { q: 'AUTO-' })).data.total).toBe(2);
});

test('double-click on Save submits once', async ({ page }) => {
  await login(page, 'Pavan Soni');
  await goRoute(page, 'input');
  await page.locator('#in-codes').fill('DBL-1');
  await page.locator('#in-save').dblclick();
  await expect(page.locator('#in-result h4')).toContainText('Saved 1 of 1');
  expect((await api(page, 'queryEntries', { q: 'DBL-' })).data.total).toBe(1);
  const logs = await api(page, 'queryEntries', { q: 'DBL-1' });
  expect(logs.data.items.length).toBe(1);
});

test('server busy (lock contention) is reported truthfully and nothing is saved', async ({ page, request }) => {
  await login(page, 'Pavan Soni');
  await goRoute(page, 'input');
  await page.locator('#in-codes').fill('BUSY-1');
  await hook(request, 'fail-next', { mode: 'busy' });
  await page.locator('#in-save').click();
  await expect(page.locator('#in-result')).toContainText('Nothing was saved');
  expect((await api(page, 'queryEntries', { q: 'BUSY-' })).data.total).toBe(0);
});

test('TC-005 session expiry: next action returns to sign-in with an explanation', async ({ page, request }) => {
  await login(page, 'Pavan Soni');
  await hook(request, 'clock', { now: Date.now() + 13 * 3600e3 });
  await page.locator('#sync').click();
  await expect(page.locator('#login-form')).toBeVisible();
  await expect(page.locator('#login-msg')).toContainText(/expired|inactivity/);
  expect(await page.evaluate(() => sessionStorage.getItem('vrm_v3_session'))).toBeNull();
});

test('provisioned account must replace its temporary password before seeing data', async ({ page }) => {
  await page.goto('/');
  await page.locator('#login-user').fill('Swarna Shetty');
  await page.locator('#login-pw').fill('Temporary-' + USERS['Swarna Shetty'].password);
  await page.locator('#login-btn').click();
  await expect(page.locator('#first-pw')).toBeVisible();
  expect((await api(page, 'getData')).error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  await page.locator('#first-pw-currentPassword').fill('Temporary-' + USERS['Swarna Shetty'].password);
  await page.locator('#first-pw-newPassword').fill('short');
  await page.locator('#first-pw-confirm').fill('short');
  await page.locator('#first-pw button[type="submit"]').click();
  await expect(page.locator('[data-form-err]')).toContainText('at least 12');
  await page.locator('#first-pw-newPassword').fill('Swarna-new-pass-0001');
  await page.locator('#first-pw-confirm').fill('Swarna-new-pass-0001');
  await page.locator('#first-pw button[type="submit"]').click();
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#user-name')).toHaveText('Swarna Shetty');
});

test('zero report: confirmed zero is distinct from not reported and adds no activation', async ({ page }) => {
  await login(page, 'Pavan Soni');
  await goRoute(page, 'input');
  const d = daysAgo(6);
  await page.locator('#in-date').fill(d);
  await page.locator('#in-date').dispatchEvent('change');
  await expect(page.locator('#in-status')).toContainText('Not reported');
  await page.locator('[data-action="zero-report"]').click();
  await page.locator('#m-ok').click();
  await expect(page.locator('#in-status')).toContainText('Confirmed zero');
  const data = (await api(page, 'getData')).data;
  expect(data.zeroReports.some((z) => z[1] === d)).toBe(true);
  expect(data.counts.some((c) => c[1] === d && c[0] === data.me.assignedVrmId)).toBe(false);
  await page.locator('[data-action="zero-withdraw"]').click();
  await page.locator('#m-ok').click();
  await expect(page.locator('#in-status')).toContainText('Not reported');
});

test('stored XSS attempt in a client code is rendered as text, never executed', async ({ page }) => {
  let dialogs = 0;
  page.on('dialog', (d) => { dialogs++; d.dismiss(); });
  await login(page, 'Jayesh Mahajan');
  await goRoute(page, 'input');
  await page.locator('#in-vrm').selectOption({ label: 'Pavan Soni' });
  await page.locator('#in-codes').fill('<img/src=x/onerror=window.__xss=1>');
  await page.locator('#in-save').click();
  await expect(page.locator('#in-result h4')).toContainText('Saved 1 of 1');
  await goRoute(page, 'lookup');
  await page.locator('#lg-q').fill('<img');
  await page.locator('#ledger-form button[type="submit"]').click();
  await expect(page.locator('#ledger-body .code-pill').first()).toHaveText('<img/src=x/onerror=window.__xss=1>');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('#ledger-body img').count()).toBe(0);
  expect(dialogs).toBe(0);
});

test('TC-040 keyboard only: sign in, open a modal, Escape closes it and focus returns', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 12 && !(await page.evaluate(() => document.activeElement && document.activeElement.id === 'login-user')); i++) await page.keyboard.press('Tab');
  await page.keyboard.type('Jayesh Mahajan');
  await page.keyboard.press('Tab');
  await page.keyboard.type(USERS['Jayesh Mahajan'].password);
  await page.keyboard.press('Enter');
  await expect(page.locator('#main .view')).toBeVisible();
  await goRoute(page, 'lookup');
  await expect(page.locator('#ledger-body tbody tr').first()).toBeVisible();
  const btn = page.locator('[data-action="entry-correct"]').first();
  await btn.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await expect(page.locator('#c-vrm')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement.getAttribute('data-action'))).toBe('entry-correct');
  // focus survives a partial re-render (filter chips / sort)
  await goRoute(page, 'mis');
  await page.locator('[data-table="mis"][data-key="all"]').focus();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => document.activeElement.getAttribute('data-key'))).toBe('all');
});

test('remembered session: signing out in one tab signs out the other', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:8788' });
  const p1 = await ctx.newPage();
  await p1.goto('/');
  await p1.locator('#login-user').fill('Khushi Dodiya');
  await p1.locator('#login-pw').fill(USERS['Khushi Dodiya'].password);
  await p1.locator('#login-remember').check();
  await p1.locator('#login-btn').click();
  await expect(p1.locator('#main .view')).toBeVisible();
  const p2 = await ctx.newPage();
  await p2.goto('/');
  await expect(p2.locator('#main .view')).toBeVisible();
  await logout(p1);
  await expect(p2.locator('#login-msg')).toContainText('another tab');
  await ctx.close();
});

test('offboarding: disabling an account ends its live session immediately', async ({ browser, page }) => {
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:8788' });
  const k = await ctx.newPage();
  await login(k, 'Khushi Dodiya');
  await login(page, 'Jayesh Mahajan');
  const users = (await api(page, 'listUsers')).data.users;
  const khushi = users.find((u) => u.name === 'Khushi Dodiya');
  expect((await api(page, 'setUserActive', { userId: khushi.id, active: false, reason: 'E2E offboarding drill' })).ok).toBe(true);
  await k.locator('#sync').click();
  await expect(k.locator('#login-form')).toBeVisible();
  await expect(k.locator('#login-msg')).toContainText(/ended|disabled/);
  expect((await api(page, 'setUserActive', { userId: khushi.id, active: true })).ok).toBe(true);
  await ctx.close();
});

test('management: add, rename, archive and restore a VRM; add an alias; create a reviewer account', async ({ page, browser }) => {
  await login(page, 'Jayesh Mahajan');
  await goRoute(page, 'manage');
  await page.locator('#vrm-new').fill('Neha Kulkarni');
  await page.locator('#vrm-add button[type="submit"]').click();
  await expect(page.locator('#manage-body')).toContainText('Neha Kulkarni');
  const row = page.locator('#manage-body tr', { hasText: 'Neha Kulkarni' });
  await row.locator('[data-action="vrm-rename"]').click();
  await page.locator('#rn-name').fill('Neha K Kulkarni');
  await page.locator('#m-ok').click();
  await expect(page.locator('#manage-body')).toContainText('Neha K Kulkarni');
  const r2 = page.locator('#manage-body tr', { hasText: 'Riddhi Mistry' });
  await r2.locator('[data-action="vrm-archive"]').click();
  await page.locator('#ar-reason').fill('Moved desks (E2E)');
  await page.locator('#m-ok').click();
  await expect(page.locator('#manage-body tr', { hasText: 'Riddhi Mistry' })).toContainText('Archived');
  await page.locator('#manage-body tr', { hasText: 'Riddhi Mistry' }).locator('[data-action="vrm-restore"]').click();
  await page.locator('#m-ok').click();
  await expect(page.locator('#manage-body tr', { hasText: 'Riddhi Mistry' })).toContainText('Active');
  await page.locator('[data-tab="aliases"]').click();
  await page.locator('#al-name').fill('P Sharma');
  await page.locator('#al-vrm').selectOption({ label: 'Parth Sharma' });
  await page.locator('#alias-add button[type="submit"]').click();
  await expect(page.locator('#manage-body')).toContainText('P Sharma');
  await page.locator('#al-name').fill('Pavan Soni');
  await page.locator('#al-vrm').selectOption({ label: 'Parth Sharma' });
  await page.locator('#alias-add button[type="submit"]').click();
  await expect(page.locator('#toasts')).toContainText('already a VRM name');
  await page.locator('[data-tab="users"]').click();
  await page.locator('[data-action="user-create"]').click();
  await page.locator('#nu-name').fill('Asha Reviewer');
  await page.locator('#u-role').selectOption('reviewer');
  await page.locator('#m-ok').click();
  const temp = await page.locator('#tmp-pw').inputValue();
  expect(temp.length).toBeGreaterThanOrEqual(12);
  await page.locator('[data-m="cancel"]').click();
  await expect(page.locator('#manage-body')).toContainText('Asha Reviewer');
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:8788' });
  const a = await ctx.newPage();
  await a.goto('/');
  await a.locator('#login-user').fill('Asha Reviewer');
  await a.locator('#login-pw').fill(temp);
  await a.locator('#login-btn').click();
  await expect(a.locator('#first-pw')).toBeVisible();
  await ctx.close();
});

test('browser back/forward follows the section history', async ({ page }) => {
  await login(page, 'Jayesh Mahajan');
  await goRoute(page, 'mis');
  await goRoute(page, 'lookup');
  await page.goBack();
  await expect(page.locator('#page-title')).toHaveText('MIS – VRM Wise Summary');
  await page.goForward();
  await expect(page.locator('#page-title')).toHaveText('Client Code Lookup');
});

test('reviewer: read-only navigation and refused writes', async ({ page }) => {
  await login(page, 'Riya Reviewer');
  await expect(page.locator('a[data-route="input"]')).toHaveCount(0);
  await expect(page.locator('a[data-route="activity"]')).toHaveCount(1);
  const v = (await api(page, 'getData')).data.vrms[0].id;
  expect((await api(page, 'addEntries', { vrmId: v, date: today(), codes: ['RV-1'] })).error.code).toBe('FORBIDDEN');
  await goRoute(page, 'input');
  await expect(page.locator('#main')).toContainText('Not available for your role');
});
