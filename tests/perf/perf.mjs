// Performance benchmark of backend/Code.gs at 10k / 25k / 50k entries in the LOCAL EMULATOR.
// This measures the algorithmic cost of the backend code on this machine. It does NOT measure
// Google Apps Script / Sheets latency (network, cold start, Sheets I/O), which must be measured on staging.
//   node tests/perf/perf.mjs [--sizes 10000,25000,50000] [--json docs/perf-results.json]
import fs from 'node:fs';
import { createSeededBackend, login } from '../harness/gas-emulator.mjs';

const args = process.argv.slice(2);
const val = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const sizes = val('sizes', '10000,25000,50000').split(',').map(Number);
const ADMIN = { name: 'Jayesh Mahajan', role: 'admin', vrm: '', password: 'Admin-pass-0001!' };
const NOW = Date.parse('2026-11-17T06:00:00Z');

function pct(xs, p) { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)]; }
function time(fn, runs = 7) {
  const xs = [];
  let last;
  for (let i = 0; i < runs; i++) { const t = process.hrtime.bigint(); last = fn(); xs.push(Number(process.hrtime.bigint() - t) / 1e6); }
  return { p50: +pct(xs, 50).toFixed(1), p95: +pct(xs, 95).toFixed(1), ok: last && last.ok !== false };
}

const results = [];
for (const n of sizes) {
  const be = createSeededBackend({ now: NOW, users: [ADMIN] });
  const tok = login(be, ADMIN.name, ADMIN.password);
  const vrms = be.call('getData', { token: tok }).data.vrms;
  const t0 = Date.now();
  for (let i = 0; i < n; i += 1500) {
    const rows = [];
    for (let k = i; k < Math.min(n, i + 1500); k++) {
      const d = new Date(Date.UTC(2024, 0, 1) + (k % 1050) * 86400000).toISOString().slice(0, 10);
      rows.push({ row: k + 2, vrm: vrms[k % vrms.length].name, date: d, code: 'PF' + String(k).padStart(7, '0') });
    }
    const r = be.call('commitImport', { token: tok, batchId: 'perf-' + n + '-' + i, chunkIndex: 0, chunkCount: 1, rows });
    if (!r.ok) throw new Error(JSON.stringify(r.error));
  }
  const loadMs = Date.now() - t0;
  let serial = 0;
  const codes = (m) => Array.from({ length: m }, () => 'NEW' + n + '-' + (serial++));
  const row = {
    entries: n,
    bulkLoadSeconds: +(loadMs / 1000).toFixed(1),
    getData: time(() => be.call('getData', { token: tok })),
    addEntries100: time(() => be.call('addEntries', { token: tok, vrmId: vrms[0].id, date: '2026-11-17', codes: codes(100) }), 5),
    commitImport1500: time(() => {
      const rows = codes(1500).map((c, i) => ({ row: i + 2, vrm: vrms[1].name, date: '2026-11-16', code: c }));
      return be.call('commitImport', { token: tok, batchId: 'perfc-' + serial, chunkIndex: 0, chunkCount: 1, rows });
    }, 3),
    queryEntriesPage: time(() => be.call('queryEntries', { token: tok, q: 'PF00012', pageSize: 50 })),
    lookup100: time(() => be.call('lookupCodes', { token: tok, codes: Array.from({ length: 100 }, (_, i) => 'PF' + String(i * 7).padStart(7, '0')) })),
    exportYear: time(() => be.call('exportReport', { token: tok, filter: { year: '2025' } }), 3),
    integrity: time(() => be.call('integrityReport', { token: tok }), 3),
    sheetCells: be.sheetRows('Entries').length * be.ctx.SCHEMA.Entries.length
  };
  results.push(row);
  console.log(JSON.stringify(row));
}
const out = val('json');
if (out) fs.writeFileSync(out, JSON.stringify({ environment: 'local emulator (Node ' + process.version + ', ' + process.platform + ')', note: 'Algorithmic cost only; not Google Apps Script latency.', measuredAt: new Date().toISOString(), results }, null, 2));
