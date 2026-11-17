#!/usr/bin/env node
// Reconcile a migration baseline (or any expected detail) against an export of the v3 system.
//
//   node scripts/reconcile.mjs --expected .local/migration --actual <v3-export.xlsx|.csv> [--json out.json]
//
// --expected: a directory written by migrate-legacy.mjs (uses its import-*.csv files) or a CSV with VRM,Date,Client Code.
// --actual:   the "All data" Excel export from the app (Detail sheet) or its CSV export.
// Compares code sets and counts per VRM, per date, per month, per year and team total. Exit 1 on any difference.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = require(path.join(root, 'assets/js/core.js'));
const XLSX = require(path.join(root, 'vendor/xlsx-0.20.3.full.min.js'));

function rowsFromGrid(grid) {
  const hi = grid.findIndex((r) => r && r.some((c) => C.normHeader(C.cellText(c)) === 'client code'));
  if (hi < 0) throw new Error('No "Client Code" header found');
  const heads = grid[hi].map((c) => C.normHeader(C.cellText(c)));
  const iv = heads.indexOf('vrm'), idt = heads.findIndex((h) => h === 'date' || h === 'activation date'), ic = heads.indexOf('client code');
  return grid.slice(hi + 1).filter((r) => r && r[ic] && C.cellText(r[ic]).trim()).map((r) => ({ vrm: C.displayName(C.cellText(r[iv])), date: C.cellText(r[idt]).trim(), key: C.normCode(C.cellText(r[ic])).key }));
}
export function loadRows(p) {
  const st = fs.statSync(p);
  if (st.isDirectory()) return fs.readdirSync(p).filter((f) => /^import-\d+\.csv$/.test(f)).sort().flatMap((f) => loadRows(path.join(p, f)));
  if (/\.xlsx?$/i.test(p)) {
    const wb = XLSX.read(fs.readFileSync(p), { type: 'buffer' });
    const ws = wb.Sheets.Detail || wb.Sheets['All entries'] || wb.Sheets[wb.SheetNames[0]];
    return rowsFromGrid(C.sheetToGrid(XLSX, ws));
  }
  const text = fs.readFileSync(p, 'utf8').replace(/^﻿/, '');
  // App CSV exports are stacked (metadata, Summary, Detail). Use the Detail block when present.
  const lines = text.split(/\r?\n/);
  const d = lines.indexOf('Detail');
  const body = d >= 0 ? lines.slice(d + 1).join('\n') : text;
  const wb = XLSX.read(body, { type: 'string', raw: true });
  return rowsFromGrid(C.sheetToGrid(XLSX, wb.Sheets[wb.SheetNames[0]]));
}
export function reconcile(expected, actual) {
  const group = (rows, f) => rows.reduce((m, r) => { const k = f(r); m[k] = (m[k] || 0) + 1; return m; }, {});
  const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().filter((k) => (a[k] || 0) !== (b[k] || 0)).map((k) => ({ key: k, expected: a[k] || 0, actual: b[k] || 0 }));
  const ek = new Set(expected.map((r) => r.key)), ak = new Set(actual.map((r) => r.key));
  const dims = {
    perVrm: (r) => r.vrm, perYear: (r) => r.date.slice(0, 4), perMonth: (r) => r.date.slice(0, 7), perDate: (r) => r.date, perVrmDate: (r) => r.vrm + '|' + r.date
  };
  const out = { expectedRows: expected.length, actualRows: actual.length, missingInActual: [...ek].filter((k) => !ak.has(k)), unexpectedInActual: [...ak].filter((k) => !ek.has(k)),
    duplicateKeysInActual: actual.length - ak.size, differences: {} };
  for (const [name, f] of Object.entries(dims)) out.differences[name] = diff(group(expected, f), group(actual, f));
  out.pass = out.expectedRows === out.actualRows && !out.missingInActual.length && !out.unexpectedInActual.length && !out.duplicateKeysInActual &&
    Object.values(out.differences).every((d) => !d.length);
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const val = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : undefined; };
  if (!val('expected') || !val('actual')) { console.error('Usage: node scripts/reconcile.mjs --expected <dir|csv> --actual <xlsx|csv>'); process.exit(2); }
  const r = reconcile(loadRows(val('expected')), loadRows(val('actual')));
  if (val('json')) fs.writeFileSync(val('json'), JSON.stringify(r, null, 2));
  console.log(`Expected ${r.expectedRows} rows, actual ${r.actualRows}; missing ${r.missingInActual.length}; unexpected ${r.unexpectedInActual.length}; duplicate keys ${r.duplicateKeysInActual}`);
  for (const [k, d] of Object.entries(r.differences)) console.log(`${k}: ${d.length ? d.length + ' difference(s), e.g. ' + JSON.stringify(d.slice(0, 3)) : 'match'}`);
  console.log(r.pass ? 'RECONCILIATION PASS' : 'RECONCILIATION FAIL');
  process.exit(r.pass ? 0 : 1);
}
