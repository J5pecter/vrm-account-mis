// Backend API tests: backend/Code.gs executed in the local Apps Script emulator.
// Test IDs map to docs/05_QA_ACCEPTANCE.md. Environment label: LOCAL EMULATOR (not Google).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createBackend, createSeededBackend, login, provision, DEFAULT_USERS } from '../harness/gas-emulator.mjs';

const NOW = Date.parse('2026-11-17T06:00:00Z'); // 11:30 IST, 17 Nov 2026
const PW = Object.fromEntries(DEFAULT_USERS.map((u) => [u.name, u.password]));

function fresh(opts = {}) {
  const be = createSeededBackend({ now: NOW, ...opts });
  const t = {
    admin: login(be, 'Jayesh Mahajan', PW['Jayesh Mahajan']),
    lavina: login(be, 'Lavina Saldanha', PW['Lavina Saldanha']),
    parth: login(be, 'Parth Sharma', PW['Parth Sharma']),
    khushi: login(be, 'Khushi Dodiya', PW['Khushi Dodiya']),
    pavan: login(be, 'Pavan Soni', PW['Pavan Soni']),
    reviewer: login(be, 'Riya Reviewer', PW['Riya Reviewer'])
  };
  const data = be.call('getData', { token: t.admin }).data;
  const vrm = Object.fromEntries(data.vrms.map((v) => [v.name, v.id]));
  return { be, t, vrm };
}
const ok = (r) => { assert.equal(r.ok, true, JSON.stringify(r.error)); return r.data; };
const err = (r, code) => { assert.equal(r.ok, false, 'expected error ' + code); assert.equal(r.error.code, code, r.error.message); return r.error; };
const sheet = (be, name) => be.sheetRows(name).map((row) => Object.fromEntries(be.ctx.SCHEMA[name].map((h, i) => [h, row[i]])));
const activeEntries = (be) => sheet(be, 'Entries').filter((e) => e.status === 'active');
const audits = (be) => sheet(be, 'AuditEvents');
const countsTotal = (data) => data.counts.reduce((s, c) => s + c[2], 0);

/* ------------------------------------------------------------------ */
test('setup: schema, seed roster, aliases, idempotent re-run', () => {
  const be = createBackend({ now: NOW });
  be.run('setup');
  assert.equal(sheet(be, 'VRMs').length, 9);
  assert.equal(sheet(be, 'Aliases').length, 7);
  assert.ok(be.props.get('PASSWORD_PEPPER').length > 60);
  const pepper = be.props.get('PASSWORD_PEPPER');
  be.run('setup');
  assert.equal(sheet(be, 'VRMs').length, 9, 're-running setup must not duplicate the roster');
  assert.equal(be.props.get('PASSWORD_PEPPER'), pepper, 'pepper must not rotate silently');
});

test('setup refuses to touch a tab with an unexpected schema', () => {
  const be = createBackend({ now: NOW });
  const s = be.book.insertSheet('Entries');
  s.getRange(1, 1, 1, 3).setValues([['VRM', 'Date', 'Client Code']]);
  assert.throws(() => be.run('setup'), /unexpected schema/);
  assert.equal(s.getRange(1, 1, 1, 1).getValues()[0][0], 'VRM', 'legacy header left intact');
});

test('PBKDF2 implementation matches Node crypto.pbkdf2Sync', () => {
  const be = createBackend({ now: NOW });
  for (const [pw, salt, it] of [['pässwörd-ü', 'salt-1', 1], ['correct horse battery', 'abc123', 1000], ['x'.repeat(100), 's', 7]]) {
    assert.equal(be.ctx.pbkdf2Hex_(pw, salt, it), crypto.pbkdf2Sync(pw, salt, it, 32, 'sha256').toString('hex'));
  }
});

/* ------------------------------ Authentication ------------------------------ */
test('TC-001 member login returns member role and assigned VRM', () => {
  const { be, vrm } = fresh();
  const r = ok(be.call('login', { user: 'parth sharma', pw: PW['Parth Sharma'] }));
  assert.equal(r.me.role, 'member');
  assert.equal(r.me.assignedVrmId, vrm['Parth Sharma']);
  assert.ok(r.token.length >= 64);
  assert.ok(Date.parse(r.expiresAt) - NOW <= 12 * 3600e3);
});

test('TC-002 admin login returns admin role; admin+VRM keeps assignment', () => {
  const { be, vrm } = fresh();
  assert.equal(ok(be.call('login', { user: 'Jayesh Mahajan', pw: PW['Jayesh Mahajan'] })).me.role, 'admin');
  const l = ok(be.call('login', { user: 'Lavina Saldanha', pw: PW['Lavina Saldanha'], remember: true }));
  assert.equal(l.me.role, 'admin');
  assert.equal(l.me.assignedVrmId, vrm['Lavina Saldanha']);
  assert.ok(Date.parse(l.expiresAt) - NOW > 6 * 86400e3, 'remember-me session lasts days');
});

test('TC-003 wrong password rejected, no token, audited without the password', () => {
  const { be } = fresh();
  const e = err(be.call('login', { user: 'Parth Sharma', pw: 'definitely-wrong-pw' }), 'INVALID_CREDENTIALS');
  assert.equal(e.message, 'Name or password is incorrect.');
  const last = audits(be).filter((a) => a.action === 'login').pop();
  assert.equal(last.outcome, 'failure');
  assert.ok(!JSON.stringify(audits(be)).includes('definitely-wrong-pw'));
});

test('TC-004 admin name with a member password cannot impersonate', () => {
  const { be } = fresh();
  err(be.call('login', { user: 'Jayesh Mahajan', pw: PW['Parth Sharma'] }), 'INVALID_CREDENTIALS');
});

test('unknown user gets the same generic error and is throttled', () => {
  const { be } = fresh();
  for (let i = 0; i < 5; i++) err(be.call('login', { user: 'Nobody Here', pw: 'whatever-password' }), 'INVALID_CREDENTIALS');
  err(be.call('login', { user: 'Nobody Here', pw: 'whatever-password' }), 'ACCOUNT_LOCKED');
});

test('lockout after 5 failures, unlock after window or by admin', () => {
  const { be, t } = fresh();
  for (let i = 0; i < 4; i++) err(be.call('login', { user: 'Khushi Dodiya', pw: 'bad-password-123' }), 'INVALID_CREDENTIALS');
  err(be.call('login', { user: 'Khushi Dodiya', pw: 'bad-password-123' }), 'ACCOUNT_LOCKED');
  err(be.call('login', { user: 'Khushi Dodiya', pw: PW['Khushi Dodiya'] }), 'ACCOUNT_LOCKED');
  const users = ok(be.call('listUsers', { token: t.admin })).users;
  const k = users.find((u) => u.name === 'Khushi Dodiya');
  assert.equal(k.locked, true);
  ok(be.call('unlockUser', { token: t.admin, userId: k.id }));
  ok(be.call('login', { user: 'Khushi Dodiya', pw: PW['Khushi Dodiya'] }));
  for (let i = 0; i < 5; i++) be.call('login', { user: 'Khushi Dodiya', pw: 'bad-password-123' });
  be.advance(16 * 60e3);
  ok(be.call('login', { user: 'Khushi Dodiya', pw: PW['Khushi Dodiya'] }));
});

