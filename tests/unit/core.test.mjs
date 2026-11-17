// Unit tests for assets/js/core.js (pure logic) and parity with backend/Code.gs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createBackend, createSeededBackend, login } from '../harness/gas-emulator.mjs';

const require = createRequire(import.meta.url);
const C = require('../../assets/js/core.js');
const XLSX = require('../../vendor/xlsx-0.20.3.full.min.js');

/* ----------------------------- normalisation ----------------------------- */
test('normCode: trims, keeps leading zeros, NFKC + upper-case key', () => {
  assert.deepEqual(C.normCode('  000123 '), { ok: true, original: '000123', key: '000123', reason: '' });
  assert.equal(C.normCode('cl-9/a').key, 'CL-9/A');
  assert.equal(C.normCode('ＣＬ１').key, 'CL1');
  assert.equal(C.normCode('ß1').key, 'SS1');
  for (const bad of ['', ' ', 'a b', 'x'.repeat(71), 'a​b', 'a\u0000', '=1', '+1', '-1', '@a', 5, null]) assert.equal(C.normCode(bad).ok, false, String(bad));
  assert.equal(C.normCode('x'.repeat(70)).ok, true);
  assert.equal(C.normCode('AB12', '^[A-Z]{2}\\d+$').ok, true);
  assert.equal(C.normCode('ab12', '^[A-Z]{2}\\d+$').ok, false);
});

test('splitCodes / analyzePaste: commas, semicolons, new lines; blanks ignored; duplicates flagged', () => {
  assert.deepEqual(C.splitCodes('A1, B2;C3\nD4\r\n\n , ;E5'), ['A1', 'B2', 'C3', 'D4', 'E5']);
  const a = C.analyzePaste('X1,x1, X1 ;X1\nX1, bad code, Y2');
  assert.deepEqual(a.summary, { tokens: 7, unique: 2, duplicateInPaste: 4, invalid: 1 });
  assert.equal(a.codes.length, 7, 'every token is sent so the server reports on each one');
});

test('parity: core.normCode and core.nameKey match backend normCode_/nameKey_ on a fuzz corpus', () => {
  const be = createBackend();
  const corpus = ['000123', ' cl002 ', 'ＣＬ００２', 'ß', 'ǅ1', 'Ａ-Ｂ', 'x'.repeat(70), 'x'.repeat(71), 'a\tb', 'a b', '　A　', 'é', 'é',
    '=SUM(A1)', '@x', '-5', '+5', '', '   ', 'İSTANBUL', 'ﬁ1', 'Ⅻ', '①', 'a‍b', 'A‮B', 'ok_code-1/2.3', '😀1', 'İ'];
  for (let i = 0; i < 300; i++) corpus.push(String.fromCodePoint(...Array.from({ length: 1 + (i % 6) }, (_, j) => 33 + ((i * 7919 + j * 104729) % 0x2FFF))));
  for (const s of corpus) {
    const a = C.normCode(s), b = be.ctx.normCode_(s);
    assert.equal(a.ok, b.ok, 'ok mismatch for ' + JSON.stringify(s));
    assert.equal(a.key, b.key, 'key mismatch for ' + JSON.stringify(s));
    assert.equal(C.nameKey(s), be.ctx.nameKey_(s));
  }
});

/* ----------------------------- dates & time zone ----------------------------- */
test('todayIST uses Asia/Kolkata, including 00:15 IST when UTC is still the previous day', () => {
  assert.equal(C.todayIST(Date.parse('2026-11-16T18:45:00Z')), '2026-11-17');
  assert.equal(C.todayIST(Date.parse('2026-11-16T18:29:59Z')), '2026-11-16');
  assert.equal(C.todayIST(Date.parse('2026-12-31T18:30:00Z')), '2027-01-01');
});

test('checkActivationDate: leap years, impossible dates, future, minimum year', () => {
  const today = '2026-11-17';
  assert.equal(C.checkActivationDate('2024-02-29', today).ok, true);
  assert.equal(C.checkActivationDate('2026-02-29', today).code, 'INVALID_DATE');
  assert.equal(C.checkActivationDate('2026-04-31', today).code, 'INVALID_DATE');
  assert.equal(C.checkActivationDate('2026-11-18', today).code, 'FUTURE_DATE');
  assert.equal(C.checkActivationDate('2026-11-17', today).ok, true);
  assert.equal(C.checkActivationDate('1999-12-31', today).ok, false);
  assert.equal(C.checkActivationDate('2026-1-5', today).ok, false);
});

