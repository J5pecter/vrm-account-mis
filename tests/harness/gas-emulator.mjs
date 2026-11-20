// Local Google Apps Script emulator used by backend tests and the local staging server.
// It executes backend/Code.gs unmodified inside a Node VM with strict mocks of the Apps Script
// services the backend uses. It is NOT Google: quotas, latency, real LockService concurrency and
// ContentService redirects are only approximated. Results from it are labelled "local emulator".
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CODE_PATH = path.resolve(here, '../../backend/Code.gs');

const toSigned = (buf) => Array.from(buf, (v) => (v > 127 ? v - 256 : v));
const toBuf = (v) => (typeof v === 'string' ? Buffer.from(v, 'utf8') : Buffer.from(v.map((x) => x & 255)));

/** In-memory sheet that mimics value coercion of Google Sheets. */
class FakeSheet {
  constructor(name, book) {
    this.name = name;
    this.book = book;
    this.cells = []; // rows of { v, f }
    this.frozen = 0;
  }
  getName() { return this.name; }
  getMaxRows() { return Math.max(1000, this.cells.length + 50); }
  getMaxColumns() { return 26; }
  getLastRow() {
    for (let r = this.cells.length - 1; r >= 0; r--) {
      if ((this.cells[r] || []).some((c) => c && c.v !== '' && c.v !== undefined)) return r + 1;
    }
    return 0;
  }
  setFrozenRows(n) { this.frozen = n; }
  deleteRow(r) { this.book.stats.deletes++; this.cells.splice(r - 1, 1); }
  protect() {
    const p = { setDescription: () => p, addEditor: () => p, removeEditors: () => p, getEditors: () => [],
      canDomainEdit: () => false, setDomainEdit: () => p };
    return p;
  }
  cell(r, c) {
    while (this.cells.length < r) this.cells.push([]);
    const row = this.cells[r - 1];
    while (row.length < c) row.push({ v: '', f: '' });
    return row[c - 1];
  }
  getRange(r, c, nr = 1, nc = 1) {
    if (typeof r === 'string') throw new Error('A1 notation not supported by emulator');
    const sh = this;
    const each = (fn) => { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) fn(sh.cell(r + i, c + j), i, j); };
    const range = {
      setNumberFormat(fmt) { each((cell) => { cell.f = fmt; }); return range; },
      setFontWeight() { return range; },
      setBackground() { return range; },
      clearContent() { each((cell) => { cell.v = ''; }); return range; },
      setValues(values) {
        if (values.length !== nr || values.some((row) => row.length !== nc)) throw new Error('setValues dimension mismatch');
        sh.book.stats.writes++;
        each((cell, i, j) => { cell.v = sh.book.coerce(values[i][j], cell.f, sh.name); });
        return range;
      },
      setValue(v) { sh.book.stats.writes++; each((cell) => { cell.v = sh.book.coerce(v, cell.f, sh.name); }); return range; },
      getValues() {
        sh.book.stats.reads++;
        const out = [];
        for (let i = 0; i < nr; i++) {
          const row = [];
          for (let j = 0; j < nc; j++) {
            const rr = sh.cells[r + i - 1];
            const cell = rr && rr[c + j - 1];
            row.push(cell ? cell.v : '');
          }
          out.push(row);
        }
        return out;
      },
      getDisplayValues() { return range.getValues().map((row) => row.map(String)); }
    };
    return range;
  }
}

class FakeBook {
  constructor() {
    this.sheets = new Map();
    this.stats = { reads: 0, writes: 0, deletes: 0, formulaWrites: 0, numericCoercions: [] };
  }
  getSheetByName(n) { return this.sheets.get(n) || null; }
  insertSheet(n) { const s = new FakeSheet(n, this); this.sheets.set(n, s); return s; }
  getSheets() { return [...this.sheets.values()]; }
  coerce(v, fmt, sheetName) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string' && v.startsWith('=')) {
      // Google Sheets would evaluate this as a formula. The backend must never send one.
      this.stats.formulaWrites++;
      throw new Error('Formula write attempted on ' + sheetName + ': ' + v.slice(0, 40));
    }
    if (fmt !== '@' && typeof v === 'string' && /^\s*-?\d+(\.\d+)?\s*$/.test(v)) {
      // Sheets converts numeric-looking text in non-text cells; leading zeros are lost.
      this.stats.numericCoercions.push({ sheet: sheetName, value: v });
      return Number(v);
    }
    return v;
  }
  toJSON() {
    const out = {};
    for (const [n, s] of this.sheets) out[n] = s.cells.map((row) => row.map((c) => [c.v, c.f]));
    return out;
  }
  static fromJSON(obj) {
    const b = new FakeBook();
    for (const n of Object.keys(obj)) {
      const s = b.insertSheet(n);
      s.cells = obj[n].map((row) => row.map(([v, f]) => ({ v, f })));
    }
    return b;
  }
}