test('TC-005 revoked, expired, idle and malformed tokens are refused; no data changes', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('logout', { token: t.parth }));
  err(be.call('getData', { token: t.parth }), 'SESSION_REVOKED');
  err(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['RV1'] }), 'SESSION_REVOKED');
  err(be.call('getData', { token: 'x'.repeat(80) }), 'AUTH_REQUIRED');
  err(be.call('getData', {}), 'AUTH_REQUIRED');
  // idle timeout (2 h for standard sessions)
  be.advance(121 * 60e3);
  err(be.call('getData', { token: t.khushi }), 'SESSION_EXPIRED');
  // absolute expiry for remembered session
  const rem = ok(be.call('login', { user: 'Pavan Soni', pw: PW['Pavan Soni'], remember: true })).token;
  for (let h = 0; h < 7 * 24; h += 24) { be.advance(24 * 3600e3); be.call('getData', { token: rem }); }
  be.advance(3600e3);
  err(be.call('getData', { token: rem }), 'SESSION_EXPIRED');
  assert.equal(activeEntries(be).length, 0);
});

test('disabled (offboarded) account: sessions revoked immediately, login refused', () => {
  const { be, t } = fresh();
  const pavan = ok(be.call('listUsers', { token: t.admin })).users.find((u) => u.name === 'Pavan Soni');
  err(be.call('setUserActive', { token: t.admin, userId: pavan.id, active: false, requestId: 'r-dis-0001' }), 'VALIDATION'); // reason required
  ok(be.call('setUserActive', { token: t.admin, userId: pavan.id, active: false, reason: 'Left the desk', requestId: 'r-dis-0002' }));
  err(be.call('getData', { token: t.pavan }), 'SESSION_REVOKED');
  err(be.call('login', { user: 'Pavan Soni', pw: PW['Pavan Soni'] }), 'ACCOUNT_DISABLED');
  err(be.call('login', { user: 'Pavan Soni', pw: 'wrong-password-xx' }), 'INVALID_CREDENTIALS');
  ok(be.call('setUserActive', { token: t.admin, userId: pavan.id, active: true }));
  ok(be.call('login', { user: 'Pavan Soni', pw: PW['Pavan Soni'] }));
});

test('temporary password forces change before any data access', () => {
  const { be, t } = fresh();
  const created = ok(be.call('createUser', { token: t.admin, name: 'Manisha Mahante', role: 'member', assignedVrmId: ok(be.call('getData', { token: t.admin })).vrms.find((v) => v.name === 'Manisha Mahante').id, tempPassword: 'Temp-password-77' })).user;
  assert.equal(created.mustChangePassword, true);
  const tok = ok(be.call('login', { user: 'Manisha Mahante', pw: 'Temp-password-77' })).token;
  err(be.call('getData', { token: tok }), 'PASSWORD_CHANGE_REQUIRED');
  ok(be.call('whoami', { token: tok }));
  err(be.call('changePassword', { token: tok, currentPassword: 'Temp-password-77', newPassword: 'short' }), 'VALIDATION');
  err(be.call('changePassword', { token: tok, currentPassword: 'Temp-password-77', newPassword: 'Manisha Mahante' }), 'VALIDATION');
  err(be.call('changePassword', { token: tok, currentPassword: 'wrong-current-pw', newPassword: 'A-much-better-pw-1' }), 'INVALID_CREDENTIALS');
  ok(be.call('changePassword', { token: tok, currentPassword: 'Temp-password-77', newPassword: 'A-much-better-pw-1' }));
  ok(be.call('getData', { token: tok }));
});

test('duplicate user names and last-admin protections', () => {
  const { be, t } = fresh();
  err(be.call('createUser', { token: t.admin, name: 'parth  sharma', role: 'reviewer', tempPassword: 'Temp-password-77' }), 'CONFLICT');
  const users = ok(be.call('listUsers', { token: t.admin })).users;
  const lav = users.find((u) => u.name === 'Lavina Saldanha');
  const jay = users.find((u) => u.name === 'Jayesh Mahajan');
  err(be.call('setUserActive', { token: t.admin, userId: jay.id, active: false, reason: 'self test' }), 'CONFLICT');
  ok(be.call('setUserActive', { token: t.admin, userId: lav.id, active: false, reason: 'Leave of absence' }));
  err(be.call('updateUser', { token: t.admin, userId: jay.id, role: 'reviewer', assignedVrmId: '' }), 'CONFLICT');
});

/* ------------------------------ RBAC ------------------------------ */
test('TC-006 member cannot write for another VRM; denial audited; data unchanged', () => {
  const { be, t, vrm } = fresh();
  err(be.call('addEntries', { token: t.parth, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['X-5'] }), 'FORBIDDEN');
  err(be.call('submitZeroReport', { token: t.parth, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17' }), 'FORBIDDEN');
  assert.equal(activeEntries(be).length, 0);
  const denied = audits(be).filter((a) => a.outcome === 'denied');
  assert.ok(denied.some((a) => a.action === 'addEntries' && a.actor_name === 'Parth Sharma'));
});

test('TC-007 member and reviewer are refused every admin API by direct call', () => {
  const { be, t, vrm } = fresh();
  const admin = ['addVRM', 'renameVRM', 'archiveVRM', 'restoreVRM', 'correctEntry', 'softDeleteEntry', 'restoreEntry',
    'listAliases', 'addAlias', 'removeAlias', 'listUsers', 'createUser', 'updateUser', 'resetUserPassword', 'setUserActive',
    'unlockUser', 'integrityReport'];
  for (const action of admin) {
    for (const who of ['parth', 'reviewer']) {
      err(be.call(action, { token: t[who], name: 'Evil Name', vrmId: vrm['Parth Sharma'], entryId: 'x', userId: 'x', reason: 'because' }), 'FORBIDDEN');
    }
  }
  for (const action of ['getLogs', 'listImportBatches', 'getAdminOverview']) err(be.call(action, { token: t.parth }), 'FORBIDDEN');
  for (const action of ['addEntries', 'commitImport', 'submitZeroReport', 'previewImport']) err(be.call(action, { token: t.reviewer, vrmId: vrm['Parth Sharma'] }), 'FORBIDDEN');
  assert.equal(sheet(be, 'VRMs').length, 9);
});

test('TC-036 spoofed actor/role/ip fields in the body are ignored; actor comes from the session', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['SPOOF1'], by: 'Jayesh Mahajan', role: 'admin', ip: '1.2.3.4', actor: 'x' }));
  const e = activeEntries(be)[0];
  const users = ok(be.call('listUsers', { token: t.admin })).users;
  assert.equal(e.created_by, users.find((u) => u.name === 'Parth Sharma').id);
  const a = audits(be).filter((x) => x.action === 'addEntries').pop();
  assert.equal(a.actor_name, 'Parth Sharma');
  assert.equal(a.actor_role, 'member');
  assert.ok(!JSON.stringify(audits(be)).includes('1.2.3.4'));
  assert.ok(!JSON.stringify(audits(be)).includes('SPOOF1'), 'audit must not log raw code lists');
});