test('resolvePeriod: month, year, inclusive range overriding year/month, open ranges, reversed range', () => {
  const t = '2026-11-17';
  assert.deepEqual(C.resolvePeriod({ year: '2024', month: '02' }, t), { ok: true, kind: 'month', from: '2024-02-01', to: '2024-02-29', label: 'February 2024' });
  assert.equal(C.resolvePeriod({ year: '2026' }, t).to, '2026-12-31');
  const r = C.resolvePeriod({ year: '2020', month: '01', from: '2026-11-01', to: '2026-11-17' }, t);
  assert.equal(r.kind, 'range');
  assert.equal(r.from, '2026-11-01');
  assert.equal(C.resolvePeriod({ from: '2026-11-01' }, t).to, '9999-12-31');
  assert.equal(C.resolvePeriod({ to: '2026-11-01' }, t).from, '0000-01-01');
  assert.equal(C.resolvePeriod({ from: '2026-11-02', to: '2026-11-01' }, t).ok, false);
  assert.equal(C.resolvePeriod({ from: '2026-02-30' }, t).ok, false);
});

test('parity: resolvePeriod matches backend resolvePeriod_ bounds', () => {
  const be = createBackend({ now: Date.parse('2026-11-17T06:00:00Z') });
  const cases = [{ year: '2026' }, { year: '2024', month: '02' }, { year: '2026', month: '12' }, { from: '2026-01-01' }, { to: '2026-05-05' },
    { from: '2026-03-01', to: '2026-03-01', year: '2020' }, { allTime: true }];
  for (const f of cases) {
    const a = C.resolvePeriod(f, '2026-11-17'), b = be.ctx.resolvePeriod_(f);
    assert.deepEqual([a.kind, a.from, a.to], [b.kind, b.from, b.to], JSON.stringify(f));
  }
});

/* ----------------------------- metrics ----------------------------- */
const VRMS = [{ id: 'a', name: 'Alpha', status: 'active' }, { id: 'b', name: 'Beta', status: 'active' }, { id: 'c', name: 'Gamma', status: 'active' }, { id: 'd', name: 'Delta', status: 'archived' }, { id: 'e', name: 'Echo', status: 'archived' }];
const COUNTS = [['a', '2026-11-17', 2], ['a', '2026-11-01', 3], ['a', '2025-12-31', 1], ['b', '2026-11-17', 1], ['b', '2026-01-01', 4], ['d', '2026-03-03', 5]];

test('computeMetrics: today/month/year/all, zero performers, archived history, share and reporting status', () => {
  const p = C.resolvePeriod({ year: '2026', month: '11' }, '2026-11-17');
  const m = C.computeMetrics({ vrms: VRMS, counts: COUNTS, zeroReports: [['c', '2026-11-17']], today: '2026-11-17', period: p });
  assert.deepEqual(m.teamTotals, { today: 3, month: 6, year: 15, all: 16, period: 6 });
  assert.equal(m.activeVrmCount, 3);
  assert.deepEqual(m.rows.map((r) => r.name), ['Alpha', 'Beta', 'Gamma', 'Delta'], 'archived without history (Echo) omitted');
  const g = m.rows.find((r) => r.vrmId === 'c');
  assert.deepEqual([g.today, g.all, g.reporting], [0, 0, 'zero']);
  assert.equal(m.rows.find((r) => r.vrmId === 'a').reporting, 'filed');
  assert.equal(m.rows.find((r) => r.vrmId === 'd').reporting, 'none');
  assert.equal(m.rows.find((r) => r.vrmId === 'a').share, 5 / 6);
  assert.equal(m.rows.reduce((s, r) => s + r.period, 0), m.teamTotals.period, 'team = sum of VRMs');
});

test('computeMetrics: single-VRM scope and zero denominator', () => {
  const p = C.resolvePeriod({ year: '2019' }, '2026-11-17');
  const m = C.computeMetrics({ vrms: VRMS, counts: COUNTS, today: '2026-11-17', period: p, vrmId: 'b' });
  assert.equal(m.rows.length, 1);
  assert.equal(m.rows[0].share, 0);
  assert.equal(C.fmtPct(0, 0), '0%');
  assert.equal(C.fmtPct(1, 3), '33%');
  assert.equal(C.fmtPct(1, 200), '0.5%');
});

