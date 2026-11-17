/*
 * VRM Account MIS - pure domain logic shared by the browser UI and the Node test-suite.
 * No DOM access, no network. Rules mirror backend/Code.gs (parity is tested).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VRMCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TZ = 'Asia/Kolkata';
  var MAX_ROWS = 1500;
  var MIN_YEAR = 2000;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MONTHS_SHORT = MONTHS.map(function (m) { return m.slice(0, 3); });

  /* ----------------------------- text ----------------------------- */

  function esc(s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"'`]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' }[c];
    });
  }
  function nameKey(v) { return String(v === null || v === undefined ? '' : v).normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function displayName(v) { return String(v === null || v === undefined ? '' : v).normalize('NFKC').replace(/\s+/g, ' ').trim(); }
  function initials(name) {
    return displayName(name).split(' ').filter(Boolean).slice(0, 2).map(function (w) { return Array.from(w)[0]; }).join('').toUpperCase() || '?';
  }
  var nf = typeof Intl !== 'undefined' ? new Intl.NumberFormat('en-IN') : null;
  function fmtInt(n) { n = Number(n) || 0; return nf ? nf.format(n) : String(n); }
  function pct(part, whole) { return whole > 0 ? part / whole : 0; }
  function fmtPct(part, whole) {
    if (!(whole > 0)) return '0%';
    var p = part / whole * 100;
    return (p > 0 && p < 1 ? p.toFixed(1) : Math.round(p)) + '%';
  }

  /* ----------------------------- client codes ----------------------------- */

  /** Same rules as normCode_ in Code.gs. Returns {ok, original, key, reason}. */
  function normCode(raw, pattern) {
    if (typeof raw !== 'string') return { ok: false, original: raw === null || raw === undefined ? '' : String(raw), key: '', reason: 'Code must be text.' };
    var original = raw.trim();
    var n = original.normalize('NFKC').trim();
    if (!n) return { ok: false, original: original, key: '', reason: 'Code is blank.' };
    if (Array.from(n).length > 70) return { ok: false, original: original, key: '', reason: 'Code is longer than 70 characters.' };
    if (/[\p{C}]/u.test(n)) return { ok: false, original: original, key: '', reason: 'Code contains control or invisible characters.' };
    if (/\s/.test(n)) return { ok: false, original: original, key: '', reason: 'Code contains a space. Separate codes with commas, semicolons or new lines.' };
    if (/^[=+\-@]/.test(n)) return { ok: false, original: original, key: '', reason: 'Code may not start with = + - or @.' };
    if (pattern && !new RegExp(pattern, 'u').test(n)) return { ok: false, original: original, key: '', reason: 'Code does not match the approved client-code format.' };
    return { ok: true, original: original, key: n.toUpperCase(), reason: '' };
  }

  /** Split manual input on commas, semicolons and line breaks. Blank pieces are ignored, not counted. */
  function splitCodes(text) {
    return String(text || '').split(/[,;\r\n]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
  }

  /** Client-side preview of a paste. The server repeats every check; this is for feedback only. */
  function analyzePaste(text, pattern) {
    var tokens = splitCodes(text), seen = {}, items = [], codes = [];
    var s = { tokens: tokens.length, unique: 0, duplicateInPaste: 0, invalid: 0 };
    tokens.forEach(function (t) {
      var c = normCode(t, pattern);
      if (!c.ok) { s.invalid++; items.push({ input: t, status: 'INVALID', reason: c.reason }); codes.push(t); return; }
      if (seen[c.key]) { s.duplicateInPaste++; items.push({ input: t, status: 'DUPLICATE_IN_PASTE', reason: 'Repeated in this paste.' }); codes.push(t); return; }
      seen[c.key] = true;
      s.unique++;
      items.push({ input: t, status: 'OK', key: c.key });
      codes.push(t);
    });
    return { summary: s, items: items, codes: codes };
  }

  /* ----------------------------- dates (IST) ----------------------------- */

  function istParts(ms) {
    var parts = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(ms)).forEach(function (p) { parts[p.type] = p.value; });
    return { date: parts.year + '-' + parts.month + '-' + parts.day, year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
  }
  function todayIST(ms) { return istParts(ms === undefined ? Date.now() : ms).date; }
  function pad2(n) { return ('0' + n).slice(-2); }
  function isoFromYMD(y, m, d) {
    if (!(y >= 1000 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    var t = new Date(Date.UTC(y, m - 1, d));
    if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
    return y + '-' + pad2(m) + '-' + pad2(d);
  }
  function isValidISODate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    return isoFromYMD(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)) === s;
  }
  /** Activation date rule: real ISO date, >= MIN_YEAR, not after today in IST. */
  function checkActivationDate(s, today) {
    if (!isValidISODate(s)) return { ok: false, code: 'INVALID_DATE', reason: /^\d{4}-\d{2}-\d{2}$/.test(String(s)) ? 'Not a real calendar date.' : 'Date must be YYYY-MM-DD.' };
    if (+s.slice(0, 4) < MIN_YEAR) return { ok: false, code: 'INVALID_DATE', reason: 'Date is before ' + MIN_YEAR + '.' };
    if (s > today) return { ok: false, code: 'FUTURE_DATE', reason: 'Activation date is in the future (IST).' };
    return { ok: true, code: '', reason: '' };
  }
  function lastDayOfMonth(y, m) { return new Date(Date.UTC(+y, +m, 0)).getUTCDate(); }
  function addMonths(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return y + '-' + pad2(m + 1);
  }
  function fmtDate(iso) {
    if (!isValidISODate(iso)) return String(iso || '');
    return +iso.slice(8, 10) + ' ' + MONTHS_SHORT[+iso.slice(5, 7) - 1] + ' ' + iso.slice(0, 4);
  }
  function fmtDateTimeIST(isoTs) {
    var t = Date.parse(isoTs);
    if (isNaN(t)) return '';
    var p = istParts(t);
    return +p.day + ' ' + MONTHS_SHORT[+p.month - 1] + ' ' + p.year + ', ' + p.hour + ':' + p.minute + ' IST';
  }

  /**
   * Period filter. Mirrors resolvePeriod_ in Code.gs so on-screen totals and exports use the same bounds.
   * filter: {year, month, from, to, allTime}. A from/to range overrides year/month while active.
   */
  function resolvePeriod(f, today) {
    f = f || {};
    var from = f.from || '', to = f.to || '';
    if (from && !isValidISODate(from)) return { ok: false, error: 'From date is not a valid date.' };
    if (to && !isValidISODate(to)) return { ok: false, error: 'To date is not a valid date.' };
    if (from || to) {
      if (from && to && from > to) return { ok: false, error: 'From date is after To date. Swap them or clear the range.' };
      var label = from && to ? (from === to ? fmtDate(from) : fmtDate(from) + ' – ' + fmtDate(to)) : from ? 'From ' + fmtDate(from) : 'Up to ' + fmtDate(to);
      return { ok: true, kind: 'range', from: from || '0000-01-01', to: to || '9999-12-31', label: label };
    }
    if (f.allTime) return { ok: true, kind: 'all', from: '0000-01-01', to: '9999-12-31', label: 'All time' };
    var y = String(f.year || (today || '').slice(0, 4));
    if (!/^\d{4}$/.test(y)) return { ok: false, error: 'Choose a year or a date range.' };
    var m = f.month ? String(f.month) : '';
    if (m) {
      if (!/^(0[1-9]|1[0-2])$/.test(m)) return { ok: false, error: 'Month must be 01-12.' };
      return { ok: true, kind: 'month', from: y + '-' + m + '-01', to: y + '-' + m + '-' + pad2(lastDayOfMonth(y, m)), label: MONTHS[+m - 1] + ' ' + y };
    }
    return { ok: true, kind: 'year', from: y + '-01-01', to: y + '-12-31', label: 'Whole year ' + y };
  }

  /* ----------------------------- metrics ----------------------------- */

  /**
   * Metric engine over the server's (vrmId, date, count) rows of ACTIVE entries.
   * opts: {vrms:[{id,name,status}], counts:[[vrmId,date,n]], zeroReports:[[vrmId,date]], today, period:{from,to}, vrmId}
   * Rows include every active VRM (zero performers too) and archived VRMs that have history.
   * teamTotals cover all visible VRMs; scopeTotals cover only the selected VRM (or the team).
   */
  function computeMetrics(o) {
    var today = o.today, month = today.slice(0, 7), year = today.slice(0, 4);
    var period = o.period || null;
    var by = {};
    (o.vrms || []).forEach(function (v) { by[v.id] = { vrmId: v.id, name: v.name, status: v.status, today: 0, month: 0, year: 0, all: 0, period: 0 }; });
    var unknown = 0;
    (o.counts || []).forEach(function (c) {
      var r = by[c[0]], d = c[1], n = Number(c[2]) || 0;
      if (!r) { unknown += n; return; }
      r.all += n;
      if (d === today) r.today += n;
      if (d.slice(0, 7) === month) r.month += n;
      if (d.slice(0, 4) === year) r.year += n;
      if (period && d >= period.from && d <= period.to) r.period += n;
    });
    var zero = {};
    (o.zeroReports || []).forEach(function (z) { zero[z[0] + '|' + z[1]] = true; });
    var rows = Object.keys(by).map(function (k) { return by[k]; }).filter(function (r) { return r.status === 'active' || r.all > 0; });
    rows.forEach(function (r) {
      r.reporting = r.today > 0 ? 'filed' : zero[r.vrmId + '|' + today] ? 'zero' : 'none';
    });
    var sum = function (list, k) { return list.reduce(function (s, r) { return s + r[k]; }, 0); };
    var team = { today: sum(rows, 'today'), month: sum(rows, 'month'), year: sum(rows, 'year'), all: sum(rows, 'all'), period: sum(rows, 'period') };
    var scoped = o.vrmId ? rows.filter(function (r) { return r.vrmId === o.vrmId; }) : rows;
    scoped.forEach(function (r) { r.share = pct(r.period, team.period); r.monthShare = pct(r.month, team.month); });
    return {
      rows: scoped,
      allRows: rows,
      teamTotals: team,
      scopeTotals: { today: sum(scoped, 'today'), month: sum(scoped, 'month'), year: sum(scoped, 'year'), all: sum(scoped, 'all'), period: sum(scoped, 'period') },
      activeVrmCount: (o.vrms || []).filter(function (v) { return v.status === 'active'; }).length,
      unattributed: unknown
    };
  }

  /** Month buckets for the trend chart. mode 'last12' ends at today's month; otherwise a calendar year. */
  function monthlySeries(counts, opts) {
    var keys = [];
    if (opts.mode === 'last12') {
      var end = opts.today.slice(0, 7);
      for (var i = 11; i >= 0; i--) keys.push(addMonths(end, -i));
    } else {
      for (var m = 1; m <= 12; m++) keys.push(opts.year + '-' + pad2(m));
    }
    var idx = {};
    keys.forEach(function (k) { idx[k] = 0; });
    (counts || []).forEach(function (c) {
      if (opts.vrmId && c[0] !== opts.vrmId) return;
      var k = c[1].slice(0, 7);
      if (idx[k] !== undefined) idx[k] += Number(c[2]) || 0;
    });
    return keys.map(function (k) { return { key: k, label: MONTHS_SHORT[+k.slice(5, 7) - 1] + (opts.mode === 'last12' ? ' ' + k.slice(2, 4) : ''), count: idx[k] }; });
  }

  function yearsWithData(counts, today) {
    var ys = {};
    ys[today.slice(0, 4)] = true;
    (counts || []).forEach(function (c) { ys[c[1].slice(0, 4)] = true; });
    return Object.keys(ys).sort().reverse();
  }

  /* ----------------------------- CSV ----------------------------- */

  /** One CSV cell. Formula-leading values are neutralised (CSV only; XLSX keeps them as typed text). */
  function csvCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function toCsv(rows) { return '﻿' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n') + '\r\n'; }

  /* ----------------------------- import parsing ----------------------------- */

  /** Documented exact header aliases (compared after lower-casing and collapsing spaces/_/-/.). */
  var HEADER_ALIASES = {
    vrm: ['vrm', 'vrm name', 'rm', 'rm name', 'relationship manager', 'relationship manager name'],
    date: ['date', 'activation date', 'account opening date', 'opening date', 'account open date', 'date of activation'],
    code: ['client code', 'clientcode', 'client id', 'code', 'ucc', 'ucc code', 'client code no']
  };
  function normHeader(h) {
    return String(h === null || h === undefined ? '' : h).replace(/[﻿​]/g, '').normalize('NFKC').toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function autoMapHeaders(headers) {
    var map = { vrm: -1, date: -1, code: -1 }, used = {};
    ['code', 'vrm', 'date'].forEach(function (field) {
      for (var i = 0; i < headers.length; i++) {
        if (used[i]) continue;
        if (HEADER_ALIASES[field].indexOf(normHeader(headers[i])) >= 0) { map[field] = i; used[i] = true; break; }
      }
    });
    return map;
  }

  function excelSerialToISO(serial, date1904) {
    if (typeof serial !== 'number' || !isFinite(serial)) return null;
    var days = Math.floor(serial);
    var base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    var d = new Date(base + days * 86400000);
    return isoFromYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  var MONTH_INDEX = {};
  MONTHS.forEach(function (m, i) { MONTH_INDEX[m.toLowerCase()] = i + 1; MONTH_INDEX[m.slice(0, 3).toLowerCase()] = i + 1; });
  MONTH_INDEX.sept = 9;

  /**
   * Parse one text date. Returns {kind, iso?, a?, b?, y?, reason?}:
   *  kind 'iso'   -> unambiguous ISO (YYYY-MM-DD or YYYY/MM/DD)
   *  kind 'named' -> month written as a word (16-Nov-2026)
   *  kind 'pair'  -> NN/NN/YYYY: day/month order must be resolved at file level
   *  kind 'invalid'
   */
  function parseTextDate(raw) {
    var s = String(raw === null || raw === undefined ? '' : raw).trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[AaPp][Mm])?$/, '');
    if (!s) return { kind: 'invalid', reason: 'Date is blank.' };
    var m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
    if (m) { var iso = isoFromYMD(+m[1], +m[2], +m[3]); return iso ? { kind: 'iso', iso: iso } : { kind: 'invalid', reason: 'Not a real calendar date.' }; }
    m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return { kind: 'pair', a: +m[1], b: +m[2], y: +m[3] };
    m = s.match(/^(\d{1,2})[\s\-\/]+([A-Za-z]{3,9})\.?[\s\-\/,]+(\d{4})$/);
    if (m && MONTH_INDEX[m[2].toLowerCase()]) { var i1 = isoFromYMD(+m[3], MONTH_INDEX[m[2].toLowerCase()], +m[1]); return i1 ? { kind: 'named', iso: i1 } : { kind: 'invalid', reason: 'Not a real calendar date.' }; }
    m = s.match(/^([A-Za-z]{3,9})\.?[\s\-]+(\d{1,2}),?[\s\-]+(\d{4})$/);
    if (m && MONTH_INDEX[m[1].toLowerCase()]) { var i2 = isoFromYMD(+m[3], MONTH_INDEX[m[1].toLowerCase()], +m[2]); return i2 ? { kind: 'named', iso: i2 } : { kind: 'invalid', reason: 'Not a real calendar date.' }; }
    if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2}$/.test(s)) return { kind: 'invalid', reason: 'Two-digit year is ambiguous. Use a 4-digit year.' };
    return { kind: 'invalid', reason: 'Unrecognised date "' + s.slice(0, 30) + '". Use YYYY-MM-DD or DD/MM/YYYY.' };
  }

  /**
   * Resolve day/month order for NN/NN/YYYY values across a whole file.
   * mode: 'auto' | 'dmy' | 'mdy'. Never swaps silently: rows that fit both orders are AMBIGUOUS
   * unless the file (or the user) establishes the order.
   */
  function resolvePairDates(pairs, mode) {
    var dmyOnly = 0, mdyOnly = 0;
    pairs.forEach(function (p) {
      if (!p) return;
      var dmy = isoFromYMD(p.y, p.b, p.a), mdy = isoFromYMD(p.y, p.a, p.b);
      if (dmy && !mdy) dmyOnly++;
      if (mdy && !dmy) mdyOnly++;
    });
    var order = mode === 'dmy' || mode === 'mdy' ? mode : dmyOnly && !mdyOnly ? 'dmy' : mdyOnly && !dmyOnly ? 'mdy' : dmyOnly && mdyOnly ? 'mixed' : 'undetermined';
    var results = pairs.map(function (p) {
      if (!p) return null;
      var dmy = isoFromYMD(p.y, p.b, p.a), mdy = isoFromYMD(p.y, p.a, p.b);
      if (order === 'dmy') return dmy ? { iso: dmy } : { error: 'INVALID_DATE', reason: 'Not a valid DD/MM/YYYY date.' };
      if (order === 'mdy') return mdy ? { iso: mdy } : { error: 'INVALID_DATE', reason: 'Not a valid MM/DD/YYYY date.' };
      if (!dmy && !mdy) return { error: 'INVALID_DATE', reason: 'Not a real calendar date.' };
      if (dmy && mdy && dmy !== mdy) return { error: 'AMBIGUOUS_DATE', reason: 'Could be ' + fmtDate(dmy) + ' or ' + fmtDate(mdy) + '. Choose the date format for this file.' };
      return { iso: dmy || mdy };
    });
    return { order: order, results: results };
  }

  /** Read one worksheet into a grid of SheetJS cell objects ({t, v, w}) or null for empty cells. */
  function sheetToGrid(XLSX, ws) {
    if (!ws || !ws['!ref']) return [];
    var r = XLSX.utils.decode_range(ws['!ref']), grid = [];
    for (var R = r.s.r; R <= r.e.r; R++) {
      var row = [];
      for (var C = r.s.c; C <= r.e.c; C++) {
        var cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        row.push(cell && cell.t !== 'z' ? { t: cell.t, v: cell.v, w: cell.w } : null);
      }
      grid.push(row);
    }
    return grid;
  }
  function cellText(cell) {
    if (!cell) return '';
    if (cell.t === 's' || cell.t === 'str') return String(cell.v);
    if (cell.w !== undefined) return String(cell.w);
    return String(cell.v);
  }
  function isBlankRow(row) { return !row || row.every(function (c) { return !c || cellText(c).trim() === ''; }); }

  /** Interpret a code cell without losing leading zeros or accepting precision-damaged numbers. */
  function codeFromCell(cell) {
    if (!cell) return { code: '', issue: '' };
    if (cell.t === 's' || cell.t === 'str') return { code: String(cell.v), issue: '' };
    if (cell.t === 'n') {
      var v = cell.v, w = cell.w === undefined ? '' : String(cell.w).trim();
      if (!Number.isInteger(v) || Math.abs(v) >= 1e15 || /e/i.test(w)) {
        return { code: w || String(v), issue: 'SCIENTIFIC_CODE', reason: 'Excel stored this code as a number in scientific/decimal form (' + (w || v) + '); digits may be lost. Format the column as Text and re-enter it.' };
      }
      if (/^\d+$/.test(w) && Number(w) === v && w !== String(v)) return { code: w, issue: '' }; // custom number format such as 000000
      return { code: String(v), issue: 'NUMERIC_CODE', reason: 'Stored as a number in Excel; any leading zeros were already lost before upload.' };
    }
    return { code: cellText(cell), issue: 'INVALID_CODE', reason: 'Code cell is not text.' };
  }

  /** Date cell -> {iso} | {pair} | {error, reason}. */
  function dateFromCell(cell, date1904) {
    if (!cell) return { error: 'INVALID_DATE', reason: 'Date is blank.' };
    if (cell.t === 'n') {
      if (cell.v >= 36526 && cell.v < 73051) return { iso: excelSerialToISO(cell.v, date1904) }; // 2000-01-01 .. 2099-12-31
      return { error: 'INVALID_DATE', reason: 'Number ' + cell.v + ' is not an Excel date.' };
    }
    if (cell.t === 'd' && cell.v instanceof Date) return { iso: isoFromYMD(cell.v.getFullYear(), cell.v.getMonth() + 1, cell.v.getDate()) };
    var p = parseTextDate(cellText(cell));
    if (p.kind === 'iso' || p.kind === 'named') return { iso: p.iso };
    if (p.kind === 'pair') return { pair: p };
    return { error: 'INVALID_DATE', reason: p.reason };
  }

  /**
   * Turn a worksheet grid into import rows with client-side validation.
   * mapping: {mode:'structured', headerRow, vrm, date, code} | {mode:'list', headerRow (or -1), code, vrmName, date}
   * opts: {today, dateOrder:'auto'|'dmy'|'mdy', date1904, includeNumericCodes, pattern}
   * Returns {rows, order, blankRows}. Each row: {row (1-based sheet row), vrm, date, code, status, reason}.
   * status: OK | NUMERIC_CODE | SCIENTIFIC_CODE | INVALID_CODE | INVALID_DATE | AMBIGUOUS_DATE | FUTURE_DATE | MISSING_VRM | DUPLICATE_IN_FILE
   */
  function buildImportRows(grid, mapping, opts) {
    var start = mapping.headerRow >= 0 ? mapping.headerRow + 1 : 0;
    var rows = [], dates = [], blankRows = 0;
    for (var i = start; i < grid.length; i++) {
      var g = grid[i];
      if (isBlankRow(g)) { blankRows++; continue; }
      var code = codeFromCell(g[mapping.code] || null);
      var r = { row: i + 1, vrm: '', date: '', code: code.code.trim(), status: 'OK', reason: '' };
      if (mapping.mode === 'list') {
        r.vrm = mapping.vrmName;
        r.date = mapping.date;
        dates.push({ iso: mapping.date });
      } else {
        r.vrm = displayName(cellText(g[mapping.vrm] || null));
        dates.push(dateFromCell(g[mapping.date] || null, opts.date1904));
      }
      if (code.issue) { r.status = code.issue; r.reason = code.reason; }
      rows.push(r);
    }
    var pairs = dates.map(function (d) { return d.pair || null; });
    var resolved = resolvePairDates(pairs, opts.dateOrder || 'auto');
    var seen = {};
    rows.forEach(function (r, k) {
      var d = dates[k];
      var res = d.pair ? resolved.results[k] : d;
      if (res && res.iso) r.date = res.iso;
      if (r.status === 'NUMERIC_CODE' && opts.includeNumericCodes) r.status = 'OK';
      if (r.status !== 'OK') return;
      var c = normCode(r.code, opts.pattern);
      if (!c.ok) { r.status = 'INVALID_CODE'; r.reason = c.reason; return; }
      if (res && res.error) { r.status = res.error; r.reason = res.reason; return; }
      var dc = checkActivationDate(r.date, opts.today);
      if (!dc.ok) { r.status = dc.code; r.reason = dc.reason; return; }
      if (!nameKey(r.vrm)) { r.status = 'MISSING_VRM'; r.reason = 'VRM is blank.'; return; }
      if (seen[c.key]) { r.status = 'DUPLICATE_IN_FILE'; r.reason = 'Same code as row ' + seen[c.key] + '.'; return; }
      seen[c.key] = r.row;
    });
    return { rows: rows, order: resolved.order, blankRows: blankRows };
  }

  function chunk(list, size) {
    var out = [];
    for (var i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  }

  function uuid() {
    var c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && c.randomUUID) return c.randomUUID();
    var b = new Uint8Array(16);
    if (c && c.getRandomValues) c.getRandomValues(b); else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  /** Human text for status codes shared by entry results, import previews and exception files. */
  var STATUS_TEXT = {
    OK: 'Ready', ACCEPTED: 'Saved', ADDED: 'Saved', DUPLICATE_IN_PASTE: 'Repeated in paste', DUPLICATE_IN_FILE: 'Repeated in file',
    DUPLICATE_EXISTING: 'Already recorded', INVALID: 'Invalid code', INVALID_CODE: 'Invalid code', NUMERIC_CODE: 'Number-formatted code',
    SCIENTIFIC_CODE: 'Damaged by Excel', INVALID_DATE: 'Invalid date', AMBIGUOUS_DATE: 'Ambiguous date', FUTURE_DATE: 'Future date',
    MISSING_VRM: 'VRM missing', UNKNOWN_VRM: 'Unknown VRM', ARCHIVED_VRM: 'Archived VRM', UNAUTHORIZED_VRM: 'Not your VRM',
    FAILED: 'Not saved (error)', NOT_SENT: 'Not sent', CANCELLED: 'Cancelled'
  };

  return {
    TZ: TZ, MAX_ROWS: MAX_ROWS, MIN_YEAR: MIN_YEAR, MONTHS: MONTHS, MONTHS_SHORT: MONTHS_SHORT, HEADER_ALIASES: HEADER_ALIASES, STATUS_TEXT: STATUS_TEXT,
    esc: esc, nameKey: nameKey, displayName: displayName, initials: initials, fmtInt: fmtInt, fmtPct: fmtPct, pct: pct,
    normCode: normCode, splitCodes: splitCodes, analyzePaste: analyzePaste,
    istParts: istParts, todayIST: todayIST, isValidISODate: isValidISODate, isoFromYMD: isoFromYMD, checkActivationDate: checkActivationDate,
    lastDayOfMonth: lastDayOfMonth, addMonths: addMonths, fmtDate: fmtDate, fmtDateTimeIST: fmtDateTimeIST, resolvePeriod: resolvePeriod,
    computeMetrics: computeMetrics, monthlySeries: monthlySeries, yearsWithData: yearsWithData,
    csvCell: csvCell, toCsv: toCsv,
    normHeader: normHeader, autoMapHeaders: autoMapHeaders, excelSerialToISO: excelSerialToISO, parseTextDate: parseTextDate,
    resolvePairDates: resolvePairDates, sheetToGrid: sheetToGrid, cellText: cellText, codeFromCell: codeFromCell, dateFromCell: dateFromCell,
    buildImportRows: buildImportRows, chunk: chunk, uuid: uuid
  };
});