test('reviewer: read and export allowed, logs allowed, writes refused', () => {
  const { be, t } = fresh();
  ok(be.call('getData', { token: t.reviewer }));
  ok(be.call('getLogs', { token: t.reviewer }));
  ok(be.call('exportReport', { token: t.reviewer, filter: { year: '2026' } }));
  err(be.call('addVRM', { token: t.reviewer, name: 'New Person' }), 'FORBIDDEN');
});

/* ------------------------------ Manual entry ------------------------------ */
test('TC-008/009/010 one, many and mixed-delimiter codes', () => {
  const { be, t, vrm } = fresh();
  let r = ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['A1'] }));
  assert.equal(r.summary.added, 1);
  r = ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['B1', 'B2', 'B3'] }));
  assert.equal(r.summary.added, 3);
  assert.equal(activeEntries(be).length, 4);
});

test('TC-011 same code in one paste with case/space variation: one accepted', () => {
  const { be, t, vrm } = fresh();
  const r = ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['cl9', 'CL9', ' cl9 ', 'Cl9', 'CL9'] }));
  assert.deepEqual([r.summary.added, r.summary.duplicateInPaste], [1, 4]);
  assert.equal(activeEntries(be)[0].client_code_original, 'cl9', 'first original spelling is stored');
});

test('Unicode NFKC: full-width code is a duplicate of its ASCII form', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['CL100'] }));
  const r = ok(be.call('addEntries', { token: t.khushi, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['ＣＬ１００'] }));
  assert.equal(r.summary.duplicateExisting, 1);
});

test('TC-012 existing code under another VRM: zero added, owner unchanged, disclosure per config', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-16', codes: ['CL002'] }));
  const r = ok(be.call('addEntries', { token: t.khushi, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['cl002'] }));
  assert.equal(r.summary.added, 0);
  assert.equal(r.results[0].status, 'DUPLICATE_EXISTING');
  assert.equal(r.results[0].owner.vrmName, 'Parth Sharma');
  assert.equal(activeEntries(be)[0].vrm_id, vrm['Parth Sharma']);
  be.props.set('MEMBER_SEE_DUP_OWNER', 'false');
  const r2 = ok(be.call('addEntries', { token: t.khushi, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['CL002'] }));
  assert.equal(r2.results[0].owner, undefined, 'owner hidden when disclosure disabled');
});

test('TC-013 duplicate committed by a concurrent execution while waiting for the lock is caught', () => {
  const { be, t, vrm } = fresh();
  // Simulate another execution committing CONC-1 for Khushi between request receipt and lock grant.
  be.lock.onAcquire = () => {
    const s = be.book.getSheetByName('Entries');
    const cols = be.ctx.SCHEMA.Entries;
    const row = cols.map((h) => ({ id: 'other-exec', vrm_id: vrm['Khushi Dodiya'], activation_date: '2026-11-17',
      client_code_original: 'CONC-1', code_key: 'CONC-1', status: 'active', source: 'manual', created_at: new Date(NOW).toISOString() }[h] || ''));
    const r = s.getLastRow() + 1;
    s.getRange(r, 1, 1, cols.length).setNumberFormat('@');
    s.getRange(r, 1, 1, cols.length).setValues([row]);
  };
  const r = ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['conc-1', 'CONC-2'] }));
  assert.equal(r.summary.added, 1);
  assert.equal(r.summary.duplicateExisting, 1);
  assert.equal(activeEntries(be).filter((e) => e.code_key === 'CONC-1').length, 1);
});

test('TC-013b two users submitting the same codes back-to-back: exactly one owner per code', () => {
  const { be, t, vrm } = fresh();
  const codes = Array.from({ length: 50 }, (_, i) => 'RACE' + i);
  const a = ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes }));
  const b = ok(be.call('addEntries', { token: t.khushi, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes }));
  assert.equal(a.summary.added + b.summary.added, 50);
  const keys = activeEntries(be).map((e) => e.code_key);
  assert.equal(new Set(keys).size, keys.length);
});

test('lock contention returns BUSY and writes nothing', () => {
  const { be, t, vrm } = fresh();
  be.lock.busy = true;
  err(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['BUSY1'] }), 'BUSY');
  be.lock.busy = false;
  assert.equal(activeEntries(be).length, 0);
});

test('TC-014 leading zeros preserved as text end-to-end', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['000123', '0007'] }));
  const codes = activeEntries(be).map((e) => e.client_code_original);
  assert.deepEqual(codes.sort(), ['000123', '0007']);
  const q = ok(be.call('queryEntries', { token: t.admin }));
  assert.ok(q.items.some((i) => i.code === '000123'));
});

test('codes sent as JSON numbers are rejected per item (would have lost leading zeros)', () => {
  const { be, t, vrm } = fresh();
  const r = ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: [123, '0123'] }));
  assert.equal(r.results[0].status, 'INVALID');
  assert.equal(r.summary.added, 1);
});

test('invalid code shapes are rejected with reasons', () => {
  const { be, t, vrm } = fresh();
  const bad = ['', '   ', 'A B', 'x'.repeat(71), 'CL​1', 'CL\u00071', '=SUM(1)', '+1', '-1', '@x'];
  const r = ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: [...bad, 'x'.repeat(70)] }));
  assert.equal(r.summary.invalid, bad.length);
  assert.equal(r.summary.added, 1);
  assert.ok(r.results.every((x) => x.status !== 'INVALID' || x.reason));
});

test('CODE_PATTERN restricts codes to a business-approved format', () => {
  const { be, t, vrm } = fresh({ props: { CODE_PATTERN: '^[A-Z]{2}[0-9]{4,10}$' } });
  const r = ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['CL1234', 'cl1234x', '12345'] }));
  assert.deepEqual([r.summary.added, r.summary.invalid], [1, 2]);
});

test('batch size limits', () => {
  const { be, t, vrm } = fresh();
  err(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: [] }), 'VALIDATION');
  err(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: Array.from({ length: 1501 }, (_, i) => 'L' + i) }), 'VALIDATION');
  ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: Array.from({ length: 1500 }, (_, i) => 'L' + i) }));
});