test('monthlySeries: calendar year and rolling 12 months', () => {
  const y = C.monthlySeries(COUNTS, { year: '2026', today: '2026-11-17' });
  assert.equal(y.length, 12);
  assert.equal(y[10].count, 6);
  assert.equal(y[0].count, 4);
  const r = C.monthlySeries(COUNTS, { mode: 'last12', today: '2026-11-17' });
  assert.equal(r[0].key, '2025-12');
  assert.equal(r[11].key, '2026-11');
  assert.equal(r[0].count, 1);
  assert.equal(C.monthlySeries(COUNTS, { year: '2026', today: '2026-11-17', vrmId: 'd' })[2].count, 5);
});

test('parity: client metric engine equals server export totals for random data and filters', () => {
  const be = createSeededBackend({ now: Date.parse('2026-11-17T06:00:00Z'), users: [{ name: 'Jayesh Mahajan', role: 'admin', vrm: '', password: 'Admin-pass-0001!' }] });
  const tok = login(be, 'Jayesh Mahajan', 'Admin-pass-0001!');
  const vrms = be.call('getData', { token: tok }).data.vrms;
  let seed = 7;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const dates = ['2025-12-31', '2026-01-01', '2026-02-28', '2026-10-31', '2026-11-01', '2026-11-16', '2026-11-17'];
  for (let i = 0; i < 30; i++) {
    const v = vrms[rnd(vrms.length)];
    const codes = Array.from({ length: 1 + rnd(8) }, () => 'P' + rnd(400));
    be.call('addEntries', { token: tok, vrmId: v.id, date: dates[rnd(dates.length)], codes });
  }
  const snap = be.call('getData', { token: tok }).data;
  const filters = [{ year: '2026' }, { year: '2026', month: '11' }, { year: '2025' }, { from: '2026-10-31', to: '2026-11-16' }, { from: '2026-11-17' }, { to: '2026-01-01' }];
  for (const f of filters) {
    for (const vrmId of ['', vrms[0].id, vrms[3].id]) {
      const p = C.resolvePeriod(f, snap.asOf ? '2026-11-17' : '');
      const m = C.computeMetrics({ vrms: snap.vrms, counts: snap.counts, today: '2026-11-17', period: p, vrmId });
      const exp = be.call('exportReport', { token: tok, filter: { ...f, vrmId } }).data;
      assert.equal(m.scopeTotals.period, exp.total, JSON.stringify(f) + vrmId);
      assert.equal(exp.detail.length, exp.total);
      for (const s of exp.summary) assert.equal(m.allRows.find((r) => r.vrmId === s.vrmId).period, s.count);
    }
  }
});

