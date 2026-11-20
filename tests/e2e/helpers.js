// Shared helpers for E2E tests (LOCAL EMULATOR environment).
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// Loaded through a plain VM script: Playwright's test transform would otherwise re-compile this 1 MB file.
const xlsxCtx = { module: { exports: {} }, console, Uint8Array, ArrayBuffer, DataView, Buffer, process: { versions: {} } };
xlsxCtx.exports = xlsxCtx.module.exports;
vm.runInNewContext(fs.readFileSync(path.resolve('vendor/xlsx-0.20.3.full.min.js'), 'utf8'), xlsxCtx);
export const XLSX = xlsxCtx.module.exports;
export const USERS = Object.fromEntries(JSON.parse(fs.readFileSync(path.resolve('tests/fixtures/local-users.json'), 'utf8')).map((u) => [u.name, u]));
export const SHOTS = path.resolve('docs/screenshots');

export async function login(page, name, password) {
  await page.goto('/#/dashboard');
  await page.locator('#login-user').fill(name);
  await page.locator('#login-pw').fill(password || USERS[name].password);
  await page.locator('#login-btn').click();
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#main .view')).toBeVisible();
}

export async function logout(page) {
  await page.locator('#app .logout').click();
  await expect(page.locator('#login-form')).toBeVisible();
}

/** Direct API call from the page with the signed-in token (used for negative security tests). */
export async function api(page, action, params = {}, token) {
  return page.evaluate(async ({ action, params, token }) => {
    const raw = sessionStorage.getItem('vrm_v3_session') || localStorage.getItem('vrm_v3_session');
    const tok = token || (raw ? JSON.parse(raw).token : undefined);
    const r = await fetch('/exec', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action, token: tok, requestId: crypto.randomUUID(), ...params }) });
    return r.json();
  }, { action, params, token });
}
export async function currentToken(page) {
  return page.evaluate(() => { const raw = sessionStorage.getItem('vrm_v3_session') || localStorage.getItem('vrm_v3_session'); return raw ? JSON.parse(raw).token : null; });
}

export async function hook(request, name, data) {
  const r = await request.post('/__test/' + name, { data });
  expect(r.ok()).toBeTruthy();
  return r.json();
}

export function istDate(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export const today = () => istDate(Date.now());
export const daysAgo = (n) => istDate(Date.now() - n * 86400000);

export async function goRoute(page, route) {
  await page.evaluate((r) => { location.hash = '#/' + r; }, route);
  await expect(page.locator('#main .view')).toBeVisible();
}

export async function noHorizontalOverflow(page) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(m.sw, `page scrollWidth ${m.sw} > viewport ${m.cw}`).toBeLessThanOrEqual(m.cw + 1);
}

/** Every visible form control must have an accessible name. */
export async function unlabelledControls(page) {
  return page.evaluate(() => Array.from(document.querySelectorAll('input:not([type=hidden]),select,textarea,button')).filter((el) => {
    if (!el.offsetParent) return false;
    const name = (el.getAttribute('aria-label') || (el.labels && el.labels[0] && el.labels[0].textContent) || el.getAttribute('aria-labelledby') || el.textContent || el.title || '').trim();
    return !name;
  }).map((el) => el.outerHTML.slice(0, 120)));
}

export async function readDownload(download) {
  const p = await download.path();
  return fs.readFileSync(p);
}