/* ------------------------------ Dates & time zone ------------------------------ */
test('TC-015/016/017 leap years, invalid calendar dates and future dates', () => {
  const { be, t, vrm } = fresh();
  const add = (date, code) => be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date, codes: [code] });
  ok(add('2024-02-29', 'LEAP24'));
  err(add('2026-02-29', 'LEAP26'), 'VALIDATION');
  err(add('2026-11-31', 'NOV31'), 'VALIDATION');
  err(add('2026-13-01', 'M13'), 'VALIDATION');
  err(add('17/11/2026', 'DMY'), 'VALIDATION');
  err(add('2026-11-18', 'FUTURE'), 'VALIDATION');
  err(add('1999-12-31', 'OLD'), 'VALIDATION');
  ok(add('2025-12-31', 'DEC31'));
  ok(add('2026-01-01', 'JAN1'));
  assert.equal(activeEntries(be).length, 3);
});

test('TC-018 at 00:15 IST "today" is the new IST day although UTC is still yesterday', () => {
  const at0015 = Date.parse('2026-11-16T18:45:00Z'); // 2026-11-17 00:15 IST
  const { be, t, vrm } = fresh({ now: at0015 });
  const d = be.call('getData', { token: t.parth });
  assert.equal(d.today, '2026-11-17');
  ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['MIDNIGHT'] }));
  err(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-18', codes: ['TOMORROW'] }), 'VALIDATION');
  // 23:59 IST on the 16th is 18:29 UTC: 17th must be rejected as future.
  be.setNow(Date.parse('2026-11-16T18:29:00Z'));
  err(be.call('addEntries', { token: t.khushi, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['EARLY'] }), 'VALIDATION');
});

/* ------------------------------ Import ------------------------------ */
test('QA fixture: 3 accepted + 2 duplicates + 1 invalid = 6; replay accepts 0', () => {
  const { be, t, vrm } = fresh();
  const rows = [
    { row: 2, vrm: 'Parth Sharma', date: '2026-11-16', code: '000123' },
    { row: 3, vrm: 'Parth Sharma', date: '2026-11-16', code: 'CL002' },
    { row: 4, vrm: 'Khushi Dodiya', date: '2026-11-17', code: 'CL003' },
    { row: 5, vrm: 'Khushi Dodiya', date: '2026-11-17', code: 'cl003' },
    { row: 6, vrm: 'Pavan Soni', date: '2026-11-17', code: 'CL002' },
    { row: 7, vrm: 'Pavan Soni', date: '2026-11-32', code: 'CL004' }
  ];
  const r = ok(be.call('commitImport', { token: t.admin, batchId: 'batch-fixture-0001', chunkIndex: 0, chunkCount: 1, rows, fileName: 'fixture.csv', fileRows: 6 }));
  const s = r.summary;
  assert.deepEqual([s.accepted, s.duplicateInFile + s.duplicateExisting, s.invalid], [3, 2, 1]);
  assert.equal(s.accepted + s.duplicateInFile + s.duplicateExisting + s.invalid + s.unauthorized, 6);
  assert.equal(r.batch.status, 'completed');
  const data = ok(be.call('getData', { token: t.admin }));
  const per = (name) => data.counts.filter((c) => c[0] === vrm[name]).reduce((a, c) => a + c[2], 0);
  assert.deepEqual([per('Parth Sharma'), per('Khushi Dodiya'), per('Pavan Soni')], [2, 1, 0]);
  const again = ok(be.call('commitImport', { token: t.admin, batchId: 'batch-fixture-0002', chunkIndex: 0, chunkCount: 1, rows, fileName: 'fixture.csv', fileRows: 6 }));
  assert.equal(again.summary.accepted, 0);
  assert.equal(countsTotal(ok(be.call('getData', { token: t.admin }))), 3);
});

test('TC-019/021/022 structured import with aliases and existing duplicates reconciles', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Pavan Soni'], date: '2026-11-10', codes: ['OLD1'] }));
  const rows = [
    { row: 2, vrm: 'pavan lekhraj soni', date: '2026-11-15', code: 'N1' },
    { row: 3, vrm: 'SWARNAREKHA  DIVAKAR SHETTY', date: '2026-11-15', code: 'N2' },
    { row: 4, vrm: 'Pavan Soni', date: '2026-11-15', code: 'old1' }
  ];
  const p = ok(be.call('previewImport', { token: t.admin, rows }));
  assert.deepEqual(p.results.map((x) => x.status), ['ACCEPTED', 'ACCEPTED', 'DUPLICATE_EXISTING']);
  assert.equal(p.results[1].vrmName, 'Swarna Shetty');
  assert.equal(activeEntries(be).length, 1, 'preview writes nothing');
  const c = ok(be.call('commitImport', { token: t.admin, batchId: 'batch-alias-0001', chunkIndex: 0, chunkCount: 1, rows, fileRows: 3 }));
  assert.equal(c.summary.accepted, 2);
  assert.equal(sheet(be, 'VRMs').length, 9, 'aliases never create roster duplicates');
  const swarna = activeEntries(be).find((e) => e.code_key === 'N2');
  assert.equal(swarna.vrm_id, vrm['Swarna Shetty']);
  assert.equal(swarna.import_batch_id, 'batch-alias-0001');
});

test('TC-023 member import: foreign VRM and unknown VRM rows are rejected per row; no VRM created', () => {
  const { be, t } = fresh();
  const rows = [
    { row: 2, vrm: 'Parth Sharma', date: '2026-11-15', code: 'M1' },
    { row: 3, vrm: 'Khushi Dodiya', date: '2026-11-15', code: 'M2' },
    { row: 4, vrm: 'Totally New Person', date: '2026-11-15', code: 'M3' }
  ];
  const c = ok(be.call('commitImport', { token: t.parth, batchId: 'batch-member-0001', chunkIndex: 0, chunkCount: 1, rows }));
  assert.deepEqual(c.results.map((x) => x.status), ['ACCEPTED', 'UNAUTHORIZED_VRM', 'UNKNOWN_VRM']);
  assert.equal(c.results[2].canCreate, undefined);
  err(be.call('commitImport', { token: t.parth, batchId: 'batch-member-0002', chunkIndex: 0, chunkCount: 1, rows, approveNewVrms: ['Totally New Person'] }), 'FORBIDDEN');
  assert.equal(sheet(be, 'VRMs').length, 9);
});

