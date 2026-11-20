#!/usr/bin/env node
// Prepare a legacy (v1/v2) data export for migration into the v3 backend. Read-only on the source.
//
//   node scripts/migrate-legacy.mjs <legacy-export.csv> [--out .local/migration] [--as-of YYYY-MM-DD]
//        [--vrm-col "VRM"] [--date-col "Date"] [--code-col "Client Code"] [--date-order dmy|mdy|auto]
//        [--aliases aliases.json]   (JSON array of [alias, canonical] pairs; defaults to the seeded list)
//
// Produces in --out:
//   baseline.json / baseline.md   source counts, distinct normalised codes, duplicates, invalid rows,
//                                 per VRM / date / month / year totals of the CLEAN set (the expected target)
//   exceptions.csv                every source row that will NOT be migrated, with the reason
//   import-NNN.csv                clean rows in chunks of <= 1500 (VRM,Date,Client Code), codes kept as text
// Nothing is uploaded. Import the chunks through the app (admin, Excel/CSV import) or commitImport,
// then run scripts/reconcile.mjs against an export of the new system.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = require(path.join(root, 'assets/js/core.js'));
const XLSX = require(path.join(root, 'vendor/xlsx-0.20.3.full.min.js'));

const DEFAULT_ALIASES = [
  ['swarnarekha shetty', 'Swarna Shetty'], ['swarnarekha divakar shetty', 'Swarna Shetty'], ['pavan lekhraj soni', 'Pavan Soni'],
  ['manisha hemant mahante', 'Manisha Mahante'], ['khushi mahesh dodiya', 'Khushi Dodiya'], ['aakanksha baranwal', 'Aakansha Baranwal'],
  ['parth sharma vijay', 'Parth Sharma']
];

export function prepareMigration(csvText, opts = {}) {
  const asOf = opts.asOf || C.todayIST(Date.now());
  const aliases = new Map((opts.aliases || DEFAULT_ALIASES).map(([a, c]) => [C.nameKey(a), C.displayName(c)]));
  const wb = XLSX.read(csvText.replace(/^﻿/, ''), { type: 'string', raw: true });
  const grid = C.sheetToGrid(XLSX, wb.Sheets[wb.SheetNames[0]]);
  if (!grid.length) throw new Error('Export is empty');
  const headers = grid[0].map(C.cellText);
  const find = (want, fallback) => {
    if (want) { const i = headers.findIndex((h) => C.normHeader(h) === C.normHeader(want)); if (i < 0) throw new Error('Column not found: ' + want); return i; }
    return fallback;
  };
  const auto = C.autoMapHeaders(headers);
  const map = { mode: 'structured', headerRow: 0, vrm: find(opts.vrmCol, auto.vrm), date: find(opts.dateCol, auto.date), code: find(opts.codeCol, auto.code) };
  if (map.vrm < 0 || map.date < 0 || map.code < 0) throw new Error('Could not identify VRM / Date / Client Code columns; pass --vrm-col/--date-col/--code-col');
  const parsed = C.buildImportRows(grid, map, { today: asOf, dateOrder: opts.dateOrder || 'auto' });
  const clean = [], exceptions = [];
  for (const r of parsed.rows) {
    const canonical = aliases.get(C.nameKey(r.vrm)) || C.displayName(r.vrm);
    if (r.status === 'OK') clean.push({ row: r.row, vrm: canonical, sourceVrm: r.vrm, date: r.date, code: r.code, key: C.normCode(r.code).key });
    else exceptions.push({ row: r.row, vrm: r.vrm, date: r.date, code: r.code, status: r.status, reason: r.reason });
  }
  const tally = (keyFn) => { const m = {}; clean.forEach((r) => { const k = keyFn(r); m[k] = (m[k] || 0) + 1; }); return Object.fromEntries(Object.entries(m).sort()); };
  const allKeys = parsed.rows.map((r) => C.normCode(r.code).key).filter(Boolean);
  const baseline = {
    generatedAt: new Date().toISOString(), asOf, dateOrder: parsed.order,
    sourceDataRows: parsed.rows.length, blankRowsIgnored: parsed.blankRows,
    distinctNormalisedCodesInSource: new Set(allKeys).size,
    cleanRows: clean.length, exceptionRows: exceptions.length,
    exceptionsByStatus: exceptions.reduce((m, e) => { m[e.status] = (m[e.status] || 0) + 1; return m; }, {}),
    aliasResolutions: clean.filter((r) => C.nameKey(r.sourceVrm) !== C.nameKey(r.vrm)).length,
    perVrm: tally((r) => r.vrm), perYear: tally((r) => r.date.slice(0, 4)), perMonth: tally((r) => r.date.slice(0, 7)),
    perVrmDate: tally((r) => r.vrm + '|' + r.date),
    check: { cleanPlusExceptionsEqualsSource: clean.length + exceptions.length === parsed.rows.length, cleanCodesUnique: new Set(clean.map((r) => r.key)).size === clean.length }
  };
  return { baseline, clean, exceptions };
}

