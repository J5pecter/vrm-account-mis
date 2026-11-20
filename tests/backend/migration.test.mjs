// Migration rehearsal + backup/restore drill in the LOCAL EMULATOR with synthetic (fictional) legacy data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMigration } from '../../scripts/migrate-legacy.mjs';
import { reconcile } from '../../scripts/reconcile.mjs';
import { createSeededBackend, createBackend, login } from '../harness/gas-emulator.mjs';

const NOW = Date.parse('2026-11-17T06:00:00Z');
const ADMIN = { name: 'Jayesh Mahajan', role: 'admin', vrm: '', password: 'Admin-pass-0001!' };

function legacyCsv() {
  const names = ['Parth Sharma', 'parth sharma vijay', 'Khushi Dodiya', 'KHUSHI MAHESH DODIYA', 'Pavan Soni', 'swarnarekha shetty', 'Riddhi Mistry'];
  const lines = ['VRM,Date,Client Code'];
  let seed = 3;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 3200; i++) {
    const d = new Date(Date.UTC(2025, 0, 1) + rnd(680) * 86400000).toISOString().slice(0, 10);
    const date = i % 3 === 0 ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : d;
    lines.push(`${names[rnd(names.length)]},${date},${'0'.repeat(rnd(3))}LG${rnd(3000)}`);
  }
  lines.push('Pavan Soni,2026-02-30,BADDATE1', 'Pavan Soni,2026-12-31,FUTURE1', 'Pavan Soni,2026-01-05,bad code', ',2026-01-05,NOVRM1', '', 'Parth Sharma,25/12/2025,XMAS1');
  return lines.join('\r\n');
}

test('legacy migration rehearsal: baseline -> chunked import -> export reconciles exactly', () => {
  const prep = prepareMigration(legacyCsv(), { asOf: '2026-11-17' });
  const b = prep.baseline;
  assert.equal(b.check.cleanPlusExceptionsEqualsSource, true);
  assert.equal(b.check.cleanCodesUnique, true);
  assert.equal(b.dateOrder, 'dmy');
  assert.ok(b.exceptionsByStatus.DUPLICATE_IN_FILE > 0);
  assert.equal(b.exceptionsByStatus.FUTURE_DATE, 1);
  assert.equal(b.exceptionsByStatus.MISSING_VRM, 1);
  assert.ok(b.aliasResolutions > 0);
  assert.ok(prep.clean.some((r) => r.code.startsWith('00')), 'leading zeros preserved');

  const be = createSeededBackend({ now: NOW, users: [ADMIN] });
  const tok = login(be, ADMIN.name, ADMIN.password);
  // Riddhi Mistry is on the roster; all clean names resolve without creating VRMs.
  const chunks = [];
  for (let i = 0; i < prep.clean.length; i += 1500) chunks.push(prep.clean.slice(i, i + 1500));
  let accepted = 0;
  chunks.forEach((ch, i) => {
    const r = be.call('commitImport', { token: tok, batchId: 'migration-rehearsal-01', chunkIndex: i, chunkCount: chunks.length, requestId: 'migration-rehearsal-01:' + i,
      rows: ch.map((x) => ({ row: x.row, vrm: x.vrm, date: x.date, code: x.code })), fileName: 'legacy-export.csv', fileRows: b.sourceDataRows, clientRejected: b.exceptionRows });
    assert.equal(r.ok, true, JSON.stringify(r.error));
    accepted += r.data.summary.accepted;
  });
  assert.equal(accepted, prep.clean.length);
  const exp = be.call('exportReport', { token: tok, filter: { allTime: true } }).data;
  const actual = exp.detail.map((d) => ({ vrm: d.vrmName, date: d.date, key: d.code.normalize('NFKC').toUpperCase() }));
  const expected = prep.clean.map((r) => ({ vrm: r.vrm, date: r.date, key: r.key }));
  const rec = reconcile(expected, actual);
  assert.equal(rec.pass, true, JSON.stringify(rec.differences).slice(0, 500));
  // per-VRM totals in the new system equal the baseline
  const per = Object.fromEntries(exp.summary.filter((s) => s.count).map((s) => [s.vrmName, s.count]));
  assert.deepEqual(per, b.perVrm);
  assert.equal(be.call('integrityReport', { token: tok }).data.ok, true);

  // The reconciler must detect a missing row and a mis-attributed row.
  const broken = actual.slice(1).map((r, i) => (i === 0 ? { ...r, vrm: 'Pavan Soni' } : r));
  const bad = reconcile(expected, broken);
  assert.equal(bad.pass, false);
  assert.equal(bad.missingInActual.length, 1);
  assert.ok(bad.differences.perVrm.length > 0);
});

test('backup and restore drill (emulator): restored copy reconciles with the pre-incident state', () => {
  const be = createSeededBackend({ now: NOW, users: [ADMIN] });
  const tok = login(be, ADMIN.name, ADMIN.password);
  const vrms = be.call('getData', { token: tok }).data.vrms;
  be.call('addEntries', { token: tok, vrmId: vrms[0].id, date: '2026-11-10', codes: ['BK1', 'BK2', '0BK3'] });
  const before = be.call('integrityReport', { token: tok }).data;
  const backup = JSON.stringify(be.book.toJSON()); // equivalent of backupNow(): a full copy of every tab
  // incident: rows soft-deleted by mistake
  const q = be.call('queryEntries', { token: tok }).data.items;
  q.forEach((e) => be.call('softDeleteEntry', { token: tok, entryId: e.id, reason: 'simulated incident' }));
  assert.equal(be.call('integrityReport', { token: tok }).data.active, 0);
  // restore into a separate "restore test" environment, as the runbook requires
  const restored = createBackend({ now: NOW, props: Object.fromEntries(be.props) });
  const saved = JSON.parse(backup);
  for (const name of Object.keys(saved)) {
    const s = restored.book.insertSheet(name);
    s.cells = saved[name].map((row) => row.map(([v, f]) => ({ v, f })));
  }
  const rtok = login(restored, ADMIN.name, ADMIN.password);
  const after = restored.call('integrityReport', { token: rtok }).data;
  assert.equal(after.ok, true);
  assert.deepEqual([after.active, after.deleted, after.distinctCodeKeys], [before.active, before.deleted, before.distinctCodeKeys]);
  assert.deepEqual(after.perVrm, before.perVrm);
  assert.ok(restored.call('queryEntries', { token: rtok, q: '0BK3' }).data.total === 1, 'leading zero survives restore');
});