test('admin-approved VRM creation during import', () => {
  const { be, t } = fresh();
  const rows = [{ row: 2, vrm: 'Neha Kulkarni', date: '2026-11-15', code: 'NEW1' }];
  const p = ok(be.call('previewImport', { token: t.admin, rows }));
  assert.equal(p.results[0].status, 'UNKNOWN_VRM');
  assert.deepEqual(p.newVrmNames, ['Neha Kulkarni']);
  const without = ok(be.call('commitImport', { token: t.admin, batchId: 'batch-newvrm-0001', chunkIndex: 0, chunkCount: 1, rows }));
  assert.equal(without.summary.accepted, 0, 'unknown VRM is never auto-created');
  const c = ok(be.call('commitImport', { token: t.admin, batchId: 'batch-newvrm-0002', chunkIndex: 0, chunkCount: 1, rows, approveNewVrms: ['Neha Kulkarni'] }));
  assert.equal(c.summary.accepted, 1);
  assert.deepEqual(c.createdVrms, ['Neha Kulkarni']);
  assert.equal(c.batch.createdVrms, 1);
});

test('TC-024 malformed and ambiguous dates are flagged, never defaulted', () => {
  const { be, t } = fresh();
  const rows = ['2026-11-32', '16/11/2026', '', '2026-02-29', '2027-01-01'].map((d, i) => ({ row: i + 2, vrm: 'Parth Sharma', date: d, code: 'D' + i }));
  const r = ok(be.call('previewImport', { token: t.admin, rows }));
  assert.deepEqual(r.results.map((x) => x.status), ['INVALID_DATE', 'INVALID_DATE', 'INVALID_DATE', 'INVALID_DATE', 'FUTURE_DATE']);
});

test('chunked import: cross-chunk duplicates, batch register, idempotent replay, re-send refused, cancel', () => {
  const { be, t } = fresh();
  const mk = (from, n, dupOf) => Array.from({ length: n }, (_, i) => ({ row: from + i, vrm: 'Parth Sharma', date: '2026-11-14', code: 'CH' + (from + i) }))
    .concat(dupOf ? [{ row: from + n, vrm: 'Parth Sharma', date: '2026-11-14', code: dupOf }] : []);
  const c0 = ok(be.call('commitImport', { token: t.parth, batchId: 'batch-chunk-0001', chunkIndex: 0, chunkCount: 2, rows: mk(2, 10), fileRows: 22, clientRejected: 1, requestId: 'batch-chunk-0001:0' }));
  assert.equal(c0.batch.status, 'in_progress');
  const st = ok(be.call('getImportStatus', { token: t.parth, batchId: 'batch-chunk-0001' })).batch;
  assert.deepEqual(st.chunksCommitted, [0]);
  const c1 = ok(be.call('commitImport', { token: t.parth, batchId: 'batch-chunk-0001', chunkIndex: 1, chunkCount: 2, rows: mk(12, 10, 'ch2'), requestId: 'batch-chunk-0001:1' }));
  assert.equal(c1.summary.duplicateInFile, 1, 'code from chunk 0 repeated in chunk 1 is a duplicate within the file');
  assert.equal(c1.batch.status, 'completed');
  const b = c1.batch;
  assert.equal(b.received, 21);
  assert.equal(b.fileRows, b.clientRejected + b.received, 'file rows = rejected before upload + received');
  assert.equal(b.received, b.accepted + b.duplicateInFile + b.duplicateExisting + b.invalid + b.unauthorized + b.failed);
  // Network retry of chunk 1 with the same requestId: replayed, nothing written twice.
  const replay = ok(be.call('commitImport', { token: t.parth, batchId: 'batch-chunk-0001', chunkIndex: 1, chunkCount: 2, rows: mk(12, 10, 'ch2'), requestId: 'batch-chunk-0001:1' }));
  assert.equal(replay.replayed, true);
  assert.equal(activeEntries(be).length, 20);
  err(be.call('commitImport', { token: t.parth, batchId: 'batch-chunk-0001', chunkIndex: 1, chunkCount: 2, rows: mk(12, 10), requestId: 'batch-chunk-0001:1-new' }), 'CONFLICT');
  // Cancel a different in-progress batch.
  ok(be.call('commitImport', { token: t.parth, batchId: 'batch-chunk-0002', chunkIndex: 0, chunkCount: 3, rows: mk(100, 2) }));
  const cancelled = ok(be.call('cancelImport', { token: t.parth, batchId: 'batch-chunk-0002' })).batch;
  assert.equal(cancelled.status, 'cancelled');
  err(be.call('commitImport', { token: t.parth, batchId: 'batch-chunk-0002', chunkIndex: 1, chunkCount: 3, rows: mk(200, 2) }), 'CONFLICT');
  err(be.call('getImportStatus', { token: t.khushi, batchId: 'batch-chunk-0001' }), 'FORBIDDEN');
});

test('oversized import request is refused', () => {
  const { be, t } = fresh();
  const rows = Array.from({ length: 1501 }, (_, i) => ({ row: i + 2, vrm: 'Parth Sharma', date: '2026-11-14', code: 'Z' + i }));
  err(be.call('previewImport', { token: t.admin, rows }), 'PAYLOAD_TOO_LARGE');
});

/* ------------------------------ Idempotency & recovery ------------------------------ */
test('retry after a lost response returns the stored result and writes nothing twice', () => {
  const { be, t, vrm } = fresh();
  const body = { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['IDEM1', 'IDEM2'], requestId: 'client-retry-0001' };
  const a = ok(be.call('addEntries', body));
  const b = ok(be.call('addEntries', body));
  assert.equal(a.summary.added, 2);
  assert.equal(b.replayed, true);
  assert.equal(b.summary.added, 2);
  assert.equal(activeEntries(be).length, 2);
  err(be.call('addEntries', { ...body, token: t.admin }), 'CONFLICT');
});

test('crash after rows were written but before the response: retry reports recovered rows, no duplicates', () => {
  const { be, t, vrm } = fresh();
  const realAudit = be.ctx.audit_;
  let armed = true;
  be.ctx.audit_ = function (...args) {
    if (armed && args[1] === 'addEntries') { armed = false; throw new Error('simulated timeout after write'); }
    return realAudit.apply(this, args);
  };
  const body = { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['CRASH1', 'CRASH2'], requestId: 'client-crash-0001' };
  err(be.call('addEntries', body), 'INTERNAL');
  assert.equal(activeEntries(be).length, 2, 'rows were persisted before the failure');
  const retry = ok(be.call('addEntries', body));
  assert.equal(retry.summary.added, 2);
  assert.equal(retry.summary.recovered, 2);
  assert.equal(activeEntries(be).length, 2);
  be.ctx.audit_ = realAudit;
  assert.ok(be.errors.some((e) => e.includes('simulated timeout')), 'internal error logged server-side');
});

test('mutations without a requestId are refused', () => {
  const { be, t, vrm } = fresh();
  const r = be.raw(JSON.stringify({ action: 'addEntries', token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['NOID'] }));
  err(r, 'BAD_REQUEST');
});