function writeOutputs(res, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'baseline.json'), JSON.stringify(res.baseline, null, 2));
  const b = res.baseline;
  fs.writeFileSync(path.join(outDir, 'baseline.md'), [
    '# Legacy export baseline', '', `Generated ${b.generatedAt} · as-of ${b.asOf} (IST) · detected date order: ${b.dateOrder}`, '',
    '| Measure | Value |', '|---|---:|',
    [['Source data rows', b.sourceDataRows], ['Blank rows ignored', b.blankRowsIgnored], ['Distinct normalised codes in source', b.distinctNormalisedCodesInSource],
      ['Rows to migrate (clean)', b.cleanRows], ['Rows NOT migrated (exceptions)', b.exceptionRows], ['Names resolved through aliases', b.aliasResolutions]
    ].map((r) => `| ${r[0]} | ${r[1]} |`).join('\n'), '', '## Exceptions by reason', '', ...Object.entries(b.exceptionsByStatus).map(([k, v]) => `- ${C.STATUS_TEXT[k] || k}: ${v}`),
    '', '## Per VRM (clean set)', '', '| VRM | Activations |', '|---|---:|', ...Object.entries(b.perVrm).map(([k, v]) => `| ${k} | ${v} |`),
    '', '## Per year', '', ...Object.entries(b.perYear).map(([k, v]) => `- ${k}: ${v}`), '',
    `Checks: clean + exceptions = source → ${b.check.cleanPlusExceptionsEqualsSource ? 'PASS' : 'FAIL'}; clean codes unique → ${b.check.cleanCodesUnique ? 'PASS' : 'FAIL'}`, ''].join('\n'));
  fs.writeFileSync(path.join(outDir, 'exceptions.csv'), C.toCsv([['Source row', 'VRM', 'Date', 'Client Code', 'Status', 'Reason']].concat(res.exceptions.map((e) => [e.row, e.vrm, e.date, e.code, C.STATUS_TEXT[e.status] || e.status, e.reason]))));
  C.chunk(res.clean, C.MAX_ROWS).forEach((ch, i) => {
    fs.writeFileSync(path.join(outDir, `import-${String(i + 1).padStart(3, '0')}.csv`), C.toCsv([['VRM', 'Date', 'Client Code']].concat(ch.map((r) => [r.vrm, r.date, r.code]))));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const val = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
  const src = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
  if (!src) { console.error('Usage: node scripts/migrate-legacy.mjs <legacy-export.csv> [--out dir] [--as-of YYYY-MM-DD]'); process.exit(2); }
  const aliasFile = val('aliases');
  const res = prepareMigration(fs.readFileSync(src, 'utf8'), {
    asOf: val('as-of'), vrmCol: val('vrm-col'), dateCol: val('date-col'), codeCol: val('code-col'), dateOrder: val('date-order'),
    aliases: aliasFile ? JSON.parse(fs.readFileSync(aliasFile, 'utf8')) : undefined
  });
  const out = path.resolve(val('out', '.local/migration'));
  writeOutputs(res, out);
  console.log(JSON.stringify({ out, ...res.baseline, perVrmDate: undefined, perMonth: undefined }, null, 2));
  if (!res.baseline.check.cleanPlusExceptionsEqualsSource || !res.baseline.check.cleanCodesUnique) process.exit(1);
}
