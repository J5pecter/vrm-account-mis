#!/usr/bin/env node
// Local staging server: serves the static frontend and runs backend/Code.gs in the Apps Script emulator.
// This is a LOCAL EMULATOR, not Google Apps Script. Use it for development, demos and automated E2E tests.
//
//   node scripts/dev-server.mjs [--port 8787] [--fresh] [--demo] [--test-hooks] [--latency 0] [--data .local/emulator.json]
//
// Accounts come from tests/fixtures/local-users.json (fictional people, test-only passwords).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createBackend, provision } from '../tests/harness/gas-emulator.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const val = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const port = Number(val('port', process.env.PORT || 8787));
const dataFile = path.resolve(root, val('data', '.local/emulator.json'));
const latency = Number(val('latency', 0));
const hooks = flag('test-hooks');

fs.mkdirSync(path.dirname(dataFile), { recursive: true });
if (flag('fresh') && fs.existsSync(dataFile)) fs.rmSync(dataFile);
const isNew = !fs.existsSync(dataFile);
let clockOffset = 0;
const be = createBackend({ persistFile: dataFile, now: Date.now() });
be.ctx.CLOCK_ = () => Date.now() + clockOffset;

if (isNew) {
  be.run('setup');
  const users = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/local-users.json'), 'utf8'));
  for (const u of users) provision(be, u, { changePassword: !u.mustChangePassword });
  if (flag('demo')) seedDemo();
  console.log('Initialised emulator data at', path.relative(root, dataFile));
}

/** Fictional demo data over ~14 months so dashboards and charts have something to show. */
function seedDemo() {
  const admin = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/local-users.json'), 'utf8')).find((u) => u.role === 'admin');
  const tok = be.call('login', { user: admin.name, pw: admin.password }).data.token;
  const vrms = be.call('getData', { token: tok }).data.vrms;
  let seed = 42;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const now = Date.now();
  const rows = [];
  let serial = 1000;
  for (let d = 420; d >= 1; d--) {
    const day = new Date(now - d * 86400000 + 5.5 * 3600000).toISOString().slice(0, 10);
    const dow = new Date(day + 'T00:00:00Z').getUTCDay();
    if (dow === 0) continue;
    vrms.forEach((v, i) => {
      const n = rnd(4 + (i % 3)) - 1;
      for (let k = 0; k < n; k++) rows.push({ row: rows.length + 2, vrm: v.name, date: day, code: 'DM' + String(serial++).padStart(7, '0') });
    });
  }
  for (let i = 0; i < rows.length; i += 1500) {
    const chunk = rows.slice(i, i + 1500);
    be.call('commitImport', { token: tok, batchId: 'demo-seed-' + String(i / 1500).padStart(4, '0'), chunkIndex: 0, chunkCount: 1, rows: chunk, fileName: 'synthetic-demo-data.csv', fileRows: chunk.length, mode: 'structured' });
  }
  be.call('logout', { token: tok });
  console.log('Seeded', rows.length, 'synthetic demo activations');
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const ALLOWED = [/^\/index\.html$/, /^\/assets\/(css|js)\/[\w.-]+$/, /^\/vendor\/[\w.-]+$/, /^\/templates\/[\w.-]+$/];
const echo = new Map();
let failNext = null; // test hook: 'drop-response' | 'busy'
let failTimes = 0;   // how many consecutive POSTs the hook applies to (browsers silently retry a dropped POST once)

function send(res, code, body, type, extra = {}) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (req.method === 'POST' && p === '/exec') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { body += c; if (body.length > 4e6) req.destroy(); });
    req.on('end', () => {
      setTimeout(() => {
        const mode = failNext;
        if (mode && --failTimes <= 0) failNext = null;
        if (mode === 'busy') be.lock.busy = true;
        const out = be.raw(body);
        be.lock.busy = false;
        if (mode === 'drop-response') { req.socket.destroy(); return; } // committed, but the client never hears back
        // Apps Script answers POST /exec with a 302 to a one-time googleusercontent URL; mimic it.
        const id = crypto.randomUUID();
        echo.set(id, JSON.stringify(out));
        setTimeout(() => echo.delete(id), 60000);
        send(res, 302, '', 'text/plain', { Location: '/echo/' + id });
      }, latency);
    });
    return;
  }
  if (req.method === 'GET' && p.startsWith('/echo/')) {
    const body = echo.get(p.slice(6));
    if (!body) return send(res, 404, 'expired', 'text/plain');
    echo.delete(p.slice(6));
    return send(res, 200, body, 'application/json; charset=utf-8');
  }
  if (req.method === 'GET' && p === '/exec') return send(res, 200, be.ctx.doGet({}).payload, 'application/json; charset=utf-8');
  if (hooks && req.method === 'POST' && p.startsWith('/__test/')) {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const j = body ? JSON.parse(body) : {};
      if (p === '/__test/clock') clockOffset = j.now ? j.now - Date.now() : 0;
      if (p === '/__test/fail-next') { failNext = j.mode || null; failTimes = j.times || 1; }
      send(res, 200, JSON.stringify({ ok: true, now: Date.now() + clockOffset }), 'application/json');
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', 'text/plain');
  if (p === '/config.js') {
    return send(res, 200, `window.VRM_CONFIG = { apiUrl: '/exec', environment: 'local-emulator' };\n`, TYPES['.js']);
  }
  const rel = p === '/' ? '/index.html' : p;
  if (!ALLOWED.some((re) => re.test(rel))) return send(res, 404, 'Not found', 'text/plain');
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file)) return send(res, 404, 'Not found', 'text/plain');
  send(res, 200, fs.readFileSync(file), TYPES[path.extname(file)] || 'application/octet-stream');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`VRM MIS local emulator: http://127.0.0.1:${port}/  (backend: emulated Apps Script, data: ${path.relative(root, dataFile)})${hooks ? ' [test hooks ON]' : ''}`);
});