/* ------------------------------ Reporting ------------------------------ */
test('TC-025/029 team total equals sum of VRMs equals distinct active codes', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['P1', 'P2', 'P3'] }));
  ok(be.call('addEntries', { token: t.khushi, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['K1', 'P1'] }));
  const d = ok(be.call('getData', { token: t.admin }));
  const per = {};
  d.counts.forEach(([v, , n]) => { per[v] = (per[v] || 0) + n; });
  assert.equal(Object.values(per).reduce((a, b) => a + b, 0), new Set(activeEntries(be).map((e) => e.code_key)).size);
  assert.equal(d.totals.activeEntries, 4);
  const integ = ok(be.call('integrityReport', { token: t.admin }));
  assert.equal(integ.ok, true);
  assert.equal(integ.teamEqualsSumOfVrms, true);
});

test('TC-026/027/028/030 export filters: month, whole year, inclusive range, single VRM, reversed range', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Parth Sharma'], date: '2026-10-31', codes: ['E1'] }));
  ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Parth Sharma'], date: '2026-11-01', codes: ['E2'] }));
  ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['E3'] }));
  ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Khushi Dodiya'], date: '2025-12-31', codes: ['E4'] }));
  const exp = (filter) => ok(be.call('exportReport', { token: t.admin, filter }));
  assert.equal(exp({ year: '2026', month: '11' }).total, 2);
  assert.equal(exp({ year: '2026' }).total, 3);
  assert.equal(exp({ year: '2025' }).total, 1);
  const range = exp({ year: '2025', from: '2026-10-31', to: '2026-11-01' });
  assert.equal(range.total, 2, 'endpoints inclusive and range overrides year');
  assert.equal(range.period.kind, 'range');
  const single = exp({ from: '2026-01-01', to: '2026-11-17', vrmId: vrm['Khushi Dodiya'] });
  assert.equal(single.total, 1);
  assert.equal(single.detail.length, single.summary.reduce((s, x) => s + x.count, 0));
  assert.deepEqual(single.summary.map((x) => x.vrmName), ['Khushi Dodiya']);
  err(be.call('exportReport', { token: t.admin, filter: { from: '2026-11-02', to: '2026-11-01' } }), 'VALIDATION');
  assert.equal(exp({ allTime: true }).total, 4);
  const team = exp({ year: '2026' });
  assert.ok(team.summary.some((s) => s.count === 0), 'zero performers listed');
  assert.ok(audits(be).some((a) => a.action === 'exportReport'));
});

test('TC-032 rename keeps the stable id and history; old spelling becomes an alias', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.khushi, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['R1'] }));
  err(be.call('renameVRM', { token: t.admin, vrmId: vrm['Khushi Dodiya'], newName: 'Parth Sharma' }), 'CONFLICT');
  err(be.call('renameVRM', { token: t.admin, vrmId: vrm['Khushi Dodiya'], newName: 'pavan lekhraj soni' }), 'CONFLICT');
  const r = ok(be.call('renameVRM', { token: t.admin, vrmId: vrm['Khushi Dodiya'], newName: 'Khushi M Dodiya' }));
  assert.equal(r.vrm.id, vrm['Khushi Dodiya']);
  const e = ok(be.call('queryEntries', { token: t.admin })).items[0];
  assert.equal(e.vrmName, 'Khushi M Dodiya');
  // Old name and earlier alias both still resolve.
  const p = ok(be.call('previewImport', { token: t.admin, rows: [{ row: 2, vrm: 'Khushi Dodiya', date: '2026-11-17', code: 'R2' }, { row: 3, vrm: 'khushi mahesh dodiya', date: '2026-11-17', code: 'R3' }] }));
  assert.deepEqual(p.results.map((x) => x.vrmName), ['Khushi M Dodiya', 'Khushi M Dodiya']);
  // Member session still bound by id.
  ok(be.call('addEntries', { token: t.khushi, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['R4'] }));
});

test('TC-033 no destructive VRM delete; archive keeps history in team totals', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Riddhi Mistry'], date: '2026-11-17', codes: ['H1'] }));
  err(be.call('deleteVRM', { token: t.admin, name: 'Riddhi Mistry' }), 'CLIENT_UPGRADE_REQUIRED');
  err(be.call('archiveVRM', { token: t.admin, vrmId: vrm['Parth Sharma'], reason: 'test archive' }), 'CONFLICT'); // active user linked
  ok(be.call('archiveVRM', { token: t.admin, vrmId: vrm['Riddhi Mistry'], reason: 'Moved to another desk' }));
  const d = ok(be.call('getData', { token: t.admin }));
  assert.equal(d.vrms.find((v) => v.id === vrm['Riddhi Mistry']).status, 'archived');
  assert.equal(countsTotal(d), 1, 'archived VRM history still counts');
  err(be.call('addEntries', { token: t.admin, vrmId: vrm['Riddhi Mistry'], date: '2026-11-17', codes: ['H2'] }), 'CONFLICT');
  err(be.call('addVRM', { token: t.admin, name: 'riddhi mistry' }), 'CONFLICT');
  ok(be.call('restoreVRM', { token: t.admin, vrmId: vrm['Riddhi Mistry'] }));
  ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Riddhi Mistry'], date: '2026-11-17', codes: ['H2'] }));
});

test('TC-034/035 soft delete excludes from metrics, keeps tombstone; re-add blocked; restore', () => {
  const { be, t, vrm } = fresh();
  const added = ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['DEL1'] }));
  const id = added.results[0].entryId;
  err(be.call('softDeleteEntry', { token: t.admin, entryId: id }), 'VALIDATION');
  ok(be.call('softDeleteEntry', { token: t.admin, entryId: id, reason: 'Entered by mistake' }));
  assert.equal(countsTotal(ok(be.call('getData', { token: t.admin }))), 0);
  assert.equal(sheet(be, 'Entries').length, 1, 'tombstone kept');
  err(be.call('softDeleteEntry', { token: t.admin, entryId: id, reason: 'again' }), 'CONFLICT');
  err(be.call('correctEntry', { token: t.admin, entryId: id, date: '2026-11-16', reason: 'fix date' }), 'CONFLICT');
  const re = ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['del1'] }));
  assert.equal(re.results[0].status, 'DUPLICATE_EXISTING');
  assert.match(re.results[0].reason, /deleted/);
  err(be.call('queryEntries', { token: t.parth, status: 'deleted' }), 'FORBIDDEN');
  assert.equal(ok(be.call('queryEntries', { token: t.admin, status: 'deleted' })).total, 1);
  ok(be.call('restoreEntry', { token: t.admin, entryId: id, reason: 'Deleted wrongly' }));
  assert.equal(countsTotal(ok(be.call('getData', { token: t.admin }))), 1);
  assert.equal(sheet(be, 'Entries').length, 1, 'restore never creates a second record');
});