/**
 * Create an emulated backend.
 * options: { props, clock: () => ms, persistFile, deterministicIds }
 * Returns { ctx, call(action, params), book, props, cache, lock, setNow(ms), errors }.
 */
export function createBackend(options = {}) {
  const props = new Map(Object.entries({ SPREADSHEET_ID: 'EMULATED_SHEET', ...(options.props || {}) }));
  let book = new FakeBook();
  if (options.persistFile && fs.existsSync(options.persistFile)) {
    const saved = JSON.parse(fs.readFileSync(options.persistFile, 'utf8'));
    book = FakeBook.fromJSON(saved.book || {});
    for (const [k, v] of Object.entries(saved.props || {})) props.set(k, v);
  }
  const cacheStore = new Map();
  let nowMs = options.now ?? Date.now();
  let serial = 0;
  const errors = [];
  const triggers = [];    // installed time-driven triggers ({handler, spec})
  const driveCopies = []; // spreadsheet copies made by backups
  const lock = {
    held: false,
    busy: false,            // force tryLock to fail (contention test)
    onAcquire: null,        // hook run right after the lock is granted (concurrency injection)
    acquisitions: 0
  };
  const scriptLock = {
    tryLock() {
      if (lock.busy) return false;
      if (lock.held) return true; // Apps Script locks are re-entrant within one execution
      lock.held = true;
      lock.acquisitions++;
      if (lock.onAcquire) { const fn = lock.onAcquire; lock.onAcquire = null; fn(); }
      return true;
    },
    waitLock() { if (!scriptLock.tryLock()) throw new Error('Lock timeout'); },
    releaseLock() { lock.held = false; },
    hasLock() { return lock.held; }
  };
  const ctx = {
    console: {
      log() {}, info() {}, warn() {},
      error: (...a) => { errors.push(a.map(String).join(' ')); }
    },
    JSON, Math, Date, Number, String, Object, Array, RegExp, Error, isFinite, isNaN, parseInt, parseFloat,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (props.has(k) ? props.get(k) : null),
      setProperty: (k, v) => { props.set(k, String(v)); },
      deleteProperty: (k) => { props.delete(k); }
    }) },
    SpreadsheetApp: {
      openById: (id) => {
        if (id !== props.get('SPREADSHEET_ID')) throw new Error('Unknown spreadsheet ' + id);
        return book;
      },
      flush() {}
    },
    LockService: { getScriptLock: () => scriptLock },
    CacheService: { getScriptCache: () => ({
      get: (k) => { const e = cacheStore.get(k); return e && e.exp > nowMs ? e.v : null; },
      put: (k, v, ttl = 600) => { cacheStore.set(k, { v: String(v), exp: nowMs + ttl * 1000 }); },
      remove: (k) => { cacheStore.delete(k); }
    }) },
    Utilities: {
      getUuid: () => {
        if (options.deterministicIds) {
          serial++;
          return '00000000-0000-4000-8000-' + String(serial).padStart(12, '0');
        }
        return crypto.randomUUID();
      },
      computeDigest: (alg, s) => toSigned(crypto.createHash('sha256').update(toBuf(s)).digest()),
      computeHmacSha256Signature: (value, key) => toSigned(crypto.createHmac('sha256', toBuf(key)).update(toBuf(value)).digest()),
      newBlob: (s) => ({ getBytes: () => toSigned(Buffer.from(String(s), 'utf8')) }),
      formatDate: (d, tz, fmt) => {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit',
          day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((p) => [p.type, p.value]));
        return fmt.replace('yyyy', parts.year).replace('MM', parts.month).replace('dd', parts.day)
          .replace('HH', parts.hour).replace('mm', parts.minute);
      },
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' }
    },
    ContentService: {
      createTextOutput: (s) => ({ payload: s, setMimeType() { return this; } }),
      MimeType: { JSON: 'application/json' }
    },
    Logger: { log() {} },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.test' }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.map((t) => ({ getHandlerFunction: () => t.handler, _t: t })),
      deleteTrigger: (tr) => { const i = triggers.indexOf(tr._t); if (i >= 0) triggers.splice(i, 1); },
      newTrigger: (handler) => {
        const t = { handler, spec: {} };
        const b = {
          timeBased: () => b, everyDays: (n) => { t.spec.everyDays = n; return b; }, everyHours: (n) => { t.spec.everyHours = n; return b; },
          atHour: (h) => { t.spec.atHour = h; return b; }, inTimezone: (z) => { t.spec.tz = z; return b; },
          create: () => { triggers.push(t); return { getHandlerFunction: () => handler }; }
        };
        return b;
      }
    },
    DriveApp: {
      getFileById: (id) => {
        if (id !== props.get('SPREADSHEET_ID')) throw new Error('Drive file not found');
        return { makeCopy: (name) => { const c = { id: 'copy-' + (driveCopies.length + 1), name, snapshot: JSON.stringify(book.toJSON()) }; driveCopies.push(c); return { getId: () => c.id, getName: () => c.name }; } };
      },
      getFolderById: () => ({ getFiles: () => ({ hasNext: () => false }) })
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(CODE_PATH, 'utf8'), ctx, { filename: 'Code.gs' });
  ctx.CLOCK_ = () => nowMs;

  const persist = () => {
    if (!options.persistFile) return;
    fs.writeFileSync(options.persistFile, JSON.stringify({ book: book.toJSON(), props: Object.fromEntries(props) }));
  };

  /** One HTTP POST to /exec, body = JSON text. Returns the parsed envelope. */
  function raw(bodyText) {
    const out = ctx.doPost({ postData: { contents: bodyText } });
    lock.held = false;
    persist();
    return JSON.parse(out.payload);
  }
  let reqSerial = 0;
  function call(action, params = {}) {
    const body = { action, ...params };
    if (body.requestId === undefined) body.requestId = 'test-req-' + (++reqSerial) + '-' + crypto.randomUUID().slice(0, 8);
    return raw(JSON.stringify(body));
  }
  function run(fnName) {
    const r = ctx[fnName]();
    lock.held = false;
    persist();
    return r;
  }
  return {
    ctx, call, raw, run, lock, props, errors, triggers, driveCopies,
    get book() { return book; },
    cache: cacheStore,
    now: () => nowMs,
    setNow: (ms) => { nowMs = ms; },
    advance: (ms) => { nowMs += ms; },
    sheetRows: (name) => {
      const s = book.getSheetByName(name);
      if (!s) return [];
      const n = s.getLastRow();
      return n < 2 ? [] : s.getRange(2, 1, n - 1, ctx.SCHEMA[name].length).getValues();
    }
  };
}