/* ----------------------------- CSV ----------------------------- */
test('csvCell neutralises formulas and quotes separators; toCsv adds BOM and CRLF', () => {
  assert.equal(C.csvCell('=1+1'), "'=1+1");
  assert.equal(C.csvCell('+91'), "'+91");
  assert.equal(C.csvCell('-5'), "'-5");
  assert.equal(C.csvCell('@SUM(1)'), "'@SUM(1)");
  assert.equal(C.csvCell('\tcmd'), "'\tcmd");
  assert.equal(C.csvCell('\rx'), "\"'\rx\"");
  assert.equal(C.csvCell('a,b'), '"a,b"');
  assert.equal(C.csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(C.csvCell('000123'), '000123');
  assert.equal(C.csvCell(null), '');
  const csv = C.toCsv([['h1', 'h2'], ['=x', '0012']]);
  assert.ok(csv.startsWith('﻿h1,h2\r\n'));
  assert.ok(csv.includes("'=x,0012"));
});

/* ----------------------------- import parsing ----------------------------- */
test('header auto-mapping uses exact documented aliases only', () => {
  assert.deepEqual(C.autoMapHeaders(['﻿VRM', 'Date', 'Client Code']), { vrm: 0, date: 1, code: 2 });
  assert.deepEqual(C.autoMapHeaders(['RM_Name', 'Activation-Date', 'UCC']), { vrm: 0, date: 1, code: 2 });
  assert.deepEqual(C.autoMapHeaders(['Manager', 'When', 'Account']), { vrm: -1, date: -1, code: -1 }, 'no guessing from arbitrary headers');
});

test('Excel serial dates in 1900 and 1904 systems', () => {
  assert.equal(C.excelSerialToISO(46342), '2026-11-16');
  assert.equal(C.excelSerialToISO(46342.75), '2026-11-16');
  assert.equal(C.excelSerialToISO(44985), '2023-02-28');
  assert.equal(C.excelSerialToISO(45351), '2024-02-29');
  assert.equal(C.excelSerialToISO(44880, true), '2026-11-16');
});

test('text dates: ISO, named months, two-digit years, garbage', () => {
  assert.equal(C.parseTextDate('2026-11-16').iso, '2026-11-16');
  assert.equal(C.parseTextDate('2026/1/5').iso, '2026-01-05');
  assert.equal(C.parseTextDate('16-Nov-2026').iso, '2026-11-16');
  assert.equal(C.parseTextDate('Nov 16, 2026').iso, '2026-11-16');
  assert.equal(C.parseTextDate('16 September 2026').iso, '2026-09-16');
  assert.equal(C.parseTextDate('16/11/2026 10:30').kind, 'pair');
  assert.equal(C.parseTextDate('16/11/26').kind, 'invalid');
  assert.equal(C.parseTextDate('2026-02-30').kind, 'invalid');
  assert.equal(C.parseTextDate('yesterday').kind, 'invalid');
});

test('day/month order: evidence-based auto detection, ambiguity flagged, never swapped silently', () => {
  const P = (s) => C.parseTextDate(s);
  const dmyFile = C.resolvePairDates([P('16/11/2026'), P('03/04/2026')], 'auto');
  assert.equal(dmyFile.order, 'dmy');
  assert.equal(dmyFile.results[1].iso, '2026-04-03');
  const mdyFile = C.resolvePairDates([P('11/16/2026'), P('03/04/2026')], 'auto');
  assert.equal(mdyFile.order, 'mdy');
  assert.equal(mdyFile.results[1].iso, '2026-03-04');
  const unknown = C.resolvePairDates([P('03/04/2026'), P('05/05/2026')], 'auto');
  assert.equal(unknown.order, 'undetermined');
  assert.equal(unknown.results[0].error, 'AMBIGUOUS_DATE');
  assert.equal(unknown.results[1].iso, '2026-05-05', 'same day and month is unambiguous');
  const mixed = C.resolvePairDates([P('16/11/2026'), P('11/16/2026'), P('03/04/2026')], 'auto');
  assert.equal(mixed.order, 'mixed');
  assert.equal(mixed.results[2].error, 'AMBIGUOUS_DATE');
  const forced = C.resolvePairDates([P('03/04/2026'), P('13/04/2026')], 'mdy');
  assert.equal(forced.results[0].iso, '2026-03-04');
  assert.equal(forced.results[1].error, 'INVALID_DATE');
  assert.equal(C.resolvePairDates([P('29/02/2026')], 'dmy').results[0].error, 'INVALID_DATE');
});

function xlsxRoundTrip(aoa, sheets = { Data: null }) {
  const wb = XLSX.utils.book_new();
  for (const name of Object.keys(sheets)) XLSX.utils.book_append_sheet(wb, sheets[name] || XLSX.utils.aoa_to_sheet(aoa), name);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return XLSX.read(buf, { type: 'buffer' });
}

test('XLSX import: text codes keep leading zeros; numeric, custom-formatted and scientific codes handled', () => {
  const ws = XLSX.utils.aoa_to_sheet([['VRM', 'Date', 'Client Code']]);
  const put = (addr, cell) => { ws[addr] = cell; };
  put('A2', { t: 's', v: 'Parth Sharma' }); put('B2', { t: 'n', v: 46342, z: 'dd/mm/yyyy' }); put('C2', { t: 's', v: '000123' });
  put('A3', { t: 's', v: 'Parth Sharma' }); put('B3', { t: 's', v: '2026-11-15' }); put('C3', { t: 'n', v: 4567 });
  put('A4', { t: 's', v: 'Parth Sharma' }); put('B4', { t: 's', v: '15/11/2026' }); put('C4', { t: 'n', v: 123456789012345680000, z: '0.00E+00' });
  put('A5', { t: 's', v: 'Parth Sharma' }); put('B5', { t: 's', v: '14/11/2026' }); put('C5', { t: 'n', v: 42, z: '000000' });
  ws['!ref'] = 'A1:C5';
  const wb = xlsxRoundTrip(null, { Data: ws });
  const grid = C.sheetToGrid(XLSX, wb.Sheets.Data);
  const map = { mode: 'structured', headerRow: 0, ...C.autoMapHeaders(grid[0].map(C.cellText)) };
  const out = C.buildImportRows(grid, map, { today: '2026-11-17', dateOrder: 'auto' });
  assert.deepEqual(out.rows.map((r) => [r.row, r.code, r.date, r.status]), [
    [2, '000123', '2026-11-16', 'OK'],
    [3, '4567', '2026-11-15', 'NUMERIC_CODE'],
    [4, '1.23E+20', '2026-11-15', 'SCIENTIFIC_CODE'],
    [5, '000042', '2026-11-14', 'OK']
  ]);
  const inc = C.buildImportRows(grid, map, { today: '2026-11-17', includeNumericCodes: true });
  assert.equal(inc.rows[1].status, 'OK');
  assert.equal(inc.rows[2].status, 'SCIENTIFIC_CODE', 'precision-damaged codes are never accepted');
});

test('XLSX import: multiple worksheets are listed; empty and header-only sheets produce no rows', () => {
  const wb = xlsxRoundTrip(null, {
    Summary: XLSX.utils.aoa_to_sheet([['not', 'data']]),
    Empty: XLSX.utils.aoa_to_sheet([]),
    HeaderOnly: XLSX.utils.aoa_to_sheet([['VRM', 'Date', 'Client Code']])
  });
  assert.deepEqual(wb.SheetNames, ['Summary', 'Empty', 'HeaderOnly']);
  assert.deepEqual(C.sheetToGrid(XLSX, wb.Sheets.Empty), []);
  const g = C.sheetToGrid(XLSX, wb.Sheets.HeaderOnly);
  assert.equal(C.buildImportRows(g, { mode: 'structured', headerRow: 0, vrm: 0, date: 1, code: 2 }, { today: '2026-11-17' }).rows.length, 0);
});

test('CSV import (raw text mode): leading zeros, BOM, quoted commas, blank lines, in-file duplicates, future/invalid dates', () => {
  const csv = '﻿VRM,Date,Client Code\r\n"Sharma, Parth",16/11/2026,000777\r\n\r\nParth Sharma,2026-11-16,cl9\r\nParth Sharma,2026-11-16,CL9\r\nParth Sharma,2026-11-30,F1\r\nParth Sharma,31/02/2026,F2\r\n,2026-11-16,F3\r\nParth Sharma,2026-11-16,=HYPERLINK("x")\r\n';
  const wb = XLSX.read(csv.replace(/^﻿/, ''), { type: 'string', raw: true });
  const grid = C.sheetToGrid(XLSX, wb.Sheets[wb.SheetNames[0]]);
  const map = { mode: 'structured', headerRow: 0, ...C.autoMapHeaders(grid[0].map(C.cellText)) };
  const out = C.buildImportRows(grid, map, { today: '2026-11-17' });
  assert.equal(out.blankRows, 1);
  assert.deepEqual(out.rows.map((r) => r.status), ['OK', 'OK', 'DUPLICATE_IN_FILE', 'FUTURE_DATE', 'INVALID_DATE', 'MISSING_VRM', 'INVALID_CODE']);
  assert.equal(out.rows[0].code, '000777');
  assert.equal(out.rows[0].vrm, 'Sharma, Parth');
  assert.equal(out.order, 'dmy');
});

test('single-column list mode attaches the selected VRM and date', () => {
  const grid = [[{ t: 's', v: 'Client Code' }], [{ t: 's', v: '0001' }], [{ t: 's', v: '0002' }], [null]];
  const out = C.buildImportRows(grid, { mode: 'list', headerRow: 0, code: 0, vrmName: 'Pavan Soni', date: '2026-11-10' }, { today: '2026-11-17' });
  assert.deepEqual(out.rows.map((r) => [r.vrm, r.date, r.code, r.status]), [['Pavan Soni', '2026-11-10', '0001', 'OK'], ['Pavan Soni', '2026-11-10', '0002', 'OK']]);
});

test('chunk splits import rows at the server limit', () => {
  const rows = Array.from({ length: 3001 }, (_, i) => i);
  assert.deepEqual(C.chunk(rows, C.MAX_ROWS).map((c) => c.length), [1500, 1500, 1]);
});

test('esc escapes HTML-significant characters', () => {
  assert.equal(C.esc(`<img src=x onerror="a('b')">\``), '&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&#96;');
});
