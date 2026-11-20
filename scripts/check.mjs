#!/usr/bin/env node
// Static release checks. Exit code 1 on any failure.
//   node scripts/check.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const failures = [];
const ok = (name, cond, detail) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !detail ? '' : ' — ' + detail)); if (!cond) failures.push(name); };

// 1. JavaScript syntax
for (const f of ['assets/js/app.js', 'assets/js/api.js', 'assets/js/core.js', 'assets/js/theme-init.js', 'config.js', 'scripts/dev-server.mjs', 'scripts/migrate-legacy.mjs', 'scripts/reconcile.mjs']) {
  if (!fs.existsSync(path.join(root, f))) { ok('exists ' + f, false); continue; }
  try { execSync(`node --check "${path.join(root, f)}"`, { stdio: 'pipe' }); ok('syntax ' + f, true); } catch (e) { ok('syntax ' + f, false, String(e.stderr)); }
}
try { new Function(read('backend/Code.gs')); ok('syntax backend/Code.gs', true); } catch (e) { ok('syntax backend/Code.gs', false, e.message); }
ok('backend/Code.gs is pure ASCII', !/[^\x00-\x7F]/.test(read('backend/Code.gs')));

// 2. Every declarative UI hook has a handler
const app = read('assets/js/app.js');
const declared = (attr) => {
  const src = app + read('index.html');
  const set = new Set([...src.matchAll(new RegExp(attr + '="([a-z0-9-]+)"', 'g'))].map((m) => m[1]));
  if (attr === 'data-action') [...app.matchAll(/pager\([^,]+,\s*'([a-z0-9-]+)'\)/g)].forEach((m) => set.add(m[1]));
  return set;
};
const handlers = (obj) => {
  const start = app.indexOf('var ' + obj + ' = {');
  if (start < 0) return new Set();
  let depth = 0, i = app.indexOf('{', start), end = i;
  for (; end < app.length; end++) { if (app[end] === '{') depth++; else if (app[end] === '}' && --depth === 0) break; }
  const body = app.slice(i, end);
  return new Set([...body.matchAll(/^\s{4}'?([a-z0-9-]+)'?\s*:\s*function/gm)].map((m) => m[1]));
};
for (const [attr, obj] of [['data-action', 'A'], ['data-submit', 'F'], ['data-change', 'CH'], ['data-input', 'IN']]) {
  const d = declared(attr), hs = handlers(obj);
  const missing = [...d].filter((x) => !hs.has(x));
  const unused = [...hs].filter((x) => !d.has(x) && !(obj === 'A' && ['go'].includes(x)));
  ok(`${attr}: every hook has a handler (${d.size} hooks)`, missing.length === 0, 'missing ' + missing.join(', '));
  ok(`${attr}: no orphaned handlers`, unused.length === 0, 'unused ' + unused.join(', '));
}
const htmlHooks = [...read('index.html').matchAll(/data-action="([a-z0-9-]+)"/g)].map((m) => m[1]);
ok('index.html hooks have handlers', htmlHooks.every((x) => handlers('A').has(x)), htmlHooks.filter((x) => !handlers('A').has(x)).join(','));

// 3. CSP compliance: no inline scripts, inline handlers or style attributes in markup or templates
const index = read('index.html');
ok('index.html has a Content-Security-Policy', /http-equiv="Content-Security-Policy"/.test(index) && /script-src 'self'/.test(index));
ok('index.html has no inline <script> bodies', ![...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].some((m) => m[1].trim()));
for (const f of ['index.html', 'assets/js/app.js']) {
  const s = read(f);
  ok(f + ' has no inline event handler attributes', !/\son[a-z]+\s*=\s*["']/i.test(s.replace(/onerror=window/g, '')));
  ok(f + ' has no inline style attributes', !/\sstyle\s*=\s*["']/.test(s));
}
ok('no eval / new Function in frontend', !/\beval\(|new Function\(/.test(app + read('assets/js/core.js') + read('assets/js/api.js')));

// 4. Vendored dependency integrity
const vendor = fs.readFileSync(path.join(root, 'vendor/xlsx-0.20.3.full.min.js'));
const sri = 'sha384-' + crypto.createHash('sha384').update(vendor).digest('base64');
ok('SheetJS SRI matches app.js', app.includes(sri), sri);

// 5. Secrets and private data
const files = execSync('git ls-files', { cwd: root }).toString().split('\n').filter(Boolean).filter((f) => !f.startsWith('vendor/') && !/\.(png|xlsx)$/.test(f) && f !== 'package-lock.json');
const patterns = [
  [/AKfycb[\w-]{20,}/, 'Apps Script deployment id'],
  [/API_TOKEN\s*=\s*["'][0-9a-f]{32,}["']/, 'embedded API token'],
  [/docs\.google\.com\/spreadsheets\/d\/[\w-]{20,}/, 'Google Sheet URL'],
  [/(ADMIN|MEMBER)_PASSWORD\s*=\s*['"][^'"]{4,}/, 'hardcoded shared password'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/AIza[0-9A-Za-z\-_]{35}/, 'Google API key']
];
const hits = [];
for (const f of files) {
  if (f === 'scripts/check.mjs') continue;
  const s = fs.readFileSync(path.join(root, f), 'utf8');
  const publicBackendUrl = f === 'config.js'; // the live backend URL is public by design: the browser must call it
  for (const [re, label] of patterns) if (re.test(s) && !(publicBackendUrl && label === 'Apps Script deployment id')) hits.push(f + ': ' + label);
}
ok('no secrets or deployment identifiers in tracked files', hits.length === 0, hits.join('; '));
ok('config.js apiUrl is empty or an Apps Script /exec URL', /apiUrl:\s*'(https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec)?'/.test(read('config.js')));
const leftovers = ['vrm_pw', 'api.ipify.org', 'API_TOKEN'].filter((k) => (app + read('assets/js/api.js')).includes(k) && !(k === 'vrm_pw' && read('assets/js/api.js').includes("LEGACY_KEYS")));
ok('legacy insecure mechanisms removed from frontend (shared password storage, IP lookup, static token)', leftovers.length === 0, leftovers.join(','));

// History check (informational for the release notes: secrets that already left the building)
try {
  const r = spawnSync('git', ['log', '--all', '--format=%h', '-G', 'const API_TOKEN *= *"[0-9a-f]{32,}"', '--', 'index.html'], { cwd: root, encoding: 'utf8' });
  const commits = [...new Set((r.stdout || '').match(/^[0-9a-f]{7,}$/gm) || [])];
  console.log('INFO embedded v2 API token added/removed in index.html history at commits: ' + (commits.join(' ') || 'none') + ' (treat as public; retire the v2 deployment)');
} catch (e) { /* not a git checkout */ }

console.log(failures.length ? `\n${failures.length} check(s) FAILED` : '\nAll static checks passed');
process.exit(failures.length ? 1 : 0);