test('admin correction keeps the entry id and records before/after', () => {
  const { be, t, vrm } = fresh();
  const id = ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['FIX1'] })).results[0].entryId;
  err(be.call('correctEntry', { token: t.admin, entryId: id, reason: 'nothing' }), 'VALIDATION');
  err(be.call('correctEntry', { token: t.admin, entryId: id, date: '2026-11-18', reason: 'future' }), 'VALIDATION');
  const r = ok(be.call('correctEntry', { token: t.admin, entryId: id, vrmId: vrm['Khushi Dodiya'], date: '2026-11-15', reason: 'Wrong VRM and date' }));
  assert.equal(r.entry.id, id);
  assert.equal(r.entry.vrmName, 'Khushi Dodiya');
  assert.equal(r.entry.backdated, true);
  const a = audits(be).filter((x) => x.action === 'correctEntry').pop();
  assert.deepEqual(JSON.parse(a.before), { vrmId: vrm['Parth Sharma'], date: '2026-11-17' });
  assert.deepEqual(JSON.parse(a.after), { vrmId: vrm['Khushi Dodiya'], date: '2026-11-15' });
  const ov = ok(be.call('getAdminOverview', { token: t.admin }));
  assert.equal(ov.corrections.length, 1);
  assert.ok(ov.backdated.some((b) => b.vrmName === 'Khushi Dodiya'));
});

/* ------------------------------ Zero reports ------------------------------ */
test('zero report: confirmed zero distinct from not reported; never adds an activation', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('submitZeroReport', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17' }));
  const again = ok(be.call('submitZeroReport', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17' }));
  assert.equal(again.alreadyReported, true);
  const d = ok(be.call('getData', { token: t.admin }));
  assert.deepEqual(d.zeroReports, [[vrm['Parth Sharma'], '2026-11-17']]);
  assert.equal(countsTotal(d), 0);
  ok(be.call('addEntries', { token: t.khushi, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['Z1'] }));
  err(be.call('submitZeroReport', { token: t.khushi, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17' }), 'CONFLICT');
  err(be.call('submitZeroReport', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-18' }), 'VALIDATION');
  ok(be.call('withdrawZeroReport', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17' }));
  assert.deepEqual(ok(be.call('getData', { token: t.admin })).zeroReports, []);
});

/* ------------------------------ Scope & disclosure ------------------------------ */
test('MEMBER_SCOPE=own limits members to their own VRM everywhere', () => {
  const { be, t, vrm } = fresh({ props: { MEMBER_SCOPE: 'own' } });
  ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['OWN1'] }));
  ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['OWN2'] }));
  const d = ok(be.call('getData', { token: t.parth }));
  assert.deepEqual(d.vrms.map((v) => v.name), ['Parth Sharma']);
  assert.equal(countsTotal(d), 1);
  assert.equal(ok(be.call('queryEntries', { token: t.parth })).total, 1);
  const l = ok(be.call('lookupCodes', { token: t.parth, codes: ['OWN1', 'OWN2', 'NEW9'] }));
  assert.deepEqual(l.results.map((x) => x.status), ['taken', 'taken', 'available']);
  assert.equal(l.results[0].owner, undefined, 'foreign owner hidden');
  assert.equal(l.results[1].owner.vrmName, 'Parth Sharma');
  err(be.call('exportReport', { token: t.parth, filter: { year: '2026', vrmId: vrm['Khushi Dodiya'] } }), 'FORBIDDEN');
  assert.equal(ok(be.call('exportReport', { token: t.parth, filter: { year: '2026' } })).total, 1);
});

test('lookup: available / taken / reserved / repeated / invalid', () => {
  const { be, t, vrm } = fresh();
  const ids = ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['LK1', 'LK2'] })).results;
  ok(be.call('softDeleteEntry', { token: t.admin, entryId: ids[1].entryId, reason: 'test reserve' }));
  const r = ok(be.call('lookupCodes', { token: t.khushi, codes: ['lk1', 'LK2', 'LK3', 'LK3', 'a b'] }));
  assert.deepEqual(r.results.map((x) => x.status), ['taken', 'reserved', 'available', 'repeated', 'invalid']);
  assert.equal(r.results[0].entryId, undefined, 'members do not get foreign entry ids');
});

test('queryEntries pagination, sorting, filters and validation', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Parth Sharma'], date: '2026-11-01', codes: Array.from({ length: 30 }, (_, i) => 'Q' + String(i).padStart(2, '0')) }));
  ok(be.call('addEntries', { token: t.admin, vrmId: vrm['Khushi Dodiya'], date: '2026-11-02', codes: ['QK1'] }));
  const p1 = ok(be.call('queryEntries', { token: t.admin, pageSize: 20, sort: 'code', dir: 'asc' }));
  assert.equal(p1.total, 31);
  assert.equal(p1.pages, 2);
  assert.equal(p1.items[0].code, 'Q00');
  assert.equal(ok(be.call('queryEntries', { token: t.admin, pageSize: 20, page: 2 })).items.length, 11);
  assert.equal(ok(be.call('queryEntries', { token: t.admin, q: 'qk' })).total, 1);
  assert.equal(ok(be.call('queryEntries', { token: t.admin, vrmId: vrm['Khushi Dodiya'] })).total, 1);
  assert.equal(ok(be.call('queryEntries', { token: t.admin, from: '2026-11-02', to: '2026-11-02' })).total, 1);
  err(be.call('queryEntries', { token: t.admin, from: '2026-11-03', to: '2026-11-01' }), 'VALIDATION');
  err(be.call('queryEntries', { token: t.admin, sort: 'evil' }), 'VALIDATION');
});

/* ------------------------------ Roster / aliases ------------------------------ */
test('alias management and collisions', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addAlias', { token: t.admin, alias: 'P. Sharma', vrmId: vrm['Parth Sharma'] }));
  assert.equal(ok(be.call('addAlias', { token: t.admin, alias: 'p. sharma', vrmId: vrm['Parth Sharma'] })).alreadyExists, true);
  err(be.call('addAlias', { token: t.admin, alias: 'P. Sharma', vrmId: vrm['Pavan Soni'] }), 'CONFLICT');
  err(be.call('addAlias', { token: t.admin, alias: 'Pavan Soni', vrmId: vrm['Parth Sharma'] }), 'CONFLICT');
  err(be.call('addAlias', { token: t.admin, alias: '=HYPERLINK("x")', vrmId: vrm['Parth Sharma'] }), 'VALIDATION');
  err(be.call('addVRM', { token: t.admin, name: 'P. Sharma' }), 'CONFLICT');
  ok(be.call('removeAlias', { token: t.admin, aliasKey: 'p. sharma' }));
  err(be.call('removeAlias', { token: t.admin, aliasKey: 'p. sharma' }), 'NOT_FOUND');
  assert.ok(ok(be.call('listAliases', { token: t.admin })).aliases.every((a) => a.vrmName));
});