/** Convenience: emulator with schema, seeded roster and provisioned accounts (passwords already changed). */
export function createSeededBackend(options = {}) {
  const be = createBackend(options);
  be.run('setup');
  const users = options.users || DEFAULT_USERS;
  for (const u of users) provision(be, u);
  return be;
}

export const DEFAULT_USERS = [
  { name: 'Jayesh Mahajan', role: 'admin', vrm: '', password: 'Admin-pass-0001!' },
  { name: 'Lavina Saldanha', role: 'admin', vrm: 'Lavina Saldanha', password: 'Admin-pass-0002!' },
  { name: 'Parth Sharma', role: 'member', vrm: 'Parth Sharma', password: 'Member-pass-0001!' },
  { name: 'Khushi Dodiya', role: 'member', vrm: 'Khushi Dodiya', password: 'Member-pass-0002!' },
  { name: 'Pavan Soni', role: 'member', vrm: 'Pavan Soni', password: 'Member-pass-0003!' },
  { name: 'Riya Reviewer', role: 'reviewer', vrm: '', password: 'Review-pass-0001!' }
];

/** Provision through the operator function, then complete the forced password change via the API. */
export function provision(be, u, { changePassword = true } = {}) {
  const temp = 'Temporary-' + u.password;
  be.props.set('SETUP_NAME', u.name);
  be.props.set('SETUP_PASSWORD', temp);
  be.props.set('SETUP_ROLE', u.role);
  be.props.set('SETUP_VRM', u.vrm || '');
  be.run('provisionUserFromProperties');
  if (!changePassword) return;
  const l = be.call('login', { user: u.name, pw: temp });
  if (!l.ok) throw new Error('provision login failed: ' + JSON.stringify(l.error));
  const c = be.call('changePassword', { token: l.data.token, currentPassword: temp, newPassword: u.password });
  if (!c.ok) throw new Error('provision change password failed: ' + JSON.stringify(c.error));
  be.call('logout', { token: l.data.token });
}

export function login(be, name, password, remember = false) {
  const r = be.call('login', { user: name, pw: password, remember });
  if (!r.ok) throw new Error('login failed for ' + name + ': ' + JSON.stringify(r.error));
  return r.data.token;
}