test('VRM name validation blocks markup and formulas', () => {
  const { be, t } = fresh();
  for (const name of ['<script>alert(1)</script>', '=1+1', 'A', 'x'.repeat(101), 'Name1']) err(be.call('addVRM', { token: t.admin, name }), 'VALIDATION');
  assert.equal(ok(be.call('addVRM', { token: t.admin, name: "  Neha   D'Souza-Rao " })).vrm.name, "Neha D'Souza-Rao");
});

/* ------------------------------ Protocol & privacy ------------------------------ */
test('protocol errors: missing body, malformed JSON, unknown action, legacy client, oversize', () => {
  const { be } = fresh();
  assert.equal(JSON.parse(be.ctx.doPost({}).payload).error.code, 'BAD_REQUEST');
  err(be.raw('{not json'), 'BAD_REQUEST');
  err(be.raw('[1,2]'), 'BAD_REQUEST');
  err(be.call('dropTables', {}), 'UNKNOWN_ACTION');
  err(be.call('getData', { pw: 'old-shared-password' }), 'CLIENT_UPGRADE_REQUIRED');
  err(be.call('getVrms', {}), 'CLIENT_UPGRADE_REQUIRED');
  err(be.call('login', { pw: 'old-shared-password' }), 'CLIENT_UPGRADE_REQUIRED');
  err(be.raw('"' + 'x'.repeat(3000001) + '"'), 'PAYLOAD_TOO_LARGE');
  const h = JSON.parse(be.ctx.doGet({}).payload);
  assert.equal(h.ok, true);
  assert.equal(h.data.configured, true);
  assert.deepEqual(Object.keys(h.data).sort(), ['apiVersion', 'configured', 'service', 'version']);
});

test('internal errors return a reference, never a stack trace or secrets', () => {
  const { be, t } = fresh();
  const real = be.ctx.snapshot_;
  be.ctx.snapshot_ = () => { throw new Error('boom at /secret/path ' + be.props.get('PASSWORD_PEPPER')); };
  const r = be.call('getData', { token: t.admin });
  be.ctx.snapshot_ = real;
  assert.equal(r.error.code, 'INTERNAL');
  assert.match(r.error.message, /Reference/);
  assert.ok(!JSON.stringify(r).includes('boom'));
  assert.ok(!JSON.stringify(r).includes(be.props.get('PASSWORD_PEPPER')));
});

test('TC-037 responses never contain hashes, salts, peppers or other users\' tokens', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['PRIV1'] }));
  const secrets = [be.props.get('PASSWORD_PEPPER'), ...sheet(be, 'Users').flatMap((u) => [u.salt, u.password_hash]), ...sheet(be, 'Sessions').map((s) => s.token_hash)];
  const responses = ['getData', 'listUsers', 'getLogs', 'getAdminOverview', 'queryEntries', 'integrityReport', 'listAliases', 'listImportBatches']
    .map((a) => JSON.stringify(be.call(a, { token: t.admin })));
  responses.push(JSON.stringify(be.call('getLoginBootstrap', {})));
  for (const s of secrets) for (const r of responses) assert.ok(!r.includes(s), 'secret leaked');
  for (const tok of Object.values(t)) assert.ok(!JSON.stringify(sheet(be, 'Sessions')).includes(tok), 'raw token stored');
  assert.ok(!JSON.stringify(sheet(be, 'AuditEvents')).includes('Member-pass'), 'password in audit');
});

test('login bootstrap discloses the roster only when explicitly enabled', () => {
  const { be } = fresh();
  assert.deepEqual(ok(be.call('getLoginBootstrap', {})).names, undefined);
  be.props.set('PUBLIC_LOGIN_ROSTER', 'true');
  const names = ok(be.call('getLoginBootstrap', {})).names;
  assert.ok(names.includes('Parth Sharma'));
});

test('activity log: filters by actor, action, outcome and IST date; paginates', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['LOG1'] }));
  be.call('addEntries', { token: t.parth, vrmId: vrm['Khushi Dodiya'], date: '2026-11-17', codes: ['LOG2'] });
  const all = ok(be.call('getLogs', { token: t.admin, pageSize: 5 }));
  assert.ok(all.total > 5);
  assert.equal(all.items.length, 5);
  assert.ok(all.items[0].time >= all.items[1].time, 'newest first');
  const parthId = all.actors.find((a) => a.name === 'Parth Sharma').id;
  const mine = ok(be.call('getLogs', { token: t.admin, actorId: parthId, eventAction: 'addEntries' }));
  assert.deepEqual(mine.items.map((i) => i.outcome).sort(), ['denied', 'success']);
  assert.equal(ok(be.call('getLogs', { token: t.admin, outcome: 'denied' })).items.every((i) => i.outcome === 'denied'), true);
  assert.equal(ok(be.call('getLogs', { token: t.admin, from: '2026-11-18' })).total, 0);
  assert.ok(ok(be.call('getLogs', { token: t.admin, from: '2026-11-17', to: '2026-11-17' })).total > 0);
});

test('maintenance prunes expired sessions and old idempotency rows only', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['KEEP1'] }));
  const before = sheet(be, 'Sessions').length;
  be.advance(40 * 86400e3);
  be.run('maintenance');
  assert.ok(sheet(be, 'Sessions').length < before);
  assert.equal(sheet(be, 'IdempotencyRequests').length, 0);
  assert.equal(sheet(be, 'Entries').length, 1, 'business data untouched');
  assert.ok(sheet(be, 'AuditEvents').length > 0, 'audit untouched');
});

test('emulator invariants: no formula writes and no numeric coercion across a full workflow', () => {
  const { be, t, vrm } = fresh();
  ok(be.call('addEntries', { token: t.parth, vrmId: vrm['Parth Sharma'], date: '2026-11-17', codes: ['00001', '42', '3.14'] }));
  ok(be.call('commitImport', { token: t.admin, batchId: 'batch-inv-0001', chunkIndex: 0, chunkCount: 1, rows: [{ row: 2, vrm: 'Pavan Soni', date: '2026-11-17', code: '0099' }], fileName: '=evil.csv' }));
  ok(be.call('softDeleteEntry', { token: t.admin, entryId: ok(be.call('queryEntries', { token: t.admin, q: '42' })).items[0].id, reason: '=cmd|calc' }));
  assert.equal(be.book.stats.formulaWrites, 0);
  assert.deepEqual(be.book.stats.numericCoercions, []);
  assert.ok(sheet(be, 'Entries').some((e) => e.client_code_original === '00001'));
});
