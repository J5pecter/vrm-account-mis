/* VRM Account MIS - user interface (v3). Server is authoritative; this file only presents and requests. */
(function () {
  'use strict';
  var C = window.VRMCore, Api = window.VRMApi, h = C.esc;
  var XLSX_SRC = 'vendor/xlsx-0.20.3.full.min.js';
  var XLSX_SRI = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';
  var MAX_FILE_BYTES = 10 * 1024 * 1024;
  var ALL = ['admin', 'member', 'reviewer'];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  /* ================================ icons ================================ */
  var I = {
    dash: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10M15 10v10"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    shield: '<path d="M12 22s8-3.6 8-10V5.4L12 2 4 5.4V12c0 6.4 8 10 8 10z"/><path d="M9.2 12.2l2 2 3.6-3.8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    warn: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    x: '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
    refresh: '<path d="M23 4v6h-6"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    trend: '<path d="M3 3v18h18"/><path d="M18 9l-5 5-3-3-4 4"/>',
    trophy: '<circle cx="12" cy="8" r="5"/><path d="M8.2 12.5 7 22l5-2.6L17 22l-1.2-9.5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    eye: '<path d="M1.6 12S5.2 5.4 12 5.4 22.4 12 22.4 12 18.8 18.6 12 18.6 1.6 12 1.6 12z"/><circle cx="12" cy="12" r="3.1"/>',
    eyeoff: '<path d="M9.9 5.6A9.6 9.6 0 0 1 12 5.4c6.8 0 10.4 6.6 10.4 6.6a18 18 0 0 1-3.5 4.4M6.2 6.2A18 18 0 0 0 1.6 12S5.2 18.6 12 18.6a9.6 9.6 0 0 0 4.1-.9"/><path d="M10 10a3.1 3.1 0 0 0 4.2 4.2"/><path d="M2.5 2.5l19 19"/>',
    zero: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    logo: '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-5"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/>'
  };
  function svg(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[name] + '</svg>';
  }

  /* ================================ state ================================ */
  var S = {
    me: null, config: {}, vrms: [], counts: [], zero: [], asOf: '', today: '',
    route: '', loaded: false,
    ui: {
      trend: { mode: 'last12', vrmId: '' },
      mis: { year: '', month: '', from: '', to: '', vrmId: '', sortKey: 'period', sortDir: 'desc' },
      input: { vrmId: '', date: '', text: '', result: null, pending: null, busy: false },
      lookup: { text: '', results: null, busy: false },
      ledger: { q: '', vrmId: '', from: '', to: '', batchId: '', status: 'active', sort: 'date', dir: 'desc', page: 1, pageSize: 50, data: null, error: '', loading: false },
      logs: { from: '', to: '', actorId: '', eventAction: '', outcome: '', page: 1, pageSize: 50, data: null, error: '', loading: false },
      admin: { data: null, error: '', integrity: null },
      manage: { tab: 'vrms', users: null, aliases: null, error: '' },
      imp: null
    }
  };
  S.ui.imp = newImport();

  var ROUTES = {
    dashboard: { title: 'Dashboard', sub: 'Client-code activations across the VRM desk', roles: ALL, icon: 'dash', group: 'Overview', render: renderDashboard },
    mis: { title: 'MIS – VRM Wise Summary', sub: 'Period, VRM and team reporting with exports', roles: ALL, icon: 'table', group: 'Overview', render: renderMis, refresh: renderMisResults },
    input: { title: 'Analysis & Input', sub: 'Record client codes and the daily reporting status', roles: ['admin', 'member'], icon: 'edit', group: 'Work', render: renderInput, refresh: refreshInputPanels },
    lookup: { title: 'Client Code Lookup', sub: 'Check codes and search the activation ledger', roles: ALL, icon: 'search', group: 'Work', render: renderLookup, refresh: function () {} },
    'import': { title: 'Excel / CSV Import', sub: 'Preview, validate and import activation files', roles: ['admin', 'member'], icon: 'upload', group: 'Work', render: renderImport, refresh: function () {} },
    admin: { title: 'Admin Overview', sub: 'Reporting status, exceptions and recent changes', roles: ['admin', 'reviewer'], icon: 'shield', group: 'Administration', render: renderAdmin, refresh: renderAdminBody },
    activity: { title: 'Activity Log', sub: 'Server-recorded audit trail (times in IST)', roles: ['admin', 'reviewer'], icon: 'clock', group: 'Administration', render: renderActivity, refresh: function () {} },
    manage: { title: 'Management', sub: 'VRM roster, name aliases and user accounts', roles: ['admin'], icon: 'sliders', group: 'Administration', render: renderManage, refresh: renderManageBody },
    account: { title: 'Your account', sub: 'Profile, session and password', roles: ALL, icon: 'user', group: null, render: renderAccount, refresh: function () {} }
  };

  /* ================================ helpers ================================ */
  var PALETTE = ['#4f46e5', '#0d9488', '#b45309', '#be123c', '#7c3aed', '#0e7490', '#a21caf', '#047857', '#c2410c', '#1d4ed8', '#4d7c0f', '#9f1239'];
  function colorFor(name) {
    var x = 0, s = String(name);
    for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0;
    return PALETTE[Math.abs(x) % PALETTE.length];
  }
  function avatar(name, extra) {
    return '<span class="avatar"><span class="ini" data-bg="' + colorFor(name) + '" aria-hidden="true">' + h(C.initials(name)) +
      '</span><span class="vname">' + h(name) + '</span>' + (extra || '') + '</span>';
  }
  /** CSP forbids inline style attributes; dynamic widths/colours are applied through the CSSOM. */
  function applyStyles(root) {
    $$('[data-w]', root).forEach(function (el) { el.style.width = Math.max(0, Math.min(100, Number(el.getAttribute('data-w')) || 0)) + '%'; });
    $$('[data-bg]', root).forEach(function (el) { var c = el.getAttribute('data-bg'); if (/^#[0-9a-f]{6}$/i.test(c)) el.style.background = c; });
  }
  function pill(code, text) {
    var cls = String(code).replace(/[^A-Za-z_]/g, '');
    return '<span class="st ' + cls + '">' + h(text || C.STATUS_TEXT[code] || code) + '</span>';
  }
  function opt(value, label, selected, disabled) {
    return '<option value="' + h(value) + '"' + (selected ? ' selected' : '') + (disabled ? ' disabled' : '') + '>' + h(label) + '</option>';
  }
  function vrmById(id) { return S.vrms.filter(function (v) { return v.id === id; })[0] || null; }
  function vrmName(id) { var v = vrmById(id); return v ? v.name : ''; }
  function activeVrms() { return S.vrms.filter(function (v) { return v.status === 'active'; }); }
  function canWrite(vrmId) {
    if (!S.me) return false;
    if (S.me.role === 'admin') return true;
    return S.me.role === 'member' && vrmId === S.me.assignedVrmId;
  }
  function isRole() { return S.me && Array.prototype.indexOf.call(arguments, S.me.role) >= 0; }
  function today() { return Api.today(); }
  function timeIST(iso) { var t = Date.parse(iso); if (isNaN(t)) return ''; var p = C.istParts(t); return p.hour + ':' + p.minute + ' IST'; }
  function fmtTs(iso) { return iso ? C.fmtDateTimeIST(iso) : '—'; }
  function slug(s) { return String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'report'; }
  function stamp() { var p = C.istParts(Api.now()); return p.year + p.month + p.day + '-' + p.hour + p.minute; }
  function empty(msg, icon) { return '<div class="empty">' + svg(icon || 'info') + '<p>' + h(msg) + '</p></div>'; }
  function banner(type, html, icon) {
    return '<div class="banner ' + type + '" role="' + (type === 'err' ? 'alert' : 'status') + '">' + svg(icon || (type === 'err' ? 'x' : type === 'warn' ? 'warn' : type === 'ok' ? 'check' : 'info')) + '<div class="grow">' + html + '</div></div>';
  }
  function metricsFor(period, vrmId) {
    return C.computeMetrics({ vrms: S.vrms, counts: S.counts, zeroReports: S.zero, today: today(), period: period, vrmId: vrmId || '' });
  }
  function countFor(vrmId, date) {
    var n = 0;
    S.counts.forEach(function (c) { if (c[0] === vrmId && c[1] === date) n += c[2]; });
    return n;
  }
  function hasZero(vrmId, date) { return S.zero.some(function (z) { return z[0] === vrmId && z[1] === date; }); }
  function errMsg(e) { return (e && e.message) || 'Something went wrong.'; }
  function download(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }
  function downloadCsv(rows, name) { download(new Blob([C.toCsv(rows)], { type: 'text/csv;charset=utf-8' }), name); }
  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.classList.toggle('loading', !!on);
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
    if (on && !btn.querySelector('.spin')) btn.insertAdjacentHTML('afterbegin', '<span class="spin" aria-hidden="true"></span>');
  }
  function sortRows(rows, key, dir, textKeys) {
    var m = dir === 'asc' ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var x = a[key], y = b[key];
      if (textKeys && textKeys[key]) { x = String(x).toLowerCase(); y = String(y).toLowerCase(); }
      return x < y ? -m : x > y ? m : String(a.name || '').localeCompare(String(b.name || ''));
    });
  }
  function sortTh(table, key, label, cur, dir, cls) {
    var aria = cur === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return '<th scope="col" class="' + (cls || '') + '" aria-sort="' + aria + '"><button type="button" class="sort" data-action="sort" data-table="' + table + '" data-key="' + key + '">' + h(label) + '</button></th>';
  }
  function pager(d, action) {
    if (!d || d.total === 0) return '';
    var a = (d.page - 1) * d.pageSize + 1, b = Math.min(d.total, d.page * d.pageSize);
    return '<div class="pager"><span>Showing ' + C.fmtInt(a) + '–' + C.fmtInt(b) + ' of ' + C.fmtInt(d.total) + '</span><div class="actions">' +
      '<button type="button" class="btn ghost mini" data-action="' + action + '" data-page="' + (d.page - 1) + '"' + (d.page <= 1 ? ' disabled' : '') + '>Previous</button>' +
      '<span>Page ' + d.page + ' of ' + d.pages + '</span>' +
      '<button type="button" class="btn ghost mini" data-action="' + action + '" data-page="' + (d.page + 1) + '"' + (d.page >= d.pages ? ' disabled' : '') + '>Next</button></div></div>';
  }
  function vrmOptions(selected, opts) {
    opts = opts || {};
    var list = opts.activeOnly ? activeVrms() : S.vrms.slice();
    list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    var out = opts.placeholder ? opt('', opts.placeholder, !selected) : '';
    return out + list.map(function (v) { return opt(v.id, v.name + (v.status === 'archived' ? ' (archived)' : ''), v.id === selected); }).join('');
  }

  /* ================================ feedback ================================ */
  function toast(msg, type, ms) {
    var box = $('#toasts'), el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    var tx = document.createElement('div');
    tx.className = 'tx';
    tx.textContent = msg;
    var close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '×';
    close.addEventListener('click', function () { el.remove(); });
    el.appendChild(tx);
    el.appendChild(close);
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, ms || (type === 'err' ? 10000 : 5000));
  }
  function announce(msg) { var l = $('#live'); l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 50); }
  function setSync(state, text) {
    var d = $('#sync-dot'), t = $('#sync-text');
    if (!d) return;
    d.className = 'dot' + (state === 'wait' ? ' wait' : state === 'off' ? ' off' : '');
    t.textContent = text;
  }

  /* ================================ modal ================================ */
  var modalOpen = false;
  /**
   * o: {title, html, confirmLabel, danger, wide, hideConfirm, cancelLabel, onConfirm(form) -> Promise|void, onOpen(form)}
   */
  function openModal(o) {
    var root = $('#modal-root'), prev = document.activeElement, isBusy = false;
    root.innerHTML = '<div class="modal-bg"><div class="modal' + (o.wide ? ' wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="m-title">' +
      '<h3 id="m-title">' + h(o.title) + '</h3><form id="m-form" novalidate>' + (o.html || '') +
      '<div class="field-error" id="m-err" role="alert" hidden></div><div class="acts">' +
      '<button type="button" class="btn ghost" data-m="cancel">' + h(o.cancelLabel || (o.hideConfirm ? 'Close' : 'Cancel')) + '</button>' +
      (o.hideConfirm ? '' : '<button type="submit" class="btn' + (o.danger ? ' danger' : '') + '" id="m-ok">' + h(o.confirmLabel || 'Confirm') + '</button>') +
      '</div></form></div></div>';
    modalOpen = true;
    var bg = $('.modal-bg', root), form = $('#m-form', root), err = $('#m-err', root);
    applyStyles(root);
    function close() {
      if (isBusy) return;
      root.innerHTML = '';
      modalOpen = false;
      document.removeEventListener('keydown', onKey, true);
      if (prev && prev.focus && document.contains(prev)) prev.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab') {
        var f = $$('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])', root).filter(function (x) { return !x.disabled && x.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }
    document.addEventListener('keydown', onKey, true);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg) close(); });
    $('[data-m="cancel"]', root).addEventListener('click', close);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (isBusy || !o.onConfirm) return;
      err.hidden = true;
      var btn = $('#m-ok', root);
      var r;
      try { r = o.onConfirm(form); } catch (x) { err.textContent = errMsg(x); err.hidden = false; return; }
      if (!r || typeof r.then !== 'function') { if (r !== false) close(); return; }
      isBusy = true;
      busy(btn, true);
      r.then(function (keep) { isBusy = false; busy(btn, false); if (keep !== false) close(); },
        function (x) { isBusy = false; busy(btn, false); err.textContent = errMsg(x); err.hidden = false; });
    });
    if (o.onOpen) o.onOpen(form);
    var first = $('input:not([type=hidden]):not([readonly]),select,textarea', form) || $('#m-ok', root) || $('[data-m="cancel"]', root);
    if (first) first.focus();
    return { close: close, form: form };
  }
  function confirmDialog(title, html, label, danger) {
    return new Promise(function (resolve) {
      var done = false;
      var m = openModal({ title: title, html: '<p>' + html + '</p>', confirmLabel: label || 'Confirm', danger: danger,
        onConfirm: function () { done = true; resolve(true); } });
      var root = $('#modal-root');
      var obs = new MutationObserver(function () { if (!root.firstChild) { obs.disconnect(); if (!done) resolve(false); } });
      obs.observe(root, { childList: true });
      return m;
    });
  }
  function fval(form, name) { var el = form.elements[name]; return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; }
  function needReason(form) {
    var r = String(fval(form, 'reason')).trim();
    if (r.length < 3) throw new Error('Enter a reason of at least 3 characters.');
    return r;
  }

  /* ================================ XLSX loader ================================ */
  var xlsxPromise = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = XLSX_SRC;
      s.integrity = XLSX_SRI;
      s.crossOrigin = 'anonymous';
      s.onload = function () { window.XLSX ? resolve(window.XLSX) : reject(new Error('Spreadsheet library did not initialise.')); };
      s.onerror = function () { xlsxPromise = null; reject(new Error('The spreadsheet library could not be loaded. Check your connection and retry.')); };
      document.head.appendChild(s);
    });
    return xlsxPromise;
  }

  /* ================================ data ================================ */
  var refreshing = null;
  function applySnapshot(d) {
    S.me = d.me;
    S.config = d.config || {};
    S.vrms = d.vrms || [];
    S.counts = d.counts || [];
    S.zero = d.zeroReports || [];
    S.asOf = d.asOf;
    S.today = today();
    S.loaded = true;
    updateChrome();
  }
  function refreshData(opts) {
    opts = opts || {};
    if (refreshing) return refreshing;
    setSync('wait', 'Syncing…');
    refreshing = Api.call('getData').then(function (d) {
      applySnapshot(d);
      setSync('ok', 'Synced ' + timeIST(d.asOf));
      if (!opts.noRender) rerenderData();
      return d;
    }, function (e) {
      setSync('off', e.code === 'NETWORK' || e.code === 'TIMEOUT' ? 'Offline — select to retry' : 'Sync failed — select to retry');
      if (!opts.quiet) toast('Could not refresh data: ' + errMsg(e), 'err');
      throw e;
    });
    refreshing.then(function () { refreshing = null; }, function () { refreshing = null; });
    return refreshing;
  }
  function rerenderData() {
    var def = ROUTES[S.route];
    if (!def || !S.me || def.roles.indexOf(S.me.role) < 0) return;
    if (modalOpen && !def.refresh) return;
    if (def.refresh) def.refresh(); else renderRoute();
  }

  /* ================================ chrome / routing ================================ */
  function updateChrome() {
    if (!S.me) return;
    $('#user-name').textContent = S.me.name;
    $('#user-ava').textContent = C.initials(S.me.name);
    var vn = vrmName(S.me.assignedVrmId);
    $('#user-role').textContent = { admin: 'Administrator', member: 'VRM', reviewer: 'Reviewer (read-only)' }[S.me.role] + (vn && S.me.role === 'admin' ? ' · ' + vn : '');
    buildNav();
    updateToday();
  }
  function updateToday() {
    var t = Date.parse(today() + 'T12:00:00Z');
    $('#today-label').textContent = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(t)) + ' IST';
  }
  function buildNav() {
    var groups = {}, order = [];
    Object.keys(ROUTES).forEach(function (k) {
      var r = ROUTES[k];
      if (!r.group || r.roles.indexOf(S.me.role) < 0) return;
      if (!groups[r.group]) { groups[r.group] = []; order.push(r.group); }
      groups[r.group].push('<a class="navbtn" href="#/' + k + '" data-route="' + k + '"' + (S.route === k ? ' aria-current="page"' : '') + '>' + svg(r.icon) + '<span>' + h(r.title) + '</span></a>');
    });
    $('#nav').innerHTML = order.map(function (g) { return '<div class="navgroup">' + h(g) + '</div>' + groups[g].join(''); }).join('');
  }
  function currentRoute() {
    var r = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return ROUTES[r] ? r : 'dashboard';
  }
  function go(r) { if (location.hash !== '#/' + r) location.hash = '#/' + r; else renderRoute(); }
  function isMobile() { return window.matchMedia('(max-width:1100px)').matches; }
  function setSide(open) {
    var app = $('#app');
    app.classList.toggle('side-open', open);
    $('#menu-btn').setAttribute('aria-expanded', String(open));
    $('#sidebar').inert = !open;
    if (open) { var a = $('#nav a'); if (a) a.focus(); }
  }
  function syncSideMode() {
    var app = $('#app');
    if (isMobile()) { app.classList.remove('side-collapsed'); setSide(false); }
    else { app.classList.remove('side-open'); $('#sidebar').inert = false; $('#menu-btn').setAttribute('aria-expanded', String(!app.classList.contains('side-collapsed'))); }
  }
  function renderRoute() {
    if (!S.me || !S.loaded) return;
    var name = currentRoute(), def = ROUTES[name], main = $('#main');
    S.route = name;
    $('#page-title').textContent = def.title;
    $('#page-sub').textContent = def.sub;
    document.title = def.title + ' · VRM Account MIS';
    $$('#nav a').forEach(function (a) { if (a.getAttribute('data-route') === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    if (isMobile()) setSide(false);
    if (def.roles.indexOf(S.me.role) < 0) {
      main.innerHTML = '<div class="view">' + banner('warn', '<b>Not available for your role.</b> This section is limited to ' + h(def.roles.join(', ')) + ' accounts. The server enforces the same restriction.') + '<a class="btn ghost" href="#/dashboard">Go to the dashboard</a></div>';
    } else {
      main.innerHTML = '<div class="view" id="view"></div>';
      def.render($('#view'));
      applyStyles(main);
      drawCharts();
    }
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  /* ================================ charts ================================ */
  var CHARTS = {};
  function niceStep(x) {
    if (x <= 1) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(x)));
    var steps = [1, 2, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= x) return steps[i] * p;
    return 10 * p;
  }
  function chartPlaceholder(id, series, caption) {
    CHARTS[id] = { series: series, caption: caption };
    return '<div class="chart-wrap" data-chart="' + id + '"></div>';
  }
  function drawCharts() {
    Object.keys(CHARTS).forEach(function (id) {
      var el = $('[data-chart="' + id + '"]');
      if (!el) { delete CHARTS[id]; return; }
      var c = CHARTS[id], series = c.series;
      var total = series.reduce(function (s, x) { return s + x.count; }, 0);
      if (!total) { el.innerHTML = empty('No activations recorded for ' + c.caption + '.', 'trend'); return; }
      var W = Math.max(300, Math.floor(el.clientWidth - 20)), narrow = W < 520;
      var H = narrow ? 220 : 260, pl = 40, pr = 10, pt = 22, pb = 30, pw = W - pl - pr, ph = H - pt - pb;
      var max = Math.max.apply(null, series.map(function (s) { return s.count; }));
      var step = niceStep(max / 4), top = step * 4;
      var band = pw / series.length, bw = Math.min(34, band * 0.6);
      var y = function (v) { return pt + ph - v / top * ph; };
      var x = function (i) { return pl + band * i + band / 2; };
      var out = '';
      for (var g = 0; g <= 4; g++) {
        var gv = step * g;
        out += '<line class="grid" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(gv).toFixed(1) + '" y2="' + y(gv).toFixed(1) + '"/>' +
          '<text class="axis" x="' + (pl - 8) + '" y="' + (y(gv) + 4).toFixed(1) + '" text-anchor="end">' + C.fmtInt(gv) + '</text>';
      }
      series.forEach(function (s, i) {
        var yy = y(s.count);
        out += '<rect class="bar" rx="4" x="' + (x(i) - bw / 2).toFixed(1) + '" y="' + yy.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, pt + ph - yy).toFixed(1) + '"><title>' + h(s.label) + ': ' + C.fmtInt(s.count) + '</title></rect>';
        if (s.count > 0 && (!narrow || band > 22)) out += '<text class="barval" x="' + x(i).toFixed(1) + '" y="' + (yy - 6).toFixed(1) + '">' + C.fmtInt(s.count) + '</text>';
        var lbl = narrow ? s.label.slice(0, 3) : s.label;
        if (!narrow || i % 2 === 0 || series.length <= 6) out += '<text class="axis" x="' + x(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + h(lbl) + '</text>';
      });
      out += '<polyline class="trendline" points="' + series.map(function (s, i) { return x(i).toFixed(1) + ',' + y(s.count).toFixed(1); }).join(' ') + '"/>';
      series.forEach(function (s, i) { out += '<circle class="tdot" r="3" cx="' + x(i).toFixed(1) + '" cy="' + y(s.count).toFixed(1) + '"/>'; });
      var best = series.reduce(function (b, s) { return s.count > b.count ? s : b; }, series[0]);
      el.innerHTML = '<svg class="chart-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
        h('Monthly activations, ' + c.caption + ': total ' + total + ', highest ' + best.label + ' with ' + best.count) + '">' + out + '</svg>';
    });
  }
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { drawCharts(); if ($('#app') && !$('#app').hidden) syncSideMode(); }, 150);
  });

  /* ================================ dashboard ================================ */
  function kpi(k, label, value, cap, icon, isName) {
    return '<div class="kpi ' + k + '"><div class="top"><span class="lbl">' + h(label) + '</span><span class="ic">' + svg(icon) + '</span></div>' +
      '<div class="val' + (isName ? ' name' : '') + '">' + (isName ? h(value) : C.fmtInt(value)) + '</div><div class="cap">' + h(cap) + '</div></div>';
  }
  function freshness() {
    return '<div class="actions meta"><span>Data as of <b>' + h(fmtTs(S.asOf)) + '</b></span>' +
      '<button type="button" class="btn link mini" data-action="refresh">' + svg('refresh') + 'Refresh</button></div>';
  }
  function reportingStatusPill(r) {
    if (r.status !== 'active') return '<span class="badge arch">Archived</span>';
    return r.reporting === 'filed' ? pill('filed', 'Filed') : r.reporting === 'zero' ? pill('zero', 'Confirmed zero') : pill('none', 'Not reported');
  }
  function leaderboardHtml(m, limit) {
    var rows = m.rows.slice().sort(function (a, b) { return b.month - a.month || b.all - a.all || a.name.localeCompare(b.name); });
    if (limit) rows = rows.slice(0, limit);
    if (!rows.length) return empty('No VRMs on the roster yet.', 'users');
    return '<div class="table-scroll short"><table><caption class="sr-only">Month leaderboard</caption><thead><tr><th scope="col">Rank</th><th scope="col">VRM</th><th scope="col" class="num">This month</th><th scope="col" class="hide-sm">Share of team</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        return '<tr><td>' + (r.month > 0 && i < 3 ? '<span class="rank r' + (i + 1) + '">' + (i + 1) + '</span>' : '<span class="rank">' + (i + 1) + '</span>') + '</td><td>' + avatar(r.name) + '</td><td class="num"><b>' + C.fmtInt(r.month) + '</b></td>' +
          '<td class="hide-sm"><div class="sharebar"><div class="track"><div class="fill" data-w="' + (C.pct(r.month, m.teamTotals.month) * 100).toFixed(2) + '"></div></div><span class="pct">' + C.fmtPct(r.month, m.teamTotals.month) + '</span></div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function shareHtml(m) {
    var rows = m.rows.filter(function (r) { return r.month > 0; }).sort(function (a, b) { return b.month - a.month; });
    if (!rows.length) return empty('No activations recorded this month yet.', 'users');
    var total = m.teamTotals.month;
    return '<div class="card-pad"><div class="stackbar" role="img" aria-label="Team share this month">' + rows.map(function (r, i) {
      return '<span data-w="' + (r.month / total * 100).toFixed(3) + '" data-bg="' + PALETTE[i % PALETTE.length] + '" title="' + h(r.name + ': ' + r.month) + '"></span>';
    }).join('') + '</div><div class="legend">' + rows.map(function (r, i) {
      return '<div class="li"><span class="sw" data-bg="' + PALETTE[i % PALETTE.length] + '"></span><span class="ln">' + h(r.name) + '</span><span class="lv">' + C.fmtInt(r.month) + ' · ' + C.fmtPct(r.month, total) + '</span></div>';
    }).join('') + '</div></div>';
  }
  function trendSeries() {
    var tr = S.ui.trend, t = today();
    var years = C.yearsWithData(S.counts, t);
    if (tr.mode !== 'last12' && years.indexOf(tr.mode) < 0) tr.mode = 'last12';
    if (tr.vrmId && !vrmById(tr.vrmId)) tr.vrmId = '';
    var series = C.monthlySeries(S.counts, tr.mode === 'last12' ? { mode: 'last12', today: t, vrmId: tr.vrmId } : { year: tr.mode, today: t, vrmId: tr.vrmId });
    var caption = (tr.vrmId ? vrmName(tr.vrmId) : 'the whole team') + ', ' + (tr.mode === 'last12' ? 'last 12 months' : tr.mode);
    return { series: series, caption: caption, years: years };
  }
  function trendCard() {
    var tr = S.ui.trend, d = trendSeries();
    return '<div class="card"><div class="card-head"><div><h3>Monthly trend</h3><div class="sub">Activations per month by activation date</div></div><div class="actions">' +
      '<label class="sr-only" for="trend-scope">Trend scope</label><select id="trend-scope" data-change="trend">' + opt('', 'Whole team', !tr.vrmId) + vrmOptions(tr.vrmId) + '</select>' +
      '<label class="sr-only" for="trend-range">Trend period</label><select id="trend-range" data-change="trend">' + opt('last12', 'Last 12 months', tr.mode === 'last12') +
      d.years.map(function (y) { return opt(y, 'Calendar year ' + y, tr.mode === y); }).join('') + '</select></div></div>' +
      '<div id="trend-body">' + trendBody(d) + '</div></div>';
  }
  function trendBody(d) {
    return chartPlaceholder('trend', d.series, d.caption) +
      '<div class="chart-legend"><span><span class="sw brand"></span>Activations / month</span><span><span class="sw teal"></span>Trend</span></div>' +
      '<details class="table-alt"><summary>Show the chart data as a table</summary><div class="table-scroll short"><table><caption class="sr-only">Monthly activations, ' + h(d.caption) + '</caption><thead><tr><th scope="col">Month</th><th scope="col" class="num">Activations</th></tr></thead><tbody>' +
      d.series.map(function (s) { return '<tr><td>' + h(C.MONTHS[+s.key.slice(5, 7) - 1] + ' ' + s.key.slice(0, 4)) + '</td><td class="num">' + C.fmtInt(s.count) + '</td></tr>'; }).join('') +
      '</tbody></table></div></details>';
  }
  function renderDashboard(el) {
    var t = today();
    var m = metricsFor(C.resolvePeriod({ year: t.slice(0, 4), month: t.slice(5, 7) }, t), '');
    var tt = m.teamTotals;
    var act = m.rows.filter(function (r) { return r.status === 'active'; });
    var filed = act.filter(function (r) { return r.reporting === 'filed'; }).length;
    var zero = act.filter(function (r) { return r.reporting === 'zero'; }).length;
    var own = S.config.memberScope === 'own' && S.me.role === 'member';
    var html = freshness();
    if (own) html += banner('info', 'Your account shows <b>your own VRM</b> only. Team-wide figures are visible to administrators.');
    html += '<div class="kpis">' +
      kpi('k1', 'Today', tt.today, 'Activations dated ' + C.fmtDate(t), 'clock') +
      kpi('k2', 'This month', tt.month, C.MONTHS[+t.slice(5, 7) - 1] + ' ' + t.slice(0, 4), 'cal') +
      kpi('k3', 'This year', tt.year, 'Calendar year ' + t.slice(0, 4), 'trend') +
      kpi('k4', 'All time', tt.all, 'Every active recorded code', 'check') +
      kpi('k5', 'Active VRMs', m.activeVrmCount, 'On the roster, including zero performers', 'users') + '</div>';
    html += '<p class="hint">“Activation” = one distinct client code accepted for a VRM and activation date. It is an operational proxy, not a back-office account-opening confirmation.</p>';
    html += '<div class="sec"><h2>Today’s reporting</h2><span class="line"></span><span class="badge">' + h(C.fmtDate(t)) + ' IST</span></div>' +
      '<div class="card card-pad"><div class="chips">' +
      '<div class="chip ok"><span class="n">' + filed + '</span><span class="l">Filed (activations recorded)</span></div>' +
      '<div class="chip info"><span class="n">' + zero + '</span><span class="l">Confirmed zero</span></div>' +
      '<div class="chip warn"><span class="n">' + (act.length - filed - zero) + '</span><span class="l">Not reported yet</span></div>' +
      '<div class="chip"><span class="n">' + act.length + '</span><span class="l">Active VRMs</span></div></div>' +
      '<p class="hint">“Not reported” only means nothing has been recorded yet today; it is not evidence of non-compliance.' + (isRole('admin', 'reviewer') ? ' <a href="#/admin">Open the admin overview</a>.' : '') + '</p></div>';
    html += '<div class="sec"><h2>Trend</h2><span class="line"></span></div>' + trendCard();
    html += '<div class="grid2" ><div><div class="sec"><h2>Month leaderboard</h2><span class="line"></span></div><div class="card">' + leaderboardHtml(m) + '</div></div>' +
      '<div><div class="sec"><h2>Team share this month</h2><span class="line"></span></div><div class="card">' + shareHtml(m) + '</div></div></div>';
    html += '<div class="sec"><h2>VRM summary</h2><span class="line"></span><span class="badge">Today · Month · Year</span></div>';
    html += m.rows.length ? '<div class="vgrid">' + m.rows.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (r) {
      return '<div class="vcard"><div class="vh"><span class="ini" data-bg="' + colorFor(r.name) + '" aria-hidden="true">' + h(C.initials(r.name)) + '</span><span class="vn" title="' + h(r.name) + '">' + h(r.name) + '</span>' + reportingStatusPill(r) + '</div>' +
        '<div class="vstats"><div class="s"><div class="n">' + C.fmtInt(r.today) + '</div><div class="l">Today</div></div><div class="s"><div class="n">' + C.fmtInt(r.month) + '</div><div class="l">Month</div></div><div class="s"><div class="n">' + C.fmtInt(r.year) + '</div><div class="l">Year</div></div></div></div>';
    }).join('') + '</div>' : '<div class="card">' + empty('No VRMs on the roster yet.', 'users') + '</div>';
    el.innerHTML = html;
  }

  /* ================================ MIS ================================ */
  function misPeriod() {
    var f = S.ui.mis;
    if (!f.year) f.year = today().slice(0, 4);
    return C.resolvePeriod(f, today());
  }
  function renderMis(el) {
    var f = S.ui.mis, t = today(), years = C.yearsWithData(S.counts, t);
    if (!f.year) f.year = t.slice(0, 4);
    if (f.vrmId && !vrmById(f.vrmId)) f.vrmId = '';
    var rangeOn = !!(f.from || f.to);
    el.innerHTML = freshness() +
      '<div class="card card-pad"><form id="mis-form" data-submit="noop" novalidate><div class="fields">' +
      '<div class="field"><label for="mis-year">Year</label><select id="mis-year" name="year" data-change="mis"' + (rangeOn ? ' disabled aria-describedby="range-note"' : '') + '>' + years.map(function (y) { return opt(y, y, y === f.year); }).join('') + '</select></div>' +
      '<div class="field"><label for="mis-month">Month</label><select id="mis-month" name="month" data-change="mis"' + (rangeOn ? ' disabled aria-describedby="range-note"' : '') + '>' + opt('', 'Whole year', !f.month) + C.MONTHS.map(function (mn, i) { var v = ('0' + (i + 1)).slice(-2); return opt(v, mn, v === f.month); }).join('') + '</select></div>' +
      '<div class="field"><label for="mis-vrm">VRM</label><select id="mis-vrm" name="vrmId" data-change="mis">' + opt('', 'Whole team', !f.vrmId) + vrmOptions(f.vrmId) + '</select></div>' +
      '<div class="field"><label for="mis-from">From date <span class="opt">(optional)</span></label><input type="date" id="mis-from" name="from" min="2000-01-01" value="' + h(f.from) + '" data-change="mis"></div>' +
      '<div class="field"><label for="mis-to">To date <span class="opt">(optional)</span></label><input type="date" id="mis-to" name="to" min="2000-01-01" value="' + h(f.to) + '" data-change="mis"></div>' +
      '<div class="field actions"><button type="button" class="btn ghost" data-action="mis-clear-range"' + (rangeOn ? '' : ' disabled') + '>Clear range</button><button type="button" class="btn ghost" data-action="mis-reset">Reset</button></div>' +
      '</div><p class="hint" id="range-note">' + (rangeOn ? '<b>Date range active.</b> Year and Month are ignored until you clear the range. Both dates are inclusive.' : 'Choose a year and month, or set From/To dates for an exact inclusive range (the range overrides Year and Month).') + '</p></form></div>' +
      '<div id="mis-results"></div>';
    renderMisResults();
  }
  function updateMisControls() {
    var f = S.ui.mis, rangeOn = !!(f.from || f.to);
    ['#mis-year', '#mis-month'].forEach(function (s) {
      var e = $(s); if (!e) return;
      e.disabled = rangeOn;
      if (rangeOn) e.setAttribute('aria-describedby', 'range-note'); else e.removeAttribute('aria-describedby');
    });
    var c = $('[data-action="mis-clear-range"]'); if (c) c.disabled = !rangeOn;
    var n = $('#range-note');
    if (n) n.innerHTML = rangeOn ? '<b>Date range active.</b> Year and Month are ignored until you clear the range. Both dates are inclusive.' : 'Choose a year and month, or set From/To dates for an exact inclusive range (the range overrides Year and Month).';
  }
  function renderMisResults() {
    var box = $('#mis-results');
    if (!box) return;
    var f = S.ui.mis, p = misPeriod();
    var from = $('#mis-from'), to = $('#mis-to');
    if (from) from.setAttribute('aria-invalid', String(!p.ok && !!f.from));
    if (to) to.setAttribute('aria-invalid', String(!p.ok && !!f.to));
    if (!p.ok) {
      box.innerHTML = '<div class="sec"><span class="line"></span></div>' + banner('err', '<b>Report not shown.</b> ' + h(p.error)) +
        '<div class="actions"><button class="btn ghost" type="button" disabled>Export Excel</button><button class="btn ghost" type="button" disabled>Export CSV</button></div>';
      return;
    }
    var m = metricsFor(p, f.vrmId), scope = f.vrmId ? vrmName(f.vrmId) : 'Whole team';
    var contributing = m.rows.filter(function (r) { return r.period > 0; });
    var top = m.rows.slice().sort(function (a, b) { return b.period - a.period; })[0];
    var rows = sortRows(m.rows, f.sortKey, f.sortDir, { name: true });
    var html = '<div class="sec"><h2>' + h(scope) + ' · ' + h(p.label) + '</h2><span class="line"></span>' +
      '<div class="actions"><button type="button" class="btn ghost mini" data-action="mis-export" data-fmt="xlsx">' + svg('download') + 'Export Excel</button>' +
      '<button type="button" class="btn ghost mini" data-action="mis-export" data-fmt="csv">' + svg('download') + 'Export CSV</button>' +
      '<button type="button" class="btn ghost mini" data-action="mis-export" data-fmt="xlsx" data-all="1" title="Every active record, all VRMs, all dates">' + svg('download') + 'All data</button></div></div>';
    html += '<div class="kpis">' + kpi('k1', 'Selected period', m.scopeTotals.period, scope + ' · ' + p.label, 'cal') +
      (f.vrmId ? kpi('k2', 'Team in period', m.teamTotals.period, 'Share ' + C.fmtPct(m.scopeTotals.period, m.teamTotals.period), 'users') : kpi('k2', 'Contributing VRMs', contributing.length, 'of ' + m.rows.length + ' listed', 'users')) +
      kpi('k3', 'Top in period', top && top.period > 0 ? top.name : '—', top && top.period > 0 ? C.fmtInt(top.period) + ' activations' : 'No activations in this period', 'trophy', true) + '</div>';
    html += '<div class="sec"><h2>VRM wise summary</h2><span class="line"></span><span class="badge">' + m.rows.length + ' VRM' + (m.rows.length === 1 ? '' : 's') + '</span></div>';
    html += '<div class="card"><div class="table-scroll"><table><caption>Today, month and year columns are fixed calendar periods (IST). “Selected period” follows the filters above.</caption><thead><tr>' +
      sortTh('mis', 'name', 'VRM', f.sortKey, f.sortDir) + sortTh('mis', 'today', 'Today', f.sortKey, f.sortDir, 'num') + sortTh('mis', 'month', 'Month', f.sortKey, f.sortDir, 'num') +
      sortTh('mis', 'year', 'Year', f.sortKey, f.sortDir, 'num') + sortTh('mis', 'all', 'All time', f.sortKey, f.sortDir, 'num') +
      sortTh('mis', 'period', 'Selected period', f.sortKey, f.sortDir, 'num') + sortTh('mis', 'share', 'Share of period', f.sortKey, f.sortDir) + '</tr></thead><tbody>' +
      (rows.length ? rows.map(function (r) {
        return '<tr><td>' + avatar(r.name, r.status === 'archived' ? ' <span class="badge arch">Archived</span>' : '') + '</td><td class="num">' + C.fmtInt(r.today) + '</td><td class="num">' + C.fmtInt(r.month) + '</td><td class="num">' + C.fmtInt(r.year) + '</td><td class="num">' + C.fmtInt(r.all) +
          '</td><td class="num"><b>' + C.fmtInt(r.period) + '</b></td><td><div class="sharebar"><div class="track"><div class="fill" data-w="' + (r.share * 100).toFixed(2) + '"></div></div><span class="pct">' + C.fmtPct(r.period, m.teamTotals.period) + '</span></div></td></tr>';
      }).join('') : '<tr><td colspan="7">' + empty('No VRMs to show.', 'users') + '</td></tr>') +
      '</tbody><tfoot><tr><td>' + (f.vrmId ? h(scope) + ' total' : 'Team total') + '</td><td class="num">' + C.fmtInt(m.scopeTotals.today) + '</td><td class="num">' + C.fmtInt(m.scopeTotals.month) + '</td><td class="num">' + C.fmtInt(m.scopeTotals.year) +
      '</td><td class="num">' + C.fmtInt(m.scopeTotals.all) + '</td><td class="num">' + C.fmtInt(m.scopeTotals.period) + '</td><td>' + (f.vrmId ? C.fmtPct(m.scopeTotals.period, m.teamTotals.period) + ' of team' : (m.teamTotals.period ? '100%' : '0%')) + '</td></tr></tfoot></table></div></div>';
    if (!f.vrmId && m.rows.length) {
      var max = Math.max.apply(null, m.rows.map(function (r) { return r.period; }).concat([1]));
      html += '<div class="sec"><h2>Period by VRM</h2><span class="line"></span></div><div class="card card-pad"><div class="fbig"><span class="n">' + C.fmtInt(m.teamTotals.period) + '</span><span class="cap">activations — whole team, ' + h(p.label) + '</span></div><div class="fbars">' +
        m.rows.slice().sort(function (a, b) { return b.period - a.period || a.name.localeCompare(b.name); }).map(function (r) {
          return '<div class="fbar"><span class="fn" title="' + h(r.name) + '">' + h(r.name) + '</span><span class="track"><span class="fill" data-w="' + (r.period / max * 100).toFixed(2) + '"></span></span><span class="fv">' + C.fmtInt(r.period) + '</span></div>';
        }).join('') + '</div></div>';
    }
    box.innerHTML = html;
    applyStyles(box);
  }
  function exportReport(btn, filter, meta, fmt) {
    busy(btn, true);
    var expected = meta.expected;
    return Promise.all([fmt === 'xlsx' ? loadXLSX() : Promise.resolve(null), Api.call('exportReport', { filter: filter }, { timeout: 120000 })]).then(function (res) {
      var XLSX = res[0], exp = res[1];
      var note = '';
      if (exp.total !== expected) {
        note = 'The server has newer data than your screen (' + exp.total + ' vs ' + expected + ' rows). The file uses the latest server data and the screen has been refreshed.';
        refreshData({ quiet: true });
      }
      var base = 'VRM-MIS_' + slug(meta.scope) + '_' + slug(meta.period) + '_asof-' + stamp();
      if (fmt === 'csv') downloadCsv(exportCsvRows(exp, meta), base + '.csv');
      else download(new Blob([XLSX.write(exportWorkbook(XLSX, exp, meta), { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), base + '.xlsx');
      if (note) toast(note, 'warn', 9000); else toast('Exported ' + C.fmtInt(exp.total) + ' record' + (exp.total === 1 ? '' : 's') + ' (summary and detail reconcile).', 'ok');
    }).catch(function (e) { toast('Export failed: ' + errMsg(e), 'err'); }).then(function () { busy(btn, false); });
  }
  function exportMeta(exp, meta) {
    return [['VRM Account MIS — client-code activation report'], ['Scope', meta.scope], ['Period', meta.period],
      ['Bounds (inclusive)', exp.period.kind === 'all' ? 'All dates' : (exp.period.from === '0000-01-01' ? 'earliest' : exp.period.from) + ' to ' + (exp.period.to === '9999-12-31' ? 'latest' : exp.period.to)],
      ['Data as of', fmtTs(exp.asOf)], ['Generated by', S.me.name], ['Total activations', exp.total],
      ['Definition', 'Each distinct accepted client code counts once (activation proxy; not verified against back-office account opening).']];
  }
  function exportCsvRows(exp, meta) {
    var rows = exportMeta(exp, meta).concat([[], ['Summary'], ['VRM', 'Status', 'Activations', 'Share of period']]);
    exp.summary.forEach(function (s) { rows.push([s.vrmName, s.status, s.count, C.fmtPct(s.count, exp.total)]); });
    rows.push(['TOTAL', '', exp.total, exp.total ? '100%' : '0%'], [], ['Detail'], ['Activation date', 'VRM', 'Client code', 'Source', 'Import batch', 'Recorded by', 'Recorded at (IST)']);
    exp.detail.forEach(function (d) { rows.push([d.date, d.vrmName, d.code, d.source, d.batchId, d.createdBy, fmtTs(d.createdAt)]); });
    return rows;
  }
  function exportWorkbook(XLSX, exp, meta) {
    var wb = XLSX.utils.book_new();
    var info = XLSX.utils.aoa_to_sheet(exportMeta(exp, meta));
    info['!cols'] = [{ wch: 22 }, { wch: 70 }];
    var sum = XLSX.utils.aoa_to_sheet([['VRM', 'Status', 'Activations', 'Share of period']].concat(exp.summary.map(function (s) {
      return [s.vrmName, s.status, s.count, exp.total ? s.count / exp.total : 0];
    })).concat([['TOTAL', '', exp.total, exp.total ? 1 : 0]]));
    for (var r = 1; r <= exp.summary.length + 1; r++) { var c = sum[XLSX.utils.encode_cell({ r: r, c: 3 })]; if (c) c.z = '0.0%'; }
    sum['!cols'] = [{ wch: 26 }, { wch: 10 }, { wch: 12 }, { wch: 16 }];
    var det = XLSX.utils.aoa_to_sheet([['Activation date', 'VRM', 'Client code', 'Source', 'Import batch', 'Recorded by', 'Recorded at (IST)']].concat(exp.detail.map(function (d) {
      return [d.date, d.vrmName, d.code, d.source, d.batchId, d.createdBy, fmtTs(d.createdAt)];
    })));
    for (var i = 1; i <= exp.detail.length; i++) {
      [0, 2].forEach(function (col) { var cell = det[XLSX.utils.encode_cell({ r: i, c: col })]; if (cell) { cell.t = 's'; cell.z = '@'; } });
    }
    det['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 38 }, { wch: 20 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, info, 'Report');
    XLSX.utils.book_append_sheet(wb, sum, 'Summary');
    XLSX.utils.book_append_sheet(wb, det, 'Detail');
    return wb;
  }

  /* ================================ Analysis & Input ================================ */
  function renderInput(el) {
    var u = S.ui.input, me = S.me, t = today();
    if (!u.date || u.date > t) u.date = t;
    var writable = activeVrms().filter(function (v) { return canWrite(v.id); }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (!u.vrmId || !writable.some(function (v) { return v.id === u.vrmId; })) {
      u.vrmId = me.assignedVrmId && writable.some(function (v) { return v.id === me.assignedVrmId; }) ? me.assignedVrmId : (writable[0] ? writable[0].id : '');
    }
    var html = '';
    if (me.role === 'member' && !writable.length) {
      html += banner('err', '<b>Your account is not linked to an active VRM.</b> Ask an administrator to link it before recording activations.');
    }
    var vrmField = me.role === 'member'
      ? '<div class="field"><span class="label" id="in-vrm-l">VRM</span><div class="locked" aria-labelledby="in-vrm-l">' + svg('lock') + h(vrmName(u.vrmId) || 'Not linked') + '</div><p class="hint">Members record for their own VRM only.</p></div>'
      : '<div class="field"><label for="in-vrm">VRM</label><select id="in-vrm" data-change="input-vrm">' + (writable.length ? writable.map(function (v) { return opt(v.id, v.name, v.id === u.vrmId); }).join('') : opt('', 'No active VRMs', true)) + '</select></div>';
    html += '<div class="grid2"><div class="card"><div class="card-head"><div><h3>Record activations</h3><div class="sub">Each client code becomes one activation record</div></div></div><div class="card-pad">' +
      '<form id="in-form" data-submit="save-codes" novalidate><div class="fields">' + vrmField +
      '<div class="field"><label for="in-date">Activation date</label><input type="date" id="in-date" name="date" min="2000-01-01" max="' + t + '" value="' + h(u.date) + '" data-change="input-date" required><p class="hint">Defaults to today (IST). Back-dating is allowed; future dates are not.</p></div></div>' +
      '<div class="field"><label for="in-codes">Client code(s)</label><textarea id="in-codes" rows="6" spellcheck="false" autocomplete="off" data-input="paste" aria-describedby="paste-stats in-help" placeholder="Paste one or many codes separated by commas, semicolons or new lines&#10;e.g. 000123, CL10235; CL10240">' + h(u.text) + '</textarea>' +
      '<div class="paste-stats" id="paste-stats" aria-live="polite"></div>' +
      '<p class="hint" id="in-help">Leading zeros are kept. Matching ignores case and surrounding spaces. A code already recorded anywhere — for any VRM or date — is not added again.</p></div>' +
      '<div class="actions"><button type="submit" class="btn" id="in-save"' + (u.vrmId ? '' : ' disabled') + '>' + svg('check') + '<span class="lbl">Save codes</span></button>' +
      '<button type="button" class="btn ghost" data-action="input-clear">Clear</button>' +
      '<a class="btn link" href="#/lookup">Check codes first</a></div></form>' +
      '<div id="in-result" aria-live="polite"></div></div></div>' +
      '<div class="stack"><div class="card"><div class="card-head"><div><h3>Daily status</h3><div class="sub">Filed, confirmed zero or not reported</div></div></div><div class="card-pad" id="in-status"></div></div>' +
      '<div class="card card-pad"><h3 class="label">Bulk files</h3><p class="hint">Importing a spreadsheet? Use the import screen for a full preview, column mapping and an exception report.</p><a class="btn ghost" href="#/import">' + svg('upload') + 'Excel / CSV import</a></div></div></div>';
    el.innerHTML = html;
    updatePasteStats();
    renderInputResult();
    renderInputStatus();
  }
  function refreshInputPanels() { renderInputStatus(); var d = $('#in-date'); if (d) d.max = today(); }
  function updatePasteStats() {
    var ta = $('#in-codes'), box = $('#paste-stats');
    if (!ta || !box) return;
    var a = C.analyzePaste(ta.value);
    var s = a.summary;
    box.innerHTML = s.tokens ? '<span><b>' + s.tokens + '</b> entered</span><span><b>' + s.unique + '</b> unique</span>' + (s.duplicateInPaste ? '<span><b>' + s.duplicateInPaste + '</b> repeated in paste</span>' : '') + (s.invalid ? '<span><b>' + s.invalid + '</b> invalid format</span>' : '') + (s.tokens > C.MAX_ROWS ? '<span class="field-error">Maximum ' + C.MAX_ROWS + ' per submission</span>' : '') : '<span>No codes entered yet.</span>';
    var lbl = $('#in-save .lbl');
    if (lbl) lbl.textContent = s.unique ? 'Save ' + s.unique + ' code' + (s.unique === 1 ? '' : 's') : 'Save codes';
  }
  function renderInputStatus() {
    var box = $('#in-status'), u = S.ui.input;
    if (!box) return;
    if (!u.vrmId) { box.innerHTML = empty('Select a VRM to see its status.', 'info'); return; }
    var n = countFor(u.vrmId, u.date), z = hasZero(u.vrmId, u.date), nm = vrmName(u.vrmId), w = canWrite(u.vrmId);
    var status = n > 0 ? pill('filed', 'Filed') : z ? pill('zero', 'Confirmed zero') : pill('none', 'Not reported');
    var text = n > 0 ? C.fmtInt(n) + ' activation' + (n === 1 ? '' : 's') + ' recorded for ' + h(nm) + ' on ' + h(C.fmtDate(u.date)) + '.'
      : z ? h(nm) + ' confirmed zero activations for ' + h(C.fmtDate(u.date)) + '.' : 'Nothing recorded for ' + h(nm) + ' on ' + h(C.fmtDate(u.date)) + ' yet.';
    var btn = '';
    if (w && n === 0 && !z) btn = '<button type="button" class="btn ghost" data-action="zero-report">' + svg('zero') + 'Report zero for this date</button>';
    if (w && z && n === 0) btn = '<button type="button" class="btn ghost" data-action="zero-withdraw">Withdraw zero report</button>';
    box.innerHTML = '<div class="status-panel"><div>' + status + '</div><div class="grow">' + text + '</div>' + btn + '</div>' +
      '<p class="hint">A zero report records that the VRM had no activations on that date. It never adds an activation and cannot be filed once activations exist.</p>';
  }
  function renderInputResult() {
    var box = $('#in-result'), u = S.ui.input;
    if (!box) return;
    var r = u.result;
    if (!r) { box.innerHTML = ''; return; }
    if (r.uncertain) {
      box.innerHTML = '<div class="result-box">' + banner('warn', '<b>Not confirmed.</b> ' + h(r.message) + ' Your codes are kept below. “Retry safely” re-sends the same request; the server saves each code at most once.') +
        '<div class="actions"><button type="button" class="btn" data-action="input-retry">' + svg('refresh') + 'Retry safely</button><button type="button" class="btn ghost" data-action="input-discard">Discard</button></div></div>';
      return;
    }
    if (r.error) { box.innerHTML = '<div class="result-box">' + banner('err', '<b>Nothing was saved.</b> ' + h(r.error)) + '</div>'; return; }
    var s = r.summary, shown = r.showAll ? r.results : r.results.filter(function (x) { return x.status !== 'ADDED'; });
    box.innerHTML = '<div class="result-box"><h4>' + (s.added ? 'Saved ' + s.added + ' of ' + s.received : 'No new codes saved') + ' — ' + h(r.vrmName) + ', ' + h(C.fmtDate(r.date)) + (r.replayed ? ' <span class="badge">confirmed after retry</span>' : '') + '</h4>' +
      '<div class="chips"><div class="chip ok"><span class="n">' + s.added + '</span><span class="l">Added</span></div>' +
      '<div class="chip info"><span class="n">' + s.duplicateInPaste + '</span><span class="l">Repeated in paste</span></div>' +
      '<div class="chip warn"><span class="n">' + s.duplicateExisting + '</span><span class="l">Already recorded</span></div>' +
      '<div class="chip err"><span class="n">' + s.invalid + '</span><span class="l">Invalid</span></div>' +
      '<div class="chip err"><span class="n">' + (s.failed || 0) + '</span><span class="l">Failed</span></div></div>' +
      (s.recovered ? '<p class="hint">' + s.recovered + ' code(s) had already been saved by an interrupted earlier attempt and were confirmed, not duplicated.</p>' : '') +
      (r.results && r.results.length ? '<div class="divider"></div><div class="actions"><button type="button" class="btn ghost mini" data-action="input-toggle-all">' + (r.showAll ? 'Show problems only' : 'Show all ' + r.results.length) + '</button><button type="button" class="btn ghost mini" data-action="input-result-csv">' + svg('download') + 'Download result CSV</button></div>' : '') +
      (shown && shown.length ? '<div class="table-scroll short"><table><thead><tr><th scope="col">Code</th><th scope="col">Result</th><th scope="col">Detail</th></tr></thead><tbody>' + shown.map(function (x) {
        return '<tr><td><span class="code-pill">' + h(x.input || '(blank)') + '</span></td><td>' + pill(x.status) + '</td><td class="wrap-cell">' + h(x.reason || '') + (x.owner ? ' Existing record: <b>' + h(x.owner.vrmName) + '</b>, ' + h(C.fmtDate(x.owner.date)) + (x.owner.status === 'deleted' ? ' (deleted)' : '') + '.' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : (r.results && r.results.length ? '<p class="hint">Every code was added.</p>' : '')) + '</div>';
  }
  function submitPendingCodes() {
    var u = S.ui.input, btn = $('#in-save');
    if (!u.pending || u.busy) return;
    u.busy = true;
    busy(btn, true);
    var p = u.pending;
    Api.call('addEntries', p.payload, { requestId: p.requestId, timeout: 90000 }).then(function (res) {
      u.result = { summary: res.summary, results: res.results, vrmName: vrmName(p.payload.vrmId), date: p.payload.date, replayed: !!res.replayed };
      u.pending = null;
      u.text = '';
      var ta = $('#in-codes'); if (ta) ta.value = '';
      updatePasteStats();
      announce('Saved ' + res.summary.added + ' of ' + res.summary.received + ' codes.');
      toast('Saved ' + res.summary.added + ' code' + (res.summary.added === 1 ? '' : 's') + (res.summary.received - res.summary.added ? '; ' + (res.summary.received - res.summary.added) + ' not added (see details)' : '') + '.', res.summary.added ? 'ok' : 'warn');
      refreshData({ quiet: true });
    }, function (e) {
      if (e.uncertain) u.result = { uncertain: true, message: e.message };
      else { u.result = { error: errMsg(e) }; u.pending = null; }
    }).then(function () {
      u.busy = false;
      busy($('#in-save'), false);
      renderInputResult();
    });
  }

  /* ================================ Lookup & ledger ================================ */
  function renderLookup(el) {
    var L = S.ui.ledger, admin = isRole('admin', 'reviewer');
    el.innerHTML = '<div class="card"><div class="card-head"><div><h3>Client-code lookup</h3><div class="sub">Check whether codes are already recorded — before you enter or import them</div></div></div><div class="card-pad">' +
      '<form id="lk-form" data-submit="lookup" novalidate><div class="field"><label for="lk-codes">Client code(s)</label><textarea id="lk-codes" rows="2" spellcheck="false" placeholder="One or many codes, separated by commas, semicolons or new lines">' + h(S.ui.lookup.text) + '</textarea></div>' +
      '<div class="actions"><button type="submit" class="btn" id="lk-btn">' + svg('search') + 'Look up</button><button type="button" class="btn ghost" data-action="lookup-clear">Clear</button></div></form><div id="lk-results" aria-live="polite"></div></div></div>' +
      '<div class="sec"><h2>Activation ledger</h2><span class="line"></span></div>' +
      '<div class="card"><form class="card-pad" id="ledger-form" data-submit="ledger" novalidate><div class="fields">' +
      '<div class="field"><label for="lg-q">Code contains</label><input id="lg-q" name="q" value="' + h(L.q) + '" autocomplete="off" spellcheck="false"></div>' +
      '<div class="field"><label for="lg-vrm">VRM</label><select id="lg-vrm" name="vrmId">' + opt('', 'All VRMs', !L.vrmId) + vrmOptions(L.vrmId) + '</select></div>' +
      '<div class="field"><label for="lg-from">From</label><input type="date" id="lg-from" name="from" value="' + h(L.from) + '"></div>' +
      '<div class="field"><label for="lg-to">To</label><input type="date" id="lg-to" name="to" value="' + h(L.to) + '"></div>' +
      '<div class="field"><label for="lg-batch">Import batch ID</label><input id="lg-batch" name="batchId" value="' + h(L.batchId) + '" autocomplete="off" spellcheck="false"></div>' +
      (admin ? '<div class="field"><label for="lg-status">Status</label><select id="lg-status" name="status">' + opt('active', 'Active', L.status === 'active') + opt('deleted', 'Deleted', L.status === 'deleted') + opt('all', 'All', L.status === 'all') + '</select></div>' : '') +
      '<div class="field"><label for="lg-size">Rows per page</label><select id="lg-size" name="pageSize">' + [25, 50, 100, 200].map(function (n) { return opt(String(n), String(n), n === L.pageSize); }).join('') + '</select></div>' +
      '<div class="field actions"><button type="submit" class="btn">Apply</button><button type="button" class="btn ghost" data-action="ledger-reset">Reset</button></div></div></form>' +
      '<div id="ledger-body"></div></div>';
    renderLookupResults();
    loadLedger();
  }
  function renderLookupResults() {
    var box = $('#lk-results'), r = S.ui.lookup.results;
    if (!box) return;
    if (!r) { box.innerHTML = ''; return; }
    if (r.error) { box.innerHTML = banner('err', h(r.error)); return; }
    var counts = {};
    r.forEach(function (x) { counts[x.status] = (counts[x.status] || 0) + 1; });
    var label = { available: 'Available', taken: 'Already recorded', reserved: 'Reserved (deleted record)', repeated: 'Repeated in list', invalid: 'Invalid format' };
    box.innerHTML = '<div class="divider"></div><div class="chips">' + Object.keys(label).filter(function (k) { return counts[k]; }).map(function (k) {
      return '<div class="chip ' + (k === 'available' ? 'ok' : k === 'invalid' ? 'err' : k === 'taken' ? 'warn' : 'info') + '"><span class="n">' + counts[k] + '</span><span class="l">' + label[k] + '</span></div>';
    }).join('') + '</div><div class="table-scroll short"><table><thead><tr><th scope="col">Code</th><th scope="col">Status</th><th scope="col">Recorded for</th></tr></thead><tbody>' + r.map(function (x) {
      return '<tr><td><span class="code-pill">' + h(x.input) + '</span></td><td>' + pill(x.status, label[x.status]) + '</td><td class="wrap-cell">' +
        (x.owner ? '<b>' + h(x.owner.vrmName) + '</b> · ' + h(C.fmtDate(x.owner.date)) : x.status === 'taken' || x.status === 'reserved' ? '<span class="meta">Owner not shown for your role</span>' : h(x.reason || '')) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function ledgerParams() {
    var L = S.ui.ledger;
    var p = { page: L.page, pageSize: L.pageSize, sort: L.sort, dir: L.dir };
    ['q', 'vrmId', 'from', 'to', 'batchId'].forEach(function (k) { if (L[k]) p[k] = L[k]; });
    if (isRole('admin', 'reviewer')) p.status = L.status;
    return p;
  }
  function loadLedger() {
    var L = S.ui.ledger, box = $('#ledger-body');
    if (!box) return;
    if (L.from && L.to && L.from > L.to) { box.innerHTML = '<div class="card-pad">' + banner('err', 'From date is after To date.') + '</div>'; return; }
    L.loading = true;
    box.innerHTML = '<div class="loading-row" role="status">Loading entries…</div>';
    Api.call('queryEntries', ledgerParams()).then(function (d) { L.data = d; L.error = ''; }, function (e) { L.data = null; L.error = errMsg(e); }).then(function () { L.loading = false; renderLedgerBody(); });
  }
  function renderLedgerBody() {
    var L = S.ui.ledger, box = $('#ledger-body'), d = L.data, admin = isRole('admin');
    if (!box) return;
    if (L.error) { box.innerHTML = '<div class="card-pad">' + banner('err', 'Could not load the ledger: ' + h(L.error)) + '<button type="button" class="btn ghost" data-action="ledger-reload">Retry</button></div>'; return; }
    if (!d) return;
    if (!d.items.length) { box.innerHTML = empty(L.q || L.vrmId || L.from || L.to || L.batchId || L.status !== 'active' ? 'No entries match these filters.' : 'No activations recorded yet.', 'file'); return; }
    box.innerHTML = '<div class="table-scroll"><table><caption class="sr-only">Activation ledger</caption><thead><tr>' + sortTh('ledger', 'date', 'Date', L.sort, L.dir) + sortTh('ledger', 'vrm', 'VRM', L.sort, L.dir) + sortTh('ledger', 'code', 'Client code', L.sort, L.dir) +
      '<th scope="col">Status</th><th scope="col" class="hide-sm">Source</th><th scope="col" class="hide-sm">Recorded by</th>' + sortTh('ledger', 'created', 'Recorded at', L.sort, L.dir, 'hide-sm') + (admin ? '<th scope="col">Actions</th>' : '') + '</tr></thead><tbody>' +
      d.items.map(function (e) {
        var acts = '';
        if (admin) {
          acts = e.status === 'active'
            ? '<button type="button" class="btn ghost mini" data-action="entry-correct" data-id="' + h(e.id) + '">Correct</button> <button type="button" class="btn ghost mini" data-action="entry-delete" data-id="' + h(e.id) + '">Delete</button>'
            : '<button type="button" class="btn ghost mini" data-action="entry-restore" data-id="' + h(e.id) + '">Restore</button>';
        }
        return '<tr><td class="nowrap">' + h(C.fmtDate(e.date)) + (e.backdated ? ' <span class="badge" title="Recorded after the activation date">Backdated</span>' : '') + '</td><td>' + avatar(e.vrmName) + '</td><td><span class="code-pill">' + h(e.code) + '</span></td><td>' + pill(e.status, e.status === 'active' ? 'Active' : 'Deleted') +
          (e.deleteReason ? '<div class="meta">' + h(e.deleteReason) + '</div>' : '') + '</td><td class="hide-sm">' + h(e.source) + (e.batchId ? ' <button type="button" class="btn link mini" data-action="ledger-batch" data-batch="' + h(e.batchId) + '" title="' + h(e.batchId) + '">batch ' + h(e.batchId.slice(0, 8)) + '</button>' : '') +
          '</td><td class="hide-sm">' + h(e.createdBy) + '</td><td class="hide-sm nowrap">' + h(fmtTs(e.createdAt)) + '</td>' + (admin ? '<td class="nowrap">' + acts + '</td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>' + pager(d, 'ledger-page');
    applyStyles(box);
  }
  function entryFromLedger(id) { var d = S.ui.ledger.data; return d ? d.items.filter(function (e) { return e.id === id; })[0] : null; }
  function afterEntryChange(msg) { toast(msg, 'ok'); loadLedger(); refreshData({ quiet: true }); }

  /* ================================ Import ================================ */
  function newImport() {
    return { step: 1, fileName: '', fileSize: 0, wb: null, sheet: '', sheetNames: [], grid: null, date1904: false, warnings: [],
      mode: 'structured', headerRow: 0, map: { vrm: -1, date: -1, code: -1 }, listCol: 0, listHeader: true, listVrmId: '', listDate: '',
      dateOrder: 'auto', includeNumeric: false, parsed: null, preview: null, approve: {}, filter: 'all', page: 1, commit: null, error: '', busy: false };
  }
  function renderImport(el) {
    var im = S.ui.imp;
    var steps = ['Choose file', 'Map columns', 'Preview', 'Import', 'Results'];
    el.innerHTML = '<ol class="steps" aria-label="Import steps">' + steps.map(function (s, i) {
      return '<li' + (im.step === i + 1 ? ' aria-current="step"' : im.step > i + 1 ? ' class="done"' : '') + '>' + h(s) + '</li>';
    }).join('') + '</ol><div id="imp-body"></div>';
    renderImportBody();
  }
  function renderImportBody() {
    var box = $('#imp-body'), im = S.ui.imp;
    if (!box) return;
    var fn = [null, impStep1, impStep2, impStep3, impStep4, impStep5][im.step];
    box.innerHTML = fn();
    applyStyles(box);
    if (im.step === 1) bindDrop();
  }
  function impStep1() {
    var im = S.ui.imp;
    return (im.error ? banner('err', h(im.error)) : '') +
      '<div class="grid2"><div class="card card-pad"><div class="drop" id="imp-drop"><span>' + svg('upload') + '</span><div class="dt"><label for="imp-file">Choose a .xlsx, .xls or .csv file</label></div><div class="ds">or drop it here · up to 10 MB · the file stays in your browser; only rows are sent</div>' +
      '<input type="file" id="imp-file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" data-change="import-file"' + (im.busy ? ' disabled' : '') + '></div>' +
      (im.busy ? '<p class="hint" role="status">Reading file…</p>' : '') + '</div>' +
      '<div class="card card-pad"><h3 class="label">Accepted layouts</h3><ul class="hint"><li><b>Structured:</b> columns <b>VRM</b>, <b>Date</b>, <b>Client Code</b> (exact header aliases such as “RM Name”, “Activation Date”, “UCC” are recognised; anything else you map yourself).</li>' +
      '<li><b>Single column:</b> a list of client codes, attached to one VRM and date that you choose.</li><li>Dates: Excel dates, <b>YYYY-MM-DD</b> or <b>DD/MM/YYYY</b>. Ambiguous dates are flagged, never guessed.</li><li>Format the code column as <b>Text</b> in Excel so leading zeros survive.</li></ul>' +
      '<div class="actions"><button type="button" class="btn ghost mini" data-action="template" data-fmt="xlsx">' + svg('download') + 'Excel template</button><button type="button" class="btn ghost mini" data-action="template" data-fmt="csv">' + svg('download') + 'CSV template</button></div></div></div>';
  }
  function bindDrop() {
    var d = $('#imp-drop');
    if (!d) return;
    ['dragenter', 'dragover'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.add('drag'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.preventDefault(); d.classList.remove('drag'); }); });
    d.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) readImportFile(f); });
  }
  function readImportFile(file) {
    var im = S.ui.imp, ext = (file.name.split('.').pop() || '').toLowerCase();
    im.error = '';
    if (['csv', 'xlsx', 'xls'].indexOf(ext) < 0) { im.error = 'Unsupported file type ".' + ext + '". Choose a .xlsx, .xls or .csv file.'; renderImportBody(); return; }
    if (file.size > MAX_FILE_BYTES) { im.error = 'The file is larger than 10 MB. Split it into smaller files.'; renderImportBody(); return; }
    if (!file.size) { im.error = 'The file is empty.'; renderImportBody(); return; }
    im.busy = true;
    renderImportBody();
    Promise.all([loadXLSX(), file.arrayBuffer()]).then(function (res) {
      var XLSX = res[0], buf = res[1], wb, warnings = [];
      if (ext === 'csv') {
        var text;
        try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf); }
        catch (e) { text = new TextDecoder('windows-1252').decode(buf); warnings.push('The file is not UTF-8 encoded; it was read as Windows-1252. Check names with accented characters.'); }
        wb = XLSX.read(text.replace(/^﻿/, ''), { type: 'string', raw: true });
      } else {
        wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: false, cellNF: true, cellText: true });
      }
      var names = wb.SheetNames.filter(function (n) { return wb.Sheets[n] && wb.Sheets[n]['!ref']; });
      if (!names.length) throw new Error('No worksheet in this file contains data.');
      im.wb = wb; im.fileName = file.name; im.fileSize = file.size; im.sheetNames = names; im.warnings = warnings;
      im.date1904 = !!(wb.Workbook && wb.Workbook.WBProps && wb.Workbook.WBProps.date1904);
      selectSheet(names[0]);
      im.step = 2;
    }).catch(function (e) {
      im.error = /password|encrypt/i.test(errMsg(e)) ? 'This file is password-protected. Remove the password and try again.' : 'Could not read this file: ' + errMsg(e);
    }).then(function () {
      im.busy = false;
      if (S.route === 'import') renderImport($('#view'));
    });
  }
  function selectSheet(name) {
    var im = S.ui.imp;
    im.sheet = name;
    im.grid = C.sheetToGrid(window.XLSX, im.wb.Sheets[name]);
    var first = 0;
    while (first < im.grid.length && im.grid[first].every(function (c) { return !c || C.cellText(c).trim() === ''; })) first++;
    im.headerRow = Math.min(first, Math.max(0, im.grid.length - 1));
    var headers = (im.grid[im.headerRow] || []).map(C.cellText);
    im.map = C.autoMapHeaders(headers);
    var nonEmptyCols = headers.map(function (x, i) { return i; }).filter(function (i) { return im.grid.some(function (r) { return r[i] && C.cellText(r[i]).trim(); }); });
    var full = im.map.vrm >= 0 && im.map.date >= 0 && im.map.code >= 0;
    im.mode = !full && nonEmptyCols.length === 1 ? 'list' : 'structured';
    im.listCol = nonEmptyCols[0] || 0;
    im.listHeader = C.HEADER_ALIASES.code.indexOf(C.normHeader(headers[im.listCol])) >= 0;
    if (!im.listVrmId || !canWrite(im.listVrmId)) im.listVrmId = S.me.role === 'member' ? S.me.assignedVrmId : (S.me.assignedVrmId || (activeVrms()[0] || {}).id || '');
    if (!im.listDate) im.listDate = today();
    im.parsed = null; im.preview = null; im.approve = {};
  }
  function colLabel(i, headers) {
    var letters = '', n = i;
    do { letters = String.fromCharCode(65 + (n % 26)) + letters; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return 'Column ' + letters + (headers[i] ? ': ' + String(headers[i]).slice(0, 40) : '');
  }
  function impStep2() {
    var im = S.ui.imp, grid = im.grid || [];
    var headers = (grid[im.headerRow] || []).map(C.cellText);
    var width = grid.reduce(function (w, r) { return Math.max(w, r.length); }, 0);
    var cols = Array.from({ length: width }, function (_, i) { return i; });
    var colOpts = function (sel) { return opt('-1', '— Choose a column —', sel < 0) + cols.map(function (i) { return opt(String(i), colLabel(i, im.mode === 'list' && !im.listHeader ? [] : headers), i === sel); }).join(''); };
    var dataStart = im.mode === 'list' ? (im.listHeader ? im.headerRow + 1 : im.headerRow) : im.headerRow + 1;
    var sample = grid.slice(dataStart, dataStart + 5);
    var html = (im.warnings.length ? banner('warn', im.warnings.map(h).join('<br>')) : '') + (im.error ? banner('err', h(im.error)) : '') +
      '<div class="card card-pad"><div class="actions"><span class="badge">' + svg('file') + h(im.fileName) + '</span><span class="meta">' + C.fmtInt(Math.round(im.fileSize / 1024)) + ' KB · ' + C.fmtInt(Math.max(0, grid.length - dataStart)) + ' rows after the header</span>' +
      '<button type="button" class="btn link mini" data-action="import-restart">Choose a different file</button></div><div class="divider"></div>' +
      '<form id="imp-map" data-submit="import-preview" novalidate>' +
      (im.sheetNames.length > 1 ? '<div class="fields"><div class="field"><label for="imp-sheet">Worksheet</label><select id="imp-sheet" data-change="import-sheet">' + im.sheetNames.map(function (n) { return opt(n, n, n === im.sheet); }).join('') + '</select><p class="hint">This file has ' + im.sheetNames.length + ' worksheets with data. Only the selected one is imported.</p></div></div>' : '') +
      '<fieldset class="field"><legend class="label">Layout</legend><div class="radios">' +
      '<label class="radio-card"><input type="radio" name="mode" value="structured" data-change="import-mode"' + (im.mode === 'structured' ? ' checked' : '') + '><span><b>VRM, Date and Client Code columns</b><span>Each row carries its own VRM and date</span></span></label>' +
      '<label class="radio-card"><input type="radio" name="mode" value="list" data-change="import-mode"' + (im.mode === 'list' ? ' checked' : '') + '><span><b>Single column of codes</b><span>All codes go to one VRM and date you choose</span></span></label></div></fieldset>';
    if (im.mode === 'structured') {
      html += '<div class="fields"><div class="field"><label for="imp-head">Header row</label><select id="imp-head" data-change="import-head">' + grid.slice(0, 15).map(function (r, i) { return opt(String(i), 'Row ' + (i + 1) + (r.some(function (c) { return c; }) ? ': ' + r.map(C.cellText).filter(Boolean).slice(0, 3).join(', ').slice(0, 40) : ' (blank)'), i === im.headerRow); }).join('') + '</select></div>' +
        '<div class="field"><label for="imp-cvrm">VRM column</label><select id="imp-cvrm" name="vrm">' + colOpts(im.map.vrm) + '</select></div>' +
        '<div class="field"><label for="imp-cdate">Date column</label><select id="imp-cdate" name="date">' + colOpts(im.map.date) + '</select></div>' +
        '<div class="field"><label for="imp-ccode">Client code column</label><select id="imp-ccode" name="code">' + colOpts(im.map.code) + '</select></div>' +
        '<div class="field"><label for="imp-order">Text date format</label><select id="imp-order" name="dateOrder">' + opt('auto', 'Detect from the file (flag ambiguous)', im.dateOrder === 'auto') + opt('dmy', 'DD/MM/YYYY (India)', im.dateOrder === 'dmy') + opt('mdy', 'MM/DD/YYYY (US)', im.dateOrder === 'mdy') + '</select></div></div>' +
        '<p class="hint">Columns were matched only where the header exactly equals a documented alias. Check every mapping before continuing.</p>';
    } else {
      var member = S.me.role === 'member';
      html += '<div class="fields"><div class="field"><label for="imp-lcol">Code column</label><select id="imp-lcol" name="code">' + colOpts(im.listCol) + '</select></div>' +
        '<div class="field"><label class="check"><input type="checkbox" name="listHeader" data-change="import-listheader"' + (im.listHeader ? ' checked' : '') + '> First row is a header</label></div>' +
        (member ? '<div class="field"><span class="label">VRM</span><div class="locked">' + svg('lock') + h(vrmName(S.me.assignedVrmId) || 'Not linked') + '</div></div>'
          : '<div class="field"><label for="imp-lvrm">VRM for every code</label><select id="imp-lvrm" name="listVrmId">' + vrmOptions(im.listVrmId, { activeOnly: true, placeholder: '— Choose a VRM —' }) + '</select></div>') +
        '<div class="field"><label for="imp-ldate">Activation date for every code</label><input type="date" id="imp-ldate" name="listDate" min="2000-01-01" max="' + today() + '" value="' + h(im.listDate) + '"></div></div>';
    }
    html += '<label class="check"><input type="checkbox" name="includeNumeric"' + (im.includeNumeric ? ' checked' : '') + '> Include codes Excel stored as numbers (only if you have confirmed none had leading zeros)</label>' +
      '<div class="divider"></div><h3 class="label">First rows as read from the file</h3><div class="table-scroll short"><table><thead><tr><th scope="col">Row</th>' + cols.slice(0, 8).map(function (i) { return '<th scope="col">' + h(colLabel(i, [])) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      (sample.length ? sample.map(function (r, k) { return '<tr><td>' + (dataStart + k + 1) + '</td>' + cols.slice(0, 8).map(function (i) { return '<td>' + h(C.cellText(r[i] || null)) + '</td>'; }).join('') + '</tr>'; }).join('') : '<tr><td colspan="9">' + empty('No data rows below the header.') + '</td></tr>') +
      '</tbody></table></div><div class="divider"></div><div class="actions end"><button type="button" class="btn ghost" data-action="import-restart">Cancel</button><button type="submit" class="btn" id="imp-prev-btn">Preview rows</button></div></form></div>';
    return html;
  }
  function readMapping(form) {
    var im = S.ui.imp;
    im.includeNumeric = form.elements.includeNumeric.checked;
    if (im.mode === 'structured') {
      im.map = { vrm: +form.elements.vrm.value, date: +form.elements.date.value, code: +form.elements.code.value };
      im.dateOrder = form.elements.dateOrder.value;
      if (im.map.vrm < 0 || im.map.date < 0 || im.map.code < 0) throw new Error('Map the VRM, Date and Client code columns.');
      if (im.map.vrm === im.map.date || im.map.vrm === im.map.code || im.map.date === im.map.code) throw new Error('Each field must use a different column.');
      return { mode: 'structured', headerRow: im.headerRow, vrm: im.map.vrm, date: im.map.date, code: im.map.code };
    }
    im.listCol = +form.elements.code.value;
    if (im.listCol < 0) throw new Error('Choose the code column.');
    if (form.elements.listVrmId) im.listVrmId = form.elements.listVrmId.value;
    im.listDate = form.elements.listDate.value;
    if (!im.listVrmId) throw new Error('Choose the VRM for these codes.');
    var dc = C.checkActivationDate(im.listDate, today());
    if (!dc.ok) throw new Error('Activation date: ' + dc.reason);
    return { mode: 'list', headerRow: im.listHeader ? im.headerRow : im.headerRow - 1, code: im.listCol, vrmName: vrmName(im.listVrmId), date: im.listDate };
  }
  function runPreview(form) {
    var im = S.ui.imp, btn = $('#imp-prev-btn');
    var mapping;
    try { mapping = readMapping(form); } catch (e) { im.error = errMsg(e); renderImportBody(); return; }
    im.error = '';
    var parsed = C.buildImportRows(im.grid, mapping, { today: today(), dateOrder: im.dateOrder, date1904: im.date1904, includeNumericCodes: im.includeNumeric });
    if (!parsed.rows.length) { im.error = 'There are no data rows to import in this worksheet.'; renderImportBody(); return; }
    im.parsed = parsed;
    var ok = parsed.rows.filter(function (r) { return r.status === 'OK'; });
    var chunks = C.chunk(ok, C.MAX_ROWS), byRow = {}, newNames = {};
    busy(btn, true);
    var seq = Promise.resolve();
    chunks.forEach(function (ch, i) {
      seq = seq.then(function () {
        if (btn) btn.querySelector('.spin') && (btn.lastChild.textContent = 'Checking part ' + (i + 1) + ' of ' + chunks.length + '…');
        return Api.call('previewImport', { rows: ch.map(function (r) { return { row: r.row, vrm: r.vrm, date: r.date, code: r.code }; }) }, { timeout: 120000 }).then(function (d) {
          d.results.forEach(function (x) { byRow[x.row] = x; });
          (d.newVrmNames || []).forEach(function (n) { newNames[C.nameKey(n)] = n; });
        });
      });
    });
    seq.then(function () {
      im.preview = { byRow: byRow, newVrmNames: Object.keys(newNames).map(function (k) { return newNames[k]; }), at: Api.now() };
      im.approve = {};
      im.filter = 'all'; im.page = 1; im.step = 3;
      renderImport($('#view'));
    }, function (e) {
      busy(btn, false);
      im.error = 'Preview failed: ' + errMsg(e) + ' Nothing has been imported.';
      renderImportBody();
    });
  }
  /** Final per-row status: client-side issue first, otherwise the server's verdict. */
  function rowStatus(r) {
    var im = S.ui.imp;
    if (r.status !== 'OK') return { status: r.status, reason: r.reason };
    var c = im.commit && im.commit.byRow[r.row];
    if (c) return c;
    var p = im.preview && im.preview.byRow[r.row];
    return p ? p : { status: 'OK', reason: '' };
  }
  var GROUPS = {
    ready: ['ACCEPTED', 'OK'], existing: ['DUPLICATE_EXISTING'], infile: ['DUPLICATE_IN_FILE'],
    invalid: ['INVALID_CODE', 'INVALID_DATE', 'FUTURE_DATE', 'AMBIGUOUS_DATE', 'SCIENTIFIC_CODE', 'MISSING_VRM'],
    numeric: ['NUMERIC_CODE'], vrm: ['UNKNOWN_VRM', 'ARCHIVED_VRM', 'UNAUTHORIZED_VRM'], notsent: ['NOT_SENT', 'FAILED', 'CANCELLED']
  };
  function groupOf(status) { for (var g in GROUPS) if (GROUPS[g].indexOf(status) >= 0) return g; return 'invalid'; }
  function impStep3() {
    var im = S.ui.imp, rows = im.parsed.rows;
    var tally = { all: rows.length };
    rows.forEach(function (r) { var g = groupOf(rowStatus(r).status); tally[g] = (tally[g] || 0) + 1; });
    var approvedCount = Object.keys(im.approve).filter(function (k) { return im.approve[k]; }).length;
    var unknownApproved = rows.filter(function (r) { var s = rowStatus(r); return s.status === 'UNKNOWN_VRM' && im.approve[C.nameKey(r.vrm)]; }).length;
    var toSend = rows.filter(function (r) { return r.status === 'OK'; }).length;
    var expected = (tally.ready || 0) + unknownApproved;
    var chip = function (g, label, cls) {
      return '<button type="button" class="chip ' + cls + '" data-action="import-filter" data-g="' + g + '" aria-pressed="' + (im.filter === g) + '"><span class="n">' + C.fmtInt(tally[g] || 0) + '</span><span class="l">' + label + '</span></button>';
    };
    var html = '';
    if (im.parsed.order === 'undetermined' && tally.invalid && rows.some(function (r) { return r.status === 'AMBIGUOUS_DATE'; })) {
      html += banner('warn', '<b>Some dates could be read two ways</b> (for example 03/04/2026). They are flagged below and will not be imported. Go back and choose the date format used in this file to resolve them.');
    }
    if (im.parsed.order === 'mixed') html += banner('warn', '<b>This file mixes DD/MM and MM/DD dates.</b> Rows that fit both formats are flagged. Check the source file.');
    if (im.parsed.blankRows) html += banner('info', im.parsed.blankRows + ' completely blank row(s) were skipped and are not counted.');
    html += '<div class="card card-pad"><div class="chips" role="group" aria-label="Filter preview rows">' + chip('all', 'Rows in file', '') + chip('ready', 'Ready to save', 'ok') + chip('existing', 'Already recorded', 'warn') +
      chip('infile', 'Repeated in file', 'info') + chip('invalid', 'Invalid', 'err') + chip('numeric', 'Number-formatted codes', 'warn') + chip('vrm', 'VRM problems', 'err') + '</div>' +
      '<p class="hint">Preview checked against the server at ' + h(timeIST(new Date(im.preview.at).toISOString())) + '. The server re-checks every row when you import; codes recorded by others in the meantime are reported, never duplicated.</p></div>';
    if (im.preview.newVrmNames.length) {
      html += '<div class="card card-pad"><h3 class="label">VRMs not on the roster</h3>' + (isRole('admin') ? '<p class="hint">Tick a name only if it is a genuinely new VRM. To attach a misspelling to an existing VRM, add an alias in Management instead, then preview again.</p>' + im.preview.newVrmNames.map(function (n) {
        var k = C.nameKey(n), valid = /^[\p{L}\p{M}][\p{L}\p{M} .'\-]{1,99}$/u.test(n);
        return '<label class="check"><input type="checkbox" data-change="import-approve" data-key="' + h(k) + '"' + (im.approve[k] ? ' checked' : '') + (valid ? '' : ' disabled') + '> Create VRM “' + h(n) + '”' + (valid ? '' : ' (not a valid name)') + '</label>';
      }).join('') : '') + '</div>';
    }
    var filtered = im.filter === 'all' ? rows : rows.filter(function (r) { return groupOf(rowStatus(r).status) === im.filter; });
    var per = 100, pages = Math.max(1, Math.ceil(filtered.length / per));
    im.page = Math.min(im.page, pages);
    var slice = filtered.slice((im.page - 1) * per, im.page * per);
    html += '<div class="card"><div class="table-scroll"><table><caption class="sr-only">Import preview</caption><thead><tr><th scope="col" class="num">Row</th><th scope="col">VRM</th><th scope="col">Date</th><th scope="col">Client code</th><th scope="col">Status</th><th scope="col">Detail</th></tr></thead><tbody>' +
      (slice.length ? slice.map(function (r) {
        var s = rowStatus(r);
        var label = s.status === 'ACCEPTED' ? 'Ready' : null;
        return '<tr><td class="num">' + r.row + '</td><td>' + h(r.vrm) + (s.vrmName && C.nameKey(s.vrmName) !== C.nameKey(r.vrm) ? '<div class="meta">→ ' + h(s.vrmName) + '</div>' : '') + '</td><td class="nowrap">' + h(r.date ? C.fmtDate(r.date) : '') + '</td><td><span class="code-pill">' + h(r.code) + '</span></td><td>' + pill(s.status, label) + '</td><td class="wrap-cell">' + h(s.reason || '') +
          (s.owner ? ' Existing record: <b>' + h(s.owner.vrmName) + '</b>, ' + h(C.fmtDate(s.owner.date)) + '.' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="6">' + empty('No rows in this group.') + '</td></tr>') + '</tbody></table></div>' +
      (pages > 1 ? '<div class="pager"><span>' + C.fmtInt(filtered.length) + ' rows</span><div class="actions"><button type="button" class="btn ghost mini" data-action="import-page" data-page="' + (im.page - 1) + '"' + (im.page <= 1 ? ' disabled' : '') + '>Previous</button><span>Page ' + im.page + ' of ' + pages + '</span><button type="button" class="btn ghost mini" data-action="import-page" data-page="' + (im.page + 1) + '"' + (im.page >= pages ? ' disabled' : '') + '>Next</button></div></div>' : '') + '</div>';
    html += '<div class="actions end"><button type="button" class="btn ghost" data-action="import-back">Back to mapping</button><button type="button" class="btn ghost" data-action="import-exceptions">' + svg('download') + 'Download exceptions</button>' +
      '<button type="button" class="btn ghost" data-action="import-restart">Cancel</button><button type="button" class="btn" data-action="import-commit"' + (expected ? '' : ' disabled') + '>' + svg('upload') + 'Import ' + C.fmtInt(expected) + ' row' + (expected === 1 ? '' : 's') + '</button></div>' +
      '<p class="hint">' + C.fmtInt(toSend) + ' rows that passed the file checks will be sent in ' + Math.max(1, Math.ceil(toSend / C.MAX_ROWS)) + ' part(s); the server records every outcome in the import register.' + (approvedCount ? ' ' + approvedCount + ' new VRM(s) will be created.' : '') + '</p>';
    return html;
  }
  function startCommit() {
    var im = S.ui.imp, rows = im.parsed.rows;
    var send = rows.filter(function (r) { return r.status === 'OK'; });
    var approve = im.preview.newVrmNames.filter(function (n) { return im.approve[C.nameKey(n)]; });
    im.commit = { batchId: C.uuid(), chunks: C.chunk(send, C.MAX_ROWS), index: 0, byRow: {}, status: 'running', error: '', stopRequested: false, approve: approve,
      clientRejected: rows.length - send.length, sent: send.length, batch: null, attempts: 0 };
    im.step = 4;
    renderImport($('#view'));
    window.addEventListener('beforeunload', guardUnload);
    commitNext();
  }
  function guardUnload(e) { e.preventDefault(); e.returnValue = ''; return ''; }
  function commitNext() {
    var im = S.ui.imp, c = im.commit;
    if (!c || c.status !== 'running') return;
    if (c.stopRequested) { cancelCommit(); return; }
    if (c.index >= c.chunks.length) { finishCommit(); return; }
    var i = c.index, ch = c.chunks[i];
    var params = { batchId: c.batchId, chunkIndex: i, chunkCount: c.chunks.length, rows: ch.map(function (r) { return { row: r.row, vrm: r.vrm, date: r.date, code: r.code }; }),
      fileName: im.fileName, fileRows: im.parsed.rows.length, clientRejected: c.clientRejected, mode: im.mode };
    if (i === 0 && c.approve.length) params.approveNewVrms = c.approve;
    Api.call('commitImport', params, { requestId: c.batchId + ':' + i, timeout: 180000 }).then(function (d) {
      d.results.forEach(function (x) { c.byRow[x.row] = x; });
      c.batch = d.batch;
      c.index++;
      c.attempts = 0;
      announce('Imported part ' + c.index + ' of ' + c.chunks.length + '.');
      renderImportBody();
      commitNext();
    }, function (e) {
      if ((e.uncertain || e.code === 'BUSY') && c.attempts < 2) {
        c.attempts++;
        c.note = 'Connection problem on part ' + (i + 1) + '; retrying the same part safely (attempt ' + (c.attempts + 1) + ')…';
        renderImportBody();
        setTimeout(commitNext, c.attempts * 3000);
        return;
      }
      c.status = 'paused';
      c.error = errMsg(e);
      c.retryable = e.uncertain || e.code === 'BUSY';
      renderImportBody();
    });
  }
  function cancelCommit() {
    var im = S.ui.imp, c = im.commit;
    c.status = 'cancelling';
    renderImportBody();
    var done = function () {
      for (var j = c.index; j < c.chunks.length; j++) c.chunks[j].forEach(function (r) { c.byRow[r.row] = { status: 'NOT_SENT', reason: 'Import stopped before this part was sent.' }; });
      c.status = 'cancelled';
      endCommit();
    };
    if (c.index === 0) { done(); return; }
    Api.call('cancelImport', { batchId: c.batchId }, { requestId: c.batchId + ':cancel' }).then(function (d) { c.batch = d.batch; }, function () { /* status shown from last committed part */ }).then(done);
  }
  function finishCommit() {
    var c = S.ui.imp.commit;
    c.status = 'done';
    Api.call('getImportStatus', { batchId: c.batchId }).then(function (d) { c.batch = d.batch; }, function () { /* keep last */ }).then(endCommit);
  }
  function endCommit() {
    window.removeEventListener('beforeunload', guardUnload);
    var im = S.ui.imp;
    im.step = 5;
    refreshData({ quiet: true });
    if (S.route === 'import') renderImport($('#view'));
    var c = im.commit, saved = Object.keys(c.byRow).filter(function (k) { return c.byRow[k].status === 'ACCEPTED'; }).length;
    toast('Import ' + (c.status === 'cancelled' ? 'stopped' : 'finished') + ': ' + saved + ' row(s) saved.', saved ? 'ok' : 'warn');
  }
  function impStep4() {
    var c = S.ui.imp.commit, total = c.chunks.length || 1;
    var savedSoFar = Object.keys(c.byRow).filter(function (k) { return c.byRow[k].status === 'ACCEPTED'; }).length;
    var html = '<div class="card card-pad" role="region" aria-label="Import progress"><h3 class="label">Importing ' + h(S.ui.imp.fileName) + '</h3>' +
      '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + c.index + '" aria-label="Parts imported"><span data-w="' + (c.index / total * 100).toFixed(1) + '"></span></div>' +
      '<p class="meta" aria-live="polite">Part ' + Math.min(c.index + 1, total) + ' of ' + total + ' · ' + C.fmtInt(savedSoFar) + ' saved so far · batch ' + h(c.batchId.slice(0, 8)) + '</p>' + (c.note && c.status === 'running' ? '<p class="hint">' + h(c.note) + '</p>' : '');
    if (c.status === 'paused') {
      html += banner('err', '<b>Import paused.</b> ' + h(c.error) + ' Parts already saved stay saved. ' + (c.retryable ? 'Retrying re-sends the same part; it cannot be saved twice.' : 'Fix the problem or stop the import.')) +
        '<div class="actions">' + (c.retryable ? '<button type="button" class="btn" data-action="import-resume">Retry part ' + (c.index + 1) + '</button>' : '') + '<button type="button" class="btn ghost" data-action="import-stop">Stop import</button></div>';
    } else if (c.status === 'running') {
      html += '<div class="actions"><button type="button" class="btn ghost" data-action="import-stop"' + (c.stopRequested ? ' disabled' : '') + '>' + (c.stopRequested ? 'Stopping after this part…' : 'Stop after this part') + '</button></div>';
    } else {
      html += '<p class="meta">Finishing…</p>';
    }
    return html + '</div>';
  }
  function impStep5() {
    var im = S.ui.imp, c = im.commit, rows = im.parsed.rows;
    var t = { ACCEPTED: 0, DUPLICATE_IN_FILE: 0, DUPLICATE_EXISTING: 0, invalid: 0, unauthorized: 0, notsent: 0 };
    rows.filter(function (r) { return r.status === 'OK'; }).forEach(function (r) {
      var s = (c.byRow[r.row] || { status: 'NOT_SENT' }).status;
      if (t[s] !== undefined) t[s]++;
      else if (s === 'UNAUTHORIZED_VRM') t.unauthorized++;
      else if (s === 'NOT_SENT' || s === 'FAILED' || s === 'CANCELLED') t.notsent++;
      else t.invalid++;
    });
    var sentDone = c.sent - t.notsent;
    var sumOk = t.ACCEPTED + t.DUPLICATE_IN_FILE + t.DUPLICATE_EXISTING + t.invalid + t.unauthorized === sentDone;
    var b = c.batch;
    var serverOk = !b || (b.accepted === t.ACCEPTED && b.received === sentDone);
    var tr = function (label, n, cls) { return '<tr class="' + (cls || '') + '"><td>' + label + '</td><td class="num">' + C.fmtInt(n) + '</td></tr>'; };
    return (c.status === 'cancelled' ? banner('warn', '<b>Import stopped.</b> Rows saved before you stopped remain recorded (they are listed in the ledger under this batch).') : banner(t.ACCEPTED ? 'ok' : 'warn', '<b>Import complete.</b> ' + C.fmtInt(t.ACCEPTED) + ' new activation(s) saved.')) +
      (!sumOk || !serverOk ? banner('err', '<b>Reconciliation mismatch.</b> The client tally and the server register differ. Do not re-import; send batch ' + h(c.batchId) + ' to an administrator.') : '') +
      '<div class="grid2"><div class="card card-pad"><h3 class="label">Reconciliation</h3><table class="recon"><tbody>' +
      tr('Data rows in file', rows.length, 'total') + tr('Rejected before upload (file checks)', c.clientRejected) + tr('Sent to the server', sentDone) + tr('Not sent (stopped)', t.notsent) +
      tr('— Saved', t.ACCEPTED) + tr('— Repeated in file', t.DUPLICATE_IN_FILE) + tr('— Already recorded', t.DUPLICATE_EXISTING) + tr('— Invalid / VRM problems', t.invalid) + tr('— Not your VRM', t.unauthorized) +
      '</tbody></table><p class="hint">' + (sumOk ? '✓ Sent rows reconcile with their outcomes.' : '✗ Sent rows do not reconcile.') + (b ? ' Server register: received ' + C.fmtInt(b.received) + ', accepted ' + C.fmtInt(b.accepted) + ', status ' + h(b.status) + (serverOk ? ' ✓' : ' ✗') + '.' : '') + '</p></div>' +
      '<div class="card card-pad"><dl class="kv"><dt>Batch ID</dt><dd><span class="code-pill">' + h(c.batchId) + '</span></dd><dt>File</dt><dd>' + h(im.fileName) + (im.sheetNames.length > 1 ? ' · ' + h(im.sheet) : '') + '</dd>' +
      (c.approve.length ? '<dt>New VRMs</dt><dd>' + h(c.approve.join(', ')) + '</dd>' : '') + '</dl><div class="divider"></div><div class="actions">' +
      '<button type="button" class="btn ghost" data-action="import-exceptions">' + svg('download') + 'Download exceptions</button>' +
      '<button type="button" class="btn ghost" data-action="ledger-batch" data-batch="' + h(c.batchId) + '">View saved rows</button>' +
      '<button type="button" class="btn" data-action="import-restart">Import another file</button></div></div></div>';
  }
  function exceptionRows() {
    var im = S.ui.imp, out = [['Row', 'VRM', 'Activation date', 'Client code', 'Status', 'Reason', 'Existing owner', 'Existing date']];
    im.parsed.rows.forEach(function (r) {
      var s = rowStatus(r);
      if (s.status === 'ACCEPTED' || s.status === 'OK') return;
      out.push([r.row, r.vrm, r.date, r.code, C.STATUS_TEXT[s.status] || s.status, s.reason || '', s.owner ? s.owner.vrmName : '', s.owner ? s.owner.date : '']);
    });
    return out;
  }

  /* ================================ Admin overview ================================ */
  function renderAdmin(el) {
    el.innerHTML = freshness() + '<div id="admin-body"></div>';
    renderAdminBody();
    loadAdmin();
  }
  function loadAdmin() {
    var A = S.ui.admin;
    Api.call('getAdminOverview').then(function (d) { A.data = d; A.error = ''; }, function (e) { A.error = errMsg(e); }).then(renderAdminBody);
  }
  function renderAdminBody() {
    var box = $('#admin-body'), A = S.ui.admin, d = A.data, t = today();
    if (!box) return;
    var m = metricsFor(C.resolvePeriod({ year: t.slice(0, 4), month: t.slice(5, 7) }, t), '');
    var act = m.rows.filter(function (r) { return r.status === 'active'; });
    var filed = act.filter(function (r) { return r.reporting === 'filed'; }).length, zero = act.filter(function (r) { return r.reporting === 'zero'; }).length;
    var order = { none: 0, zero: 1, filed: 2 };
    var rep = act.slice().sort(function (a, b) { return order[a.reporting] - order[b.reporting] || b.today - a.today || a.name.localeCompare(b.name); });
    var html = '<div class="kpis">' + kpi('k1', 'Filed today', filed, 'of ' + act.length + ' active VRMs', 'check') + kpi('k2', 'Confirmed zero', zero, 'Explicit zero reports today', 'zero') +
      kpi('k3', 'Not reported', act.length - filed - zero, 'Nothing recorded yet today', 'clock') + kpi('k4', 'Team this month', m.teamTotals.month, C.MONTHS[+t.slice(5, 7) - 1] + ' ' + t.slice(0, 4), 'cal') +
      kpi('k5', 'Backdated (30 days)', d ? d.backdated.reduce(function (s, x) { return s + x.count; }, 0) : 0, 'Recorded after the activation date', 'warn') + '</div>';
    html += '<div class="sec"><h2>Today’s reporting</h2><span class="line"></span><span class="badge">' + h(C.fmtDate(t)) + ' IST · outstanding first</span></div>' +
      '<div class="card"><div class="table-scroll short"><table><caption>“Not reported” means nothing has been recorded yet; it is not evidence of non-compliance.</caption><thead><tr><th scope="col">VRM</th><th scope="col" class="num">Today</th><th scope="col" class="num">Month</th><th scope="col" class="num">All time</th><th scope="col">Status</th></tr></thead><tbody>' +
      (rep.length ? rep.map(function (r) { return '<tr class="' + (r.reporting === 'none' ? 'pending' : '') + '"><td>' + avatar(r.name) + '</td><td class="num">' + C.fmtInt(r.today) + '</td><td class="num">' + C.fmtInt(r.month) + '</td><td class="num">' + C.fmtInt(r.all) + '</td><td>' + reportingStatusPill(r) + '</td></tr>'; }).join('') : '<tr><td colspan="5">' + empty('No active VRMs.') + '</td></tr>') +
      '</tbody></table></div></div>';
    html += '<div class="grid2"><div><div class="sec"><h2>Month leaderboard</h2><span class="line"></span></div><div class="card">' + leaderboardHtml(m) + '</div></div><div><div class="sec"><h2>Team share</h2><span class="line"></span></div><div class="card">' + shareHtml(m) + '</div></div></div>';
    if (A.error) html += '<div class="sec"><span class="line"></span></div>' + banner('err', 'Could not load admin details: ' + h(A.error) + ' <button type="button" class="btn link mini" data-action="admin-reload">Retry</button>');
    else if (!d) html += '<div class="loading-row" role="status">Loading administration details…</div>';
    else {
      if (isRole('admin')) {
        html += '<div class="sec"><h2>Team &amp; access</h2><span class="line"></span><a class="btn ghost mini" href="#/manage">Manage</a></div><div class="card"><div class="roster">' + (d.users.length ? d.users.map(function (u) {
          var state = !u.active ? pill('deleted', 'Disabled') : u.locked ? pill('none', 'Locked') : u.mustChangePassword ? pill('zero', 'Must set password') : pill('filed', 'Active');
          return '<div class="rperson"><span class="ini" data-bg="' + colorFor(u.name) + '" aria-hidden="true">' + h(C.initials(u.name)) + '</span><span class="grow"><span class="rn">' + h(u.name) + '</span><span class="rr">' + h({ admin: 'Administrator', member: 'VRM', reviewer: 'Reviewer' }[u.role] || u.role) + (u.assignedVrmId ? ' · ' + h(vrmName(u.assignedVrmId)) : '') + ' · last sign-in ' + h(u.lastLoginAt ? fmtTs(u.lastLoginAt) : 'never') + '</span></span>' + state + '</div>';
        }).join('') : empty('No accounts.')) + '</div></div>';
      }
      html += '<div class="sec"><h2>Import exceptions (30 days)</h2><span class="line"></span></div><div class="card">' + (d.importExceptions.length ? '<div class="table-scroll short"><table><thead><tr><th scope="col">Started</th><th scope="col">By</th><th scope="col">File</th><th scope="col" class="num">Rows</th><th scope="col" class="num">Saved</th><th scope="col" class="num">Exceptions</th><th scope="col">Status</th><th scope="col"></th></tr></thead><tbody>' +
        d.importExceptions.map(function (b) { return '<tr><td class="nowrap">' + h(fmtTs(b.startedAt)) + '</td><td>' + h(b.initiator) + '</td><td class="wrap-cell">' + h(b.fileName) + '</td><td class="num">' + C.fmtInt(b.fileRows) + '</td><td class="num">' + C.fmtInt(b.accepted) + '</td><td class="num">' + C.fmtInt(b.exceptions) + '</td><td>' + pill(b.status, b.status.replace('_', ' ')) + '</td><td><button type="button" class="btn link mini" data-action="ledger-batch" data-batch="' + h(b.id) + '">Rows</button></td></tr>'; }).join('') + '</tbody></table></div>' : empty('No imports with exceptions in the last 30 days.', 'check')) + '</div>';
      html += '<div class="grid2"><div><div class="sec"><h2>Corrections (30 days)</h2><span class="line"></span></div><div class="card">' + (d.corrections.length ? '<div class="table-scroll short"><table><thead><tr><th scope="col">When</th><th scope="col">By</th><th scope="col">Action</th><th scope="col">Reason</th></tr></thead><tbody>' +
        d.corrections.map(function (a) { return '<tr><td class="nowrap">' + h(fmtTs(a.time)) + '</td><td>' + h(a.actor) + '</td><td>' + h(actionLabel(a.action)) + '</td><td class="wrap-cell">' + h(a.detail) + '</td></tr>'; }).join('') + '</tbody></table></div>' : empty('No corrections, deletions or restores.', 'check')) + '</div></div>' +
        '<div><div class="sec"><h2>Backdated entries (30 days)</h2><span class="line"></span></div><div class="card">' + (d.backdated.length ? '<div class="card-pad"><div class="chips">' + d.backdated.map(function (b) { return '<div class="chip warn"><span class="n">' + b.count + '</span><span class="l">' + h(b.vrmName) + '</span></div>'; }).join('') + '</div></div>' +
        '<div class="table-scroll short"><table><thead><tr><th scope="col">Activation date</th><th scope="col">Recorded</th><th scope="col">VRM</th><th scope="col">Code</th></tr></thead><tbody>' + d.backdatedEntries.map(function (e) { return '<tr><td>' + h(C.fmtDate(e.date)) + '</td><td class="nowrap">' + h(fmtTs(e.createdAt)) + '</td><td>' + h(e.vrmName) + '</td><td><span class="code-pill">' + h(e.code) + '</span></td></tr>'; }).join('') + '</tbody></table></div>' : empty('No backdated entries.', 'check')) + '</div></div></div>';
      html += '<div class="sec"><h2>Recent changes</h2><span class="line"></span><a class="btn ghost mini" href="#/activity">Full activity log</a></div><div class="card">' + auditTable(d.recent) + '</div>';
      if (isRole('admin')) {
        var I2 = A.integrity;
        html += '<div class="sec"><h2>Data health</h2><span class="line"></span><button type="button" class="btn ghost mini" data-action="integrity">Run integrity check</button></div><div class="card card-pad">' +
          (I2 ? (I2.error ? banner('err', h(I2.error)) : banner(I2.ok ? 'ok' : 'err', I2.ok ? '<b>All checks passed</b> at ' + h(fmtTs(I2.checkedAt)) + '.' : '<b>Problems found.</b> Review the counts below before relying on reports.') +
            '<div class="chips"><div class="chip"><span class="n">' + C.fmtInt(I2.active) + '</span><span class="l">Active entries</span></div><div class="chip"><span class="n">' + C.fmtInt(I2.deleted) + '</span><span class="l">Deleted (tombstones)</span></div>' +
            '<div class="chip ' + (I2.duplicateCodeKeys ? 'err' : 'ok') + '"><span class="n">' + I2.duplicateCodeKeys + '</span><span class="l">Duplicate code keys</span></div><div class="chip ' + (I2.orphanEntries ? 'err' : 'ok') + '"><span class="n">' + I2.orphanEntries + '</span><span class="l">Orphan entries</span></div>' +
            '<div class="chip ' + (I2.invalidDates + I2.futureDates ? 'err' : 'ok') + '"><span class="n">' + (I2.invalidDates + I2.futureDates) + '</span><span class="l">Bad or future dates</span></div><div class="chip ' + (I2.codeKeyMismatches ? 'err' : 'ok') + '"><span class="n">' + I2.codeKeyMismatches + '</span><span class="l">Code key mismatches</span></div>' +
            '<div class="chip ' + (I2.teamEqualsSumOfVrms ? 'ok' : 'err') + '"><span class="n">' + (I2.teamEqualsSumOfVrms ? '✓' : '✗') + '</span><span class="l">Team = sum of VRMs</span></div></div>')
            : '<p class="hint">Checks global uniqueness, orphaned records, invalid or future dates and that the team total equals the sum of VRM totals.</p>') + '</div>';
      }
    }
    box.innerHTML = html;
    applyStyles(box);
  }

  /* ================================ Activity log ================================ */
  var ACTION_LABELS = { login: 'Sign-in', logout: 'Sign-out', addEntries: 'Codes added', importStarted: 'Import started', importChunk: 'Import part saved', importCancelled: 'Import stopped',
    correctEntry: 'Entry corrected', softDeleteEntry: 'Entry deleted', restoreEntry: 'Entry restored', addVRM: 'VRM added', renameVRM: 'VRM renamed', archiveVRM: 'VRM archived',
    restoreVRM: 'VRM restored', addAlias: 'Alias added', removeAlias: 'Alias removed', createUser: 'User created', updateUser: 'User changed', resetUserPassword: 'Password reset',
    enableUser: 'User enabled', disableUser: 'User disabled', unlockUser: 'User unlocked', changePassword: 'Password changed', submitZeroReport: 'Zero report', withdrawZeroReport: 'Zero report withdrawn',
    exportReport: 'Report exported', provisionUser: 'User provisioned (operator)' };
  function actionLabel(a) { return ACTION_LABELS[a] || a; }
  function changeText(a) {
    var fmt = function (o) {
      if (!o) return '';
      return Object.keys(o).map(function (k) { var v = o[k]; if (k === 'vrmId') { k = 'VRM'; v = vrmName(v) || v; } return k + ': ' + (v === '' ? '—' : v); }).join(', ');
    };
    return a.before || a.after ? fmt(a.before) + (a.before && a.after ? ' → ' : '') + fmt(a.after) : '';
  }
  function auditTable(items) {
    if (!items || !items.length) return empty('No activity recorded.', 'clock');
    return '<div class="table-scroll"><table><caption class="sr-only">Activity</caption><thead><tr><th scope="col">When (IST)</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Outcome</th><th scope="col">VRM</th><th scope="col">Details</th></tr></thead><tbody>' +
      items.map(function (a) {
        return '<tr><td class="nowrap">' + h(fmtTs(a.time)) + '</td><td>' + (a.actor ? avatar(a.actor) + '<div class="meta">' + h(a.role) + '</div>' : '<span class="meta">Unknown / not signed in</span>') + '</td><td>' + h(actionLabel(a.action)) +
          (a.entityType ? '<div class="meta">' + h(a.entityType) + (a.entityId ? ' ' + h(String(a.entityId).slice(0, 8)) : '') + '</div>' : '') + '</td><td>' + pill(a.outcome) + '</td><td>' + h(a.vrmName || '') + '</td><td class="wrap-cell">' + h(a.detail || '') +
          (changeText(a) ? '<div class="diff">' + h(changeText(a)) + '</div>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function renderActivity(el) {
    var L = S.ui.logs, d = L.data;
    el.innerHTML = '<div class="card"><form class="card-pad" id="log-form" data-submit="logs" novalidate><div class="fields">' +
      '<div class="field"><label for="lf-from">From (IST)</label><input type="date" id="lf-from" name="from" value="' + h(L.from) + '"></div>' +
      '<div class="field"><label for="lf-to">To (IST)</label><input type="date" id="lf-to" name="to" value="' + h(L.to) + '"></div>' +
      '<div class="field"><label for="lf-actor">Actor</label><select id="lf-actor" name="actorId">' + opt('', 'Anyone', !L.actorId) + (d ? d.actors.map(function (a) { return opt(a.id, a.name, a.id === L.actorId); }).join('') : '') + '</select></div>' +
      '<div class="field"><label for="lf-action">Action</label><select id="lf-action" name="eventAction">' + opt('', 'Any action', !L.eventAction) + (d ? d.actions.map(function (a) { return opt(a, actionLabel(a), a === L.eventAction); }).join('') : '') + '</select></div>' +
      '<div class="field"><label for="lf-outcome">Outcome</label><select id="lf-outcome" name="outcome">' + opt('', 'Any outcome', !L.outcome) + ['success', 'failure', 'denied', 'rejected'].map(function (o) { return opt(o, o[0].toUpperCase() + o.slice(1), o === L.outcome); }).join('') + '</select></div>' +
      '<div class="field actions"><button type="submit" class="btn">Apply</button><button type="button" class="btn ghost" data-action="logs-reset">Reset</button><button type="button" class="btn ghost" data-action="logs-export">' + svg('download') + 'Export CSV</button></div></div>' +
      '<p class="hint">Times are server timestamps shown in IST. Passwords, tokens and pasted code lists are never logged.</p></form><div id="log-body"></div></div>';
    loadLogs();
  }
  function logParams(page, size) {
    var L = S.ui.logs, p = { page: page || L.page, pageSize: size || L.pageSize };
    ['from', 'to', 'actorId', 'eventAction', 'outcome'].forEach(function (k) { if (L[k]) p[k] = L[k]; });
    return p;
  }
  function loadLogs() {
    var L = S.ui.logs, box = $('#log-body');
    if (!box) return;
    if (L.from && L.to && L.from > L.to) { box.innerHTML = '<div class="card-pad">' + banner('err', 'From date is after To date.') + '</div>'; return; }
    box.innerHTML = '<div class="loading-row" role="status">Loading activity…</div>';
    var hadData = !!L.data;
    Api.call('getLogs', logParams()).then(function (d) { L.data = d; L.error = ''; }, function (e) { L.error = errMsg(e); }).then(function () {
      if (!hadData && L.data && S.route === 'activity') { renderActivity($('#view')); return; }
      var b = $('#log-body'); if (!b) return;
      b.innerHTML = L.error ? '<div class="card-pad">' + banner('err', 'Could not load the activity log: ' + h(L.error)) + '</div>' : auditTable(L.data.items) + pager(L.data, 'logs-page');
      applyStyles(b);
    });
  }

  /* ================================ Management ================================ */
  function renderManage(el) {
    var M = S.ui.manage, tabs = [['vrms', 'VRM roster'], ['aliases', 'Name aliases'], ['users', 'User accounts']];
    el.innerHTML = '<div class="tabs" role="tablist" aria-label="Management sections">' + tabs.map(function (t) {
      return '<button type="button" role="tab" id="tab-' + t[0] + '" aria-controls="manage-body" aria-selected="' + (M.tab === t[0]) + '" data-action="manage-tab" data-tab="' + t[0] + '">' + t[1] + '</button>';
    }).join('') + '</div><div id="manage-body" role="tabpanel" aria-labelledby="tab-' + M.tab + '"></div>';
    renderManageBody();
    if (M.tab === 'users' && !M.users) loadUsers();
    if (M.tab === 'aliases' && !M.aliases) loadAliases();
  }
  function loadUsers() { Api.call('listUsers').then(function (d) { S.ui.manage.users = d.users; }, function (e) { S.ui.manage.error = errMsg(e); }).then(renderManageBody); }
  function loadAliases() { Api.call('listAliases').then(function (d) { S.ui.manage.aliases = d.aliases; }, function (e) { S.ui.manage.error = errMsg(e); }).then(renderManageBody); }
  function renderManageBody() {
    var box = $('#manage-body'), M = S.ui.manage;
    if (!box) return;
    var html = M.error ? banner('err', h(M.error)) : '';
    if (M.tab === 'vrms') {
      var m = metricsFor(null, ''), all = {};
      m.allRows.forEach(function (r) { all[r.vrmId] = r.all; });
      var list = S.vrms.slice().sort(function (a, b) { return (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1) || a.name.localeCompare(b.name); });
      html += '<div class="card card-pad"><form id="vrm-add" data-submit="vrm-add" novalidate><div class="fields"><div class="field"><label for="vrm-new">New VRM name</label><input id="vrm-new" name="name" autocomplete="off" maxlength="100" placeholder="e.g. Priya Sharma"></div>' +
        '<div class="field"><button type="submit" class="btn">' + svg('plus') + 'Add VRM</button></div></div><p class="hint">Names must be unique and may not repeat an alias. VRMs are never deleted: archive them to keep their history in team totals.</p></form></div>' +
        '<div class="card" ><div class="table-scroll"><table><thead><tr><th scope="col">VRM</th><th scope="col">Status</th><th scope="col" class="num">All-time activations</th><th scope="col">Actions</th></tr></thead><tbody>' +
        (list.length ? list.map(function (v) {
          return '<tr><td>' + avatar(v.name) + '</td><td>' + pill(v.status, v.status === 'active' ? 'Active' : 'Archived') + '</td><td class="num">' + C.fmtInt(all[v.id] || 0) + '</td><td class="nowrap"><button type="button" class="btn ghost mini" data-action="vrm-rename" data-id="' + h(v.id) + '">Rename</button> ' +
            (v.status === 'active' ? '<button type="button" class="btn ghost mini" data-action="vrm-archive" data-id="' + h(v.id) + '">Archive</button>' : '<button type="button" class="btn ghost mini" data-action="vrm-restore" data-id="' + h(v.id) + '">Restore</button>') + '</td></tr>';
        }).join('') : '<tr><td colspan="4">' + empty('No VRMs yet.') + '</td></tr>') + '</tbody></table></div></div>';
    } else if (M.tab === 'aliases') {
      html += '<div class="card card-pad"><form id="alias-add" data-submit="alias-add" novalidate><div class="fields"><div class="field"><label for="al-name">Alias (spelling found in files)</label><input id="al-name" name="alias" autocomplete="off" maxlength="120" placeholder="e.g. swarnarekha shetty"></div>' +
        '<div class="field"><label for="al-vrm">Maps to VRM</label><select id="al-vrm" name="vrmId">' + vrmOptions('', { activeOnly: true, placeholder: '— Choose a VRM —' }) + '</select></div><div class="field"><button type="submit" class="btn">' + svg('plus') + 'Add alias</button></div></div>' +
        '<p class="hint">Matching ignores case and extra spaces. An alias can never equal a VRM name or point to two VRMs.</p></form></div>';
      html += '<div class="card">' + (!M.aliases ? '<div class="loading-row" role="status">Loading aliases…</div>' : M.aliases.length ? '<div class="table-scroll short"><table><thead><tr><th scope="col">Alias</th><th scope="col">VRM</th><th scope="col"></th></tr></thead><tbody>' +
        M.aliases.slice().sort(function (a, b) { return a.alias.localeCompare(b.alias); }).map(function (a) { return '<tr><td>' + h(a.alias) + '</td><td>' + h(a.vrmName) + '</td><td><button type="button" class="btn ghost mini" data-action="alias-remove" data-key="' + h(a.aliasKey) + '" data-label="' + h(a.alias) + '">Remove</button></td></tr>'; }).join('') + '</tbody></table></div>' : empty('No aliases yet.')) + '</div>';
    } else {
      html += '<div class="actions"><button type="button" class="btn" data-action="user-create">' + svg('plus') + 'Create account</button><span class="hint">Every person signs in with their own account. New and reset passwords are temporary and must be changed at first sign-in.</span></div><div class="divider"></div>';
      html += '<div class="card">' + (!M.users ? '<div class="loading-row" role="status">Loading accounts…</div>' : '<div class="table-scroll"><table><thead><tr><th scope="col">Name</th><th scope="col">Role</th><th scope="col">Linked VRM</th><th scope="col">State</th><th scope="col" class="hide-sm">Last sign-in</th><th scope="col">Actions</th></tr></thead><tbody>' +
        M.users.map(function (u) {
          var state = !u.active ? pill('deleted', 'Disabled') : u.locked ? pill('none', 'Locked') : u.mustChangePassword ? pill('zero', 'Must set password') : pill('filed', 'Active');
          return '<tr><td>' + avatar(u.name) + '</td><td>' + h({ admin: 'Administrator', member: 'VRM member', reviewer: 'Reviewer' }[u.role] || u.role) + '</td><td>' + h(vrmName(u.assignedVrmId) || '—') + '</td><td>' + state + '</td><td class="hide-sm nowrap">' + h(u.lastLoginAt ? fmtTs(u.lastLoginAt) : 'Never') + '</td><td class="nowrap">' +
            '<button type="button" class="btn ghost mini" data-action="user-edit" data-id="' + h(u.id) + '">Role / VRM</button> <button type="button" class="btn ghost mini" data-action="user-reset" data-id="' + h(u.id) + '">Reset password</button> ' +
            (u.locked ? '<button type="button" class="btn ghost mini" data-action="user-unlock" data-id="' + h(u.id) + '">Unlock</button> ' : '') +
            (u.id === S.me.id ? '' : '<button type="button" class="btn ghost mini" data-action="user-active" data-id="' + h(u.id) + '" data-on="' + (u.active ? '0' : '1') + '">' + (u.active ? 'Disable' : 'Enable') + '</button>') + '</td></tr>';
        }).join('') + '</tbody></table></div>') + '</div>';
    }
    box.innerHTML = html;
    applyStyles(box);
  }
  function userById(id) { return (S.ui.manage.users || []).filter(function (u) { return u.id === id; })[0]; }
  function genPassword() {
    var alpha = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789-!@#%', b = new Uint32Array(16), out = '';
    crypto.getRandomValues(b);
    for (var i = 0; i < b.length; i++) out += alpha[b[i] % alpha.length];
    return out;
  }
  function showTempPassword(name, pw) {
    openModal({ title: 'Temporary password for ' + name, hideConfirm: true, cancelLabel: 'Done',
      html: '<p>Give this password to <b>' + h(name) + '</b> privately (in person or through an approved channel). It is shown only now. They must change it when they first sign in.</p><div class="field"><label for="tmp-pw">Temporary password</label><input id="tmp-pw" readonly value="' + h(pw) + '" spellcheck="false"></div>' +
        '<button type="button" class="btn ghost mini" data-action="copy-temp">Copy</button>' });
  }
  function roleFields(u) {
    return '<div class="fields"><div class="field"><label for="u-role">Role</label><select id="u-role" name="role">' + opt('member', 'VRM member — records for own VRM', u.role === 'member') + opt('admin', 'Administrator', u.role === 'admin') + opt('reviewer', 'Reviewer — read-only', u.role === 'reviewer') + '</select></div>' +
      '<div class="field"><label for="u-vrm">Linked VRM</label><select id="u-vrm" name="assignedVrmId">' + opt('', 'None', !u.assignedVrmId) + vrmOptions(u.assignedVrmId, { activeOnly: true }) + '</select></div></div>' +
      '<p class="hint">Members must be linked to a VRM. Administrators may also be linked (Admin + VRM). Reviewers cannot be linked.</p>';
  }

  /* ================================ Account ================================ */
  function renderAccount(el) {
    var me = S.me;
    el.innerHTML = '<div class="grid2"><div class="card card-pad"><h3 class="label">Profile</h3><dl class="kv"><dt>Name</dt><dd>' + h(me.name) + '</dd><dt>Role</dt><dd>' + h({ admin: 'Administrator', member: 'VRM member', reviewer: 'Reviewer (read-only)' }[me.role]) + '</dd>' +
      '<dt>Linked VRM</dt><dd>' + h(vrmName(me.assignedVrmId) || '—') + '</dd><dt>Session ends</dt><dd>' + h(me.sessionExpiresAt ? fmtTs(me.sessionExpiresAt) : (Api.session ? fmtTs(Api.session.expiresAt) : '—')) + '</dd><dt>Stored on this device</dt><dd>' + (Api.session && Api.session.remember ? 'Yes (until sign-out or expiry)' : 'This tab only') + '</dd></dl>' +
      '<p class="hint">Your role and VRM are assigned by an administrator and enforced by the server.</p></div>' +
      '<div class="card card-pad"><h3 class="label">Change password</h3>' + passwordForm('account-pw', false) + '</div></div>';
  }
  function passwordForm(id, forced) {
    var min = (S.config && S.config.minPasswordLength) || 12;
    var field = function (name, label, auto) {
      return '<div class="fld field"><label for="' + id + '-' + name + '">' + label + '</label><div class="pw-wrap"><input type="password" id="' + id + '-' + name + '" name="' + name + '" autocomplete="' + auto + '" data-caps="1"' + (name === 'newPassword' || name === 'confirm' ? ' minlength="' + min + '"' : '') + ' required>' +
        '<button type="button" class="pw-eye" data-action="toggle-pw" data-target="' + id + '-' + name + '" aria-label="Show password" aria-pressed="false">' + svg('eye') + '</button></div></div>';
    };
    return '<form id="' + id + '" data-submit="change-password" novalidate>' + field('currentPassword', forced ? 'Temporary password' : 'Current password', 'current-password') + field('newPassword', 'New password', 'new-password') + field('confirm', 'Repeat new password', 'new-password') +
      '<div class="caps" data-caps-note hidden>' + svg('warn') + 'Caps Lock is on</div><p class="hint">At least ' + min + ' characters. A passphrase of several words is easiest to remember. Other devices are signed out when you change it.</p>' +
      '<div class="field-error" data-form-err role="alert" hidden></div><div class="actions">' + (forced ? '<button type="button" class="btn ghost" data-action="logout">Sign out</button>' : '') + '<button type="submit" class="btn"><span class="lbl">Change password</span></button></div></form>';
  }

  /* ================================ authentication screens ================================ */
  var authBrand = '<div class="auth-brand"><div class="auth-mark"><div class="logo" aria-hidden="true">' + svg('logo') + '</div><div><div class="t">VRM Account MIS</div><div class="s">Client-code activation tracking</div></div></div>' +
    '<div class="auth-copy"><h1>Every activation, <em>counted once</em>.</h1><p>The VRM desk’s daily record of client-code activations, reconciled from a single private source of truth.</p><ul class="auth-points">' +
    ['Today, month, year and all-time totals per VRM (IST)', 'Excel / CSV imports with preview and exception reports', 'Duplicate client codes blocked across the whole desk', 'Changes recorded in a server-side activity log'].map(function (t) { return '<li>' + svg('check') + '<span>' + t + '</span></li>'; }).join('') +
    '</ul></div><div class="auth-foot">Internal tool · authorised users only</div></div>';
  function themeButton() {
    return '<button class="icon-btn theme-btn auth-theme" type="button" data-action="toggle-theme" aria-label="Switch light or dark theme"><span class="ic-moon">' + svg('moon') + '</span><span class="ic-sun">' + svg('sun') + '</span></button>';
  }
  function showScreen(which) {
    $('#boot').hidden = which !== 'boot';
    $('#auth').hidden = which !== 'auth';
    $('#app').hidden = which !== 'app';
  }
  function showBoot(msg, retry) {
    showScreen('boot');
    $('#boot-msg').textContent = msg;
    $('#boot-spin').hidden = !!retry || retry === false;
    var a = $('#boot-actions');
    a.hidden = !retry;
    a.innerHTML = retry ? '<button type="button" class="btn" data-action="boot-retry">Retry</button>' : '';
  }
  var bootstrapInfo = null;
  function showLogin(message, type) {
    S.me = null;
    S.loaded = false;
    showScreen('auth');
    var list = bootstrapInfo && bootstrapInfo.rosterMode === 'list' && bootstrapInfo.names && bootstrapInfo.names.length;
    $('#auth').innerHTML = authBrand + '<div class="auth-panel">' + themeButton() + '<form class="auth-card" id="login-form" data-submit="login" novalidate><h2>Sign in</h2><p class="sub">Use your own account. Your role and VRM come from the server, not from this page.</p>' +
      '<div id="login-msg">' + (message ? banner(type || 'warn', h(message)) : '') + '</div>' +
      '<div class="fld field"><label for="login-user">Your name</label>' + (list
        ? '<select id="login-user" name="user" autocomplete="username"><option value="">— Select your name —</option>' + bootstrapInfo.names.map(function (n) { return opt(n, n, false); }).join('') + '</select>'
        : '<input id="login-user" name="user" autocomplete="username" autocapitalize="words" spellcheck="false" placeholder="e.g. Parth Sharma">') + '</div>' +
      '<div class="fld field"><label for="login-pw">Password</label><div class="pw-wrap"><input type="password" id="login-pw" name="pw" autocomplete="current-password" data-caps="1" required>' +
      '<button type="button" class="pw-eye" data-action="toggle-pw" data-target="login-pw" aria-label="Show password" aria-pressed="false">' + svg('eye') + '</button></div></div>' +
      '<div class="caps" data-caps-note hidden>' + svg('warn') + 'Caps Lock is on</div>' +
      '<div class="auth-row"><label class="check"><input type="checkbox" id="login-remember" name="remember"> Keep me signed in on this device for 7 days</label></div>' +
      '<button class="btn block" id="login-btn" type="submit"><span class="lbl">Sign in</span></button>' +
      '<p class="auth-hint">Use “Keep me signed in” only on your own work device. Forgotten password or locked out? Ask an administrator to issue a temporary password.</p></form></div>';
    var u = $('#login-user');
    setTimeout(function () { (u && !u.value ? u : $('#login-pw')).focus(); }, 30);
    if (!bootstrapInfo) {
      Api.call('getLoginBootstrap', {}, { timeout: 20000 }).then(function (d) {
        bootstrapInfo = d;
        if (d.rosterMode === 'list' && $('#login-form') && !$('#login-pw').value) showLogin(message, type);
      }, function (e) {
        if (e.code === 'NETWORK' || e.code === 'TIMEOUT') { var m = $('#login-msg'); if (m && !m.innerHTML) m.innerHTML = banner('warn', 'The server is not reachable right now. You can still try to sign in.'); }
      });
    }
  }
  function showPasswordChange() {
    showScreen('auth');
    $('#auth').innerHTML = authBrand + '<div class="auth-panel">' + themeButton() + '<div class="auth-card"><h2>Set your password</h2><p class="sub">Welcome, ' + h(S.me ? S.me.name : '') + '. Replace your temporary password before continuing.</p>' + passwordForm('first-pw', true) + '</div></div>';
    setTimeout(function () { var f = $('#first-pw-currentPassword'); if (f) f.focus(); }, 30);
  }
  function enterApp() {
    showScreen('app');
    syncSideMode();
    setSync('wait', 'Loading…');
    $('#main').innerHTML = '<div class="loading-row" role="status">Loading data…</div>';
    refreshData({ noRender: true }).then(function () { renderRoute(); }, function (e) {
      if (!S.me) return;
      $('#main').innerHTML = banner('err', '<b>Could not load data.</b> ' + h(errMsg(e))) + '<button type="button" class="btn" data-action="refresh">Retry</button>';
    });
  }
  function logout(reason) {
    var im = S.ui.imp;
    if (im.commit && im.commit.status === 'running' && !window.confirm('An import is still running. Sign out anyway? Parts already saved stay saved.')) return;
    window.removeEventListener('beforeunload', guardUnload);
    var done = function () {
      Api.clearSession();
      resetUi();
      showLogin(reason || 'You have signed out.', 'ok');
    };
    if (Api.session) Api.call('logout', {}, { timeout: 8000 }).then(done, done); else done();
  }
  function resetUi() {
    S.me = null; S.loaded = false; S.vrms = []; S.counts = []; S.zero = [];
    var fresh = { trend: { mode: 'last12', vrmId: '' }, mis: { year: '', month: '', from: '', to: '', vrmId: '', sortKey: 'period', sortDir: 'desc' },
      input: { vrmId: '', date: '', text: '', result: null, pending: null, busy: false }, lookup: { text: '', results: null, busy: false },
      ledger: { q: '', vrmId: '', from: '', to: '', batchId: '', status: 'active', sort: 'date', dir: 'desc', page: 1, pageSize: 50, data: null, error: '', loading: false },
      logs: { from: '', to: '', actorId: '', eventAction: '', outcome: '', page: 1, pageSize: 50, data: null, error: '', loading: false },
      admin: { data: null, error: '', integrity: null }, manage: { tab: 'vrms', users: null, aliases: null, error: '' }, imp: newImport() };
    S.ui = fresh;
    $('#main').innerHTML = '';
  }
  function onAuthLost(err) {
    if (err.code === 'PASSWORD_CHANGE_REQUIRED') { showPasswordChange(); return; }
    Api.clearSession();
    window.removeEventListener('beforeunload', guardUnload);
    resetUi();
    var msg = { SESSION_EXPIRED: err.message, SESSION_REVOKED: 'Your session ended (signed out elsewhere, password changed or access updated). Please sign in again.',
      ACCOUNT_DISABLED: 'This account has been disabled. Contact an administrator.', AUTH_REQUIRED: 'Please sign in.' }[err.code] || err.message;
    showLogin(msg, err.code === 'ACCOUNT_DISABLED' ? 'err' : 'warn');
  }

  /* ================================ actions ================================ */
  var A = {
    'go': function (el) { go(el.getAttribute('data-route')); },
    'refresh': function () { refreshData().then(function () { toast('Data refreshed.', 'ok', 2500); }, function () { /* toast shown */ }); },
    'logout': function () { logout(); },
    'boot-retry': function () { boot(); },
    'toggle-theme': function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('vrm_theme', next); } catch (e) { /* ignore */ }
    },
    'toggle-side': function () {
      var app = $('#app');
      if (isMobile()) setSide(!app.classList.contains('side-open'));
      else { var col = !app.classList.contains('side-collapsed'); app.classList.toggle('side-collapsed', col); $('#menu-btn').setAttribute('aria-expanded', String(!col)); }
    },
    'close-side': function () { setSide(false); $('#menu-btn').focus(); },
    'toggle-pw': function (el) {
      var i = document.getElementById(el.getAttribute('data-target'));
      if (!i) return;
      var show = i.type === 'password';
      i.type = show ? 'text' : 'password';
      el.setAttribute('aria-pressed', String(show));
      el.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      el.innerHTML = svg(show ? 'eyeoff' : 'eye');
      i.focus();
    },
    'sort': function (el) {
      var table = el.getAttribute('data-table'), key = el.getAttribute('data-key');
      if (table === 'mis') {
        var f = S.ui.mis;
        f.sortDir = f.sortKey === key ? (f.sortDir === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc';
        f.sortKey = key;
        renderMisResults();
        var b = $('[data-table="mis"][data-key="' + key + '"]'); if (b) b.focus();
      } else if (table === 'ledger') {
        var L = S.ui.ledger;
        L.dir = L.sort === key ? (L.dir === 'asc' ? 'desc' : 'asc') : key === 'code' || key === 'vrm' ? 'asc' : 'desc';
        L.sort = key; L.page = 1;
        loadLedger();
      }
    },
    'mis-clear-range': function () { S.ui.mis.from = ''; S.ui.mis.to = ''; $('#mis-from').value = ''; $('#mis-to').value = ''; updateMisControls(); renderMisResults(); $('#mis-year').focus(); },
    'mis-reset': function () { S.ui.mis = { year: today().slice(0, 4), month: '', from: '', to: '', vrmId: '', sortKey: 'period', sortDir: 'desc' }; renderMis($('#view')); },
    'mis-export': function (el) {
      var f = S.ui.mis, all = el.getAttribute('data-all') === '1', fmt = el.getAttribute('data-fmt');
      var p = all ? C.resolvePeriod({ allTime: true }, today()) : misPeriod();
      if (!p.ok) { toast(p.error, 'warn'); return; }
      var filter = all ? { allTime: true } : { year: f.year, month: f.month, from: f.from, to: f.to, vrmId: f.vrmId };
      var vrmId = all ? '' : f.vrmId;
      exportReport(el, filter, { scope: vrmId ? vrmName(vrmId) : 'Whole team', period: p.label, expected: metricsFor(p, vrmId).scopeTotals.period }, fmt);
    },
    'input-clear': function () { var ta = $('#in-codes'); ta.value = ''; S.ui.input.text = ''; updatePasteStats(); ta.focus(); },
    'input-retry': function () { submitPendingCodes(); },
    'input-discard': function () { S.ui.input.pending = null; S.ui.input.result = null; renderInputResult(); },
    'input-toggle-all': function () { var r = S.ui.input.result; r.showAll = !r.showAll; renderInputResult(); },
    'input-result-csv': function () {
      var r = S.ui.input.result;
      downloadCsv([['VRM', 'Activation date', 'Client code', 'Result', 'Detail', 'Existing owner', 'Existing date']].concat(r.results.map(function (x) {
        return [r.vrmName, r.date, x.input, C.STATUS_TEXT[x.status] || x.status, x.reason || '', x.owner ? x.owner.vrmName : '', x.owner ? x.owner.date : ''];
      })), 'VRM-MIS_entry-result_' + stamp() + '.csv');
    },
    'zero-report': function () {
      var u = S.ui.input, nm = vrmName(u.vrmId);
      openModal({ title: 'Report zero activations', confirmLabel: 'Confirm zero', html: '<p>Record that <b>' + h(nm) + '</b> had <b>no activations</b> on <b>' + h(C.fmtDate(u.date)) + '</b>? This does not add any activation. It is blocked if activations already exist for that date.</p>',
        onConfirm: function () {
          return Api.call('submitZeroReport', { vrmId: u.vrmId, date: u.date }, { requestId: C.uuid() }).then(function (d) {
            toast(d.alreadyReported ? 'A zero report already existed for this date.' : 'Zero report recorded for ' + C.fmtDate(u.date) + '.', 'ok');
            return refreshData({ quiet: true });
          });
        } });
    },
    'zero-withdraw': function () {
      var u = S.ui.input;
      confirmDialog('Withdraw zero report?', 'The date will show as <b>not reported</b> again for ' + h(vrmName(u.vrmId)) + '.', 'Withdraw').then(function (yes) {
        if (!yes) return;
        Api.call('withdrawZeroReport', { vrmId: u.vrmId, date: u.date }, { requestId: C.uuid() }).then(function () { toast('Zero report withdrawn.', 'ok'); refreshData({ quiet: true }); }, function (e) { toast(errMsg(e), 'err'); });
      });
    },
    'lookup-clear': function () { S.ui.lookup = { text: '', results: null }; $('#lk-codes').value = ''; renderLookupResults(); $('#lk-codes').focus(); },
    'ledger-reset': function () {
      S.ui.ledger = { q: '', vrmId: '', from: '', to: '', batchId: '', status: 'active', sort: 'date', dir: 'desc', page: 1, pageSize: 50, data: null, error: '', loading: false };
      renderLookup($('#view'));
    },
    'ledger-reload': function () { loadLedger(); },
    'ledger-page': function (el) { S.ui.ledger.page = +el.getAttribute('data-page'); loadLedger(); },
    'ledger-batch': function (el) {
      var L = S.ui.ledger;
      L.batchId = el.getAttribute('data-batch'); L.q = ''; L.vrmId = ''; L.from = ''; L.to = ''; L.page = 1; L.status = isRole('admin', 'reviewer') ? 'all' : 'active';
      if (S.route === 'lookup') renderLookup($('#view')); else go('lookup');
    },
    'entry-correct': function (el) {
      var e = entryFromLedger(el.getAttribute('data-id'));
      if (!e) return;
      openModal({ title: 'Correct entry', confirmLabel: 'Save correction', wide: true,
        html: '<p>Code <span class="code-pill">' + h(e.code) + '</span> keeps its record ID; the change is audited with before and after values.</p><div class="fields">' +
          '<div class="field"><label for="c-vrm">VRM</label><select id="c-vrm" name="vrmId">' + vrmOptions(e.vrmId, { activeOnly: true }) + '</select></div>' +
          '<div class="field"><label for="c-date">Activation date</label><input type="date" id="c-date" name="date" min="2000-01-01" max="' + today() + '" value="' + h(e.date) + '"></div></div>' +
          '<div class="field"><label for="c-reason">Reason (required)</label><input id="c-reason" name="reason" maxlength="500" autocomplete="off"></div>',
        onConfirm: function (form) {
          var reason = needReason(form), vrmId = fval(form, 'vrmId'), date = fval(form, 'date');
          if (vrmId === e.vrmId && date === e.date) throw new Error('Change the VRM or the date.');
          var dc = C.checkActivationDate(date, today());
          if (!dc.ok) throw new Error(dc.reason);
          return Api.call('correctEntry', { entryId: e.id, vrmId: vrmId, date: date, reason: reason }, { requestId: C.uuid() }).then(function () { afterEntryChange('Entry corrected.'); });
        } });
    },
    'entry-delete': function (el) {
      var e = entryFromLedger(el.getAttribute('data-id'));
      if (!e) return;
      openModal({ title: 'Delete entry', confirmLabel: 'Delete entry', danger: true,
        html: '<p>Remove <span class="code-pill">' + h(e.code) + '</span> (' + h(e.vrmName) + ', ' + h(C.fmtDate(e.date)) + ') from all totals? The record is kept as a tombstone, the code stays reserved and it can be restored.</p>' +
          '<div class="field"><label for="d-reason">Reason (required)</label><input id="d-reason" name="reason" maxlength="500" autocomplete="off"></div>',
        onConfirm: function (form) {
          var reason = needReason(form);
          return Api.call('softDeleteEntry', { entryId: e.id, reason: reason }, { requestId: C.uuid() }).then(function () { afterEntryChange('Entry deleted (restorable).'); });
        } });
    },
    'entry-restore': function (el) {
      var e = entryFromLedger(el.getAttribute('data-id'));
      if (!e) return;
      openModal({ title: 'Restore entry', confirmLabel: 'Restore',
        html: '<p>Restore <span class="code-pill">' + h(e.code) + '</span> for ' + h(e.vrmName) + ' on ' + h(C.fmtDate(e.date)) + '? It will count again; no second record is created.</p>' +
          '<div class="field"><label for="r-reason">Reason (required)</label><input id="r-reason" name="reason" maxlength="500" autocomplete="off"></div>',
        onConfirm: function (form) {
          var reason = needReason(form);
          return Api.call('restoreEntry', { entryId: e.id, reason: reason }, { requestId: C.uuid() }).then(function () { afterEntryChange('Entry restored.'); });
        } });
    },
    'template': function (el) {
      var fmt = el.getAttribute('data-fmt'), t = today();
      var names = activeVrms().map(function (v) { return v.name; });
      if (S.me.role === 'member') names = [vrmName(S.me.assignedVrmId)];
      var rows = [['VRM', 'Date', 'Client Code'], [names[0] || 'Parth Sharma', t, '000123'], [names[1] || names[0] || 'Khushi Dodiya', t, 'CL10002']];
      if (fmt === 'csv') { downloadCsv(rows, 'VRM-MIS_import-template.csv'); return; }
      loadXLSX().then(function (XLSX) {
        var ws = XLSX.utils.aoa_to_sheet(rows);
        for (var r = 1; r < rows.length; r++) [1, 2].forEach(function (c) { var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })]; cell.t = 's'; cell.z = '@'; });
        ws['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 18 }];
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Import');
        download(new Blob([XLSX.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'VRM-MIS_import-template.xlsx');
      }, function (e) { toast(errMsg(e), 'err'); });
    },
    'import-restart': function () {
      var c = S.ui.imp.commit;
      if (c && c.status === 'running') return;
      S.ui.imp = newImport();
      renderImport($('#view'));
    },
    'import-back': function () { S.ui.imp.step = 2; S.ui.imp.preview = null; renderImport($('#view')); },
    'import-filter': function (el) { S.ui.imp.filter = el.getAttribute('data-g'); S.ui.imp.page = 1; renderImportBody(); var b = $('[data-g="' + S.ui.imp.filter + '"]'); if (b) b.focus(); },
    'import-page': function (el) { S.ui.imp.page = +el.getAttribute('data-page'); renderImportBody(); },
    'import-exceptions': function () { downloadCsv(exceptionRows(), 'VRM-MIS_import-exceptions_' + slug(S.ui.imp.fileName) + '_' + stamp() + '.csv'); },
    'import-commit': function () {
      var im = S.ui.imp, ready = im.parsed.rows.filter(function (r) { return rowStatus(r).status === 'ACCEPTED'; }).length;
      var approve = im.preview.newVrmNames.filter(function (n) { return im.approve[C.nameKey(n)]; });
      openModal({ title: 'Import rows', confirmLabel: 'Start import',
        html: '<p>Save about <b>' + C.fmtInt(ready) + '</b> new activation(s) from <b>' + h(im.fileName) + '</b>' + (approve.length ? ' and create <b>' + approve.length + '</b> new VRM(s): ' + h(approve.join(', ')) : '') + '?</p><p>The server checks every row again. Each part is saved at most once, even if the connection drops and the part is retried.</p>',
        onConfirm: function () { setTimeout(startCommit, 0); } });
    },
    'import-stop': function () {
      var c = S.ui.imp.commit;
      if (c.status === 'paused') { c.status = 'running'; cancelCommit(); return; }
      c.stopRequested = true;
      renderImportBody();
    },
    'import-resume': function () { var c = S.ui.imp.commit; c.status = 'running'; c.error = ''; c.attempts = 0; renderImportBody(); commitNext(); },
    'admin-reload': function () { loadAdmin(); },
    'integrity': function (el) {
      busy(el, true);
      Api.call('integrityReport', {}, { timeout: 120000 }).then(function (d) { S.ui.admin.integrity = d; }, function (e) { S.ui.admin.integrity = { error: errMsg(e) }; }).then(function () { renderAdminBody(); });
    },
    'logs-reset': function () { S.ui.logs = { from: '', to: '', actorId: '', eventAction: '', outcome: '', page: 1, pageSize: 50, data: S.ui.logs.data, error: '' }; renderActivity($('#view')); },
    'logs-page': function (el) { S.ui.logs.page = +el.getAttribute('data-page'); loadLogs(); },
    'logs-export': function (el) {
      busy(el, true);
      var rows = [['Time (IST)', 'Actor', 'Role', 'Action', 'Outcome', 'VRM', 'Entity', 'Details', 'Change', 'Request ID']], page = 1;
      var next = function () {
        return Api.call('getLogs', logParams(page, 200)).then(function (d) {
          d.items.forEach(function (a) { rows.push([fmtTs(a.time), a.actor, a.role, actionLabel(a.action), a.outcome, a.vrmName, a.entityType + ' ' + a.entityId, a.detail, changeText(a), a.requestId]); });
          if (page < d.pages && page < 50) { page++; return next(); }
          return d;
        });
      };
      next().then(function (d) { downloadCsv(rows, 'VRM-MIS_activity-log_' + stamp() + '.csv'); toast('Exported ' + (rows.length - 1) + ' event(s)' + (d.pages > 50 ? ' (first 10,000 only; narrow the filters)' : '') + '.', 'ok'); }, function (e) { toast('Export failed: ' + errMsg(e), 'err'); }).then(function () { busy(el, false); });
    },
    'manage-tab': function (el) {
      S.ui.manage.tab = el.getAttribute('data-tab');
      S.ui.manage.error = '';
      renderManage($('#view'));
      var t = $('#tab-' + S.ui.manage.tab); if (t) t.focus();
    },
    'vrm-rename': function (el) {
      var v = vrmById(el.getAttribute('data-id'));
      openModal({ title: 'Rename VRM', confirmLabel: 'Rename', html: '<p>History stays attached: the VRM keeps its ID and the old spelling becomes an alias for future imports.</p><div class="field"><label for="rn-name">New name</label><input id="rn-name" name="name" maxlength="100" value="' + h(v.name) + '" autocomplete="off"></div>',
        onConfirm: function (form) {
          var name = C.displayName(fval(form, 'name'));
          if (!name || name === v.name) throw new Error('Enter a different name.');
          return Api.call('renameVRM', { vrmId: v.id, newName: name }, { requestId: C.uuid() }).then(function () { toast('Renamed to ' + name + '.', 'ok'); S.ui.manage.aliases = null; return refreshData({ quiet: true }); });
        } });
    },
    'vrm-archive': function (el) {
      var v = vrmById(el.getAttribute('data-id'));
      openModal({ title: 'Archive ' + v.name, confirmLabel: 'Archive', danger: true, html: '<p>Archived VRMs cannot receive new entries and leave the active roster count. <b>All history is kept</b> and still counts in historical and team totals. You can restore the VRM later.</p><div class="field"><label for="ar-reason">Reason (required)</label><input id="ar-reason" name="reason" maxlength="500" autocomplete="off"></div>',
        onConfirm: function (form) { var r = needReason(form); return Api.call('archiveVRM', { vrmId: v.id, reason: r }, { requestId: C.uuid() }).then(function () { toast(v.name + ' archived.', 'ok'); return refreshData({ quiet: true }); }); } });
    },
    'vrm-restore': function (el) {
      var v = vrmById(el.getAttribute('data-id'));
      confirmDialog('Restore ' + h(v.name) + '?', 'The VRM becomes active again and can receive new entries.', 'Restore').then(function (yes) {
        if (yes) Api.call('restoreVRM', { vrmId: v.id }, { requestId: C.uuid() }).then(function () { toast(v.name + ' restored.', 'ok'); refreshData({ quiet: true }); }, function (e) { toast(errMsg(e), 'err'); });
      });
    },
    'alias-remove': function (el) {
      var key = el.getAttribute('data-key'), label = el.getAttribute('data-label');
      confirmDialog('Remove alias?', 'Files spelling the name as “' + h(label) + '” will no longer resolve automatically. Existing records are not affected.', 'Remove', true).then(function (yes) {
        if (yes) Api.call('removeAlias', { aliasKey: key }, { requestId: C.uuid() }).then(function () { toast('Alias removed.', 'ok'); loadAliases(); }, function (e) { toast(errMsg(e), 'err'); });
      });
    },
    'user-create': function () {
      var temp = genPassword();
      openModal({ title: 'Create account', confirmLabel: 'Create account', wide: true,
        html: '<div class="fields"><div class="field"><label for="nu-name">Full name (used to sign in)</label><input id="nu-name" name="name" maxlength="100" autocomplete="off"></div></div>' + roleFields({ role: 'member', assignedVrmId: '' }) +
          '<div class="field"><label for="nu-pw">Temporary password</label><input id="nu-pw" name="tempPassword" value="' + h(temp) + '" spellcheck="false" autocomplete="off"></div>',
        onConfirm: function (form) {
          var name = C.displayName(fval(form, 'name')), pw = fval(form, 'tempPassword');
          if (!name) throw new Error('Enter the person’s name.');
          return Api.call('createUser', { name: name, role: fval(form, 'role'), assignedVrmId: fval(form, 'assignedVrmId'), tempPassword: pw }, { requestId: C.uuid() }).then(function () {
            loadUsers(); setTimeout(function () { showTempPassword(name, pw); }, 50);
          });
        } });
    },
    'user-edit': function (el) {
      var u = userById(el.getAttribute('data-id'));
      openModal({ title: 'Role and VRM — ' + u.name, confirmLabel: 'Save', wide: true, html: roleFields(u) + '<p class="hint">Saving signs this person out of all devices so the new access applies immediately.</p>',
        onConfirm: function (form) {
          return Api.call('updateUser', { userId: u.id, role: fval(form, 'role'), assignedVrmId: fval(form, 'assignedVrmId') }, { requestId: C.uuid() }).then(function () { toast('Access updated for ' + u.name + '.', 'ok'); loadUsers(); });
        } });
    },
    'user-reset': function (el) {
      var u = userById(el.getAttribute('data-id')), temp = genPassword();
      openModal({ title: 'Reset password — ' + u.name, confirmLabel: 'Reset password', danger: true, html: '<p>Issues a new temporary password, signs ' + h(u.name) + ' out everywhere and requires a new password at next sign-in.</p><div class="field"><label for="rp-pw">Temporary password</label><input id="rp-pw" name="tempPassword" value="' + h(temp) + '" spellcheck="false" autocomplete="off"></div>',
        onConfirm: function (form) {
          var pw = fval(form, 'tempPassword');
          return Api.call('resetUserPassword', { userId: u.id, tempPassword: pw }, { requestId: C.uuid() }).then(function () { loadUsers(); setTimeout(function () { showTempPassword(u.name, pw); }, 50); });
        } });
    },
    'user-unlock': function (el) {
      var u = userById(el.getAttribute('data-id'));
      Api.call('unlockUser', { userId: u.id }, { requestId: C.uuid() }).then(function () { toast(u.name + ' unlocked.', 'ok'); loadUsers(); }, function (e) { toast(errMsg(e), 'err'); });
    },
    'user-active': function (el) {
      var u = userById(el.getAttribute('data-id')), on = el.getAttribute('data-on') === '1';
      openModal({ title: (on ? 'Enable ' : 'Disable ') + u.name, confirmLabel: on ? 'Enable' : 'Disable account', danger: !on,
        html: on ? '<p>' + h(u.name) + ' will be able to sign in again.</p>' : '<p>' + h(u.name) + ' is signed out immediately and cannot sign in. Their records are not changed.</p><div class="field"><label for="ua-reason">Reason (required)</label><input id="ua-reason" name="reason" maxlength="500" autocomplete="off"></div>',
        onConfirm: function (form) {
          var p = { userId: u.id, active: on };
          if (!on) p.reason = needReason(form);
          return Api.call('setUserActive', p, { requestId: C.uuid() }).then(function () { toast(u.name + (on ? ' enabled.' : ' disabled.'), 'ok'); loadUsers(); });
        } });
    },
    'copy-temp': function () {
      var i = $('#tmp-pw');
      if (navigator.clipboard) navigator.clipboard.writeText(i.value).then(function () { toast('Copied.', 'ok', 2000); }, function () { i.select(); });
      else i.select();
    }
  };

  /* ================================ forms ================================ */
  var F = {
    noop: function () {},
    login: function (form) {
      var user = String(fval(form, 'user')).trim(), pw = fval(form, 'pw'), remember = fval(form, 'remember'), msg = $('#login-msg'), btn = $('#login-btn');
      msg.innerHTML = '';
      if (!user) { msg.innerHTML = banner('err', 'Enter your name.'); $('#login-user').focus(); return; }
      if (!pw) { msg.innerHTML = banner('err', 'Enter your password.'); $('#login-pw').focus(); return; }
      busy(btn, true);
      $('.lbl', btn).textContent = 'Signing in…';
      Api.call('login', { user: user, pw: pw, remember: !!remember }, { timeout: 45000 }).then(function (d) {
        Api.setSession({ token: d.token, expiresAt: d.expiresAt, remember: !!remember });
        S.me = d.me;
        if (d.me.mustChangePassword) showPasswordChange(); else enterApp();
      }, function (e) {
        busy(btn, false);
        $('.lbl', btn).textContent = 'Sign in';
        var text = e.code === 'NETWORK' || e.code === 'TIMEOUT' ? 'Can’t reach the server. Check your connection and try again.' : e.code === 'CLIENT_UPGRADE_REQUIRED' ? 'The server is running a different version. Reload the page.' : e.message;
        msg.innerHTML = banner('err', h(text));
        var p = $('#login-pw'); p.value = ''; p.focus();
      });
    },
    'change-password': function (form) {
      var err = $('[data-form-err]', form), btn = $('button[type="submit"]', form);
      var cur = fval(form, 'currentPassword'), np = fval(form, 'newPassword'), cf = fval(form, 'confirm');
      var min = (S.config && S.config.minPasswordLength) || 12;
      err.hidden = true;
      var fail = function (m) { err.textContent = m; err.hidden = false; };
      if (!cur) return fail('Enter your current password.');
      if (np.length < min) return fail('The new password must be at least ' + min + ' characters.');
      if (np !== cf) return fail('The new passwords do not match.');
      if (np === cur) return fail('Choose a password different from the current one.');
      busy(btn, true);
      Api.call('changePassword', { currentPassword: cur, newPassword: np }).then(function (d) {
        S.me = d.me;
        toast('Password changed. Other devices have been signed out.', 'ok');
        if (form.id === 'first-pw') enterApp(); else { form.reset(); busy(btn, false); }
      }, function (e) { busy(btn, false); fail(e.message); });
    },
    'save-codes': function (form) {
      var u = S.ui.input;
      if (u.busy) return;
      if (u.pending) { toast('The previous submission is not confirmed yet. Retry it safely or discard it first.', 'warn'); return; }
      var ta = $('#in-codes'), a = C.analyzePaste(ta.value);
      var date = $('#in-date').value, dc = C.checkActivationDate(date, today());
      if (!u.vrmId || !canWrite(u.vrmId)) { toast('Choose a VRM you may record for.', 'warn'); return; }
      if (!dc.ok) { toast('Activation date: ' + dc.reason, 'warn'); $('#in-date').focus(); return; }
      if (!a.summary.tokens) { toast('Enter at least one client code.', 'warn'); ta.focus(); return; }
      if (a.summary.tokens > C.MAX_ROWS) { toast('Submit at most ' + C.MAX_ROWS + ' codes at a time, or use the import screen.', 'warn'); return; }
      u.date = date;
      u.text = ta.value;
      u.pending = { requestId: C.uuid(), payload: { vrmId: u.vrmId, date: date, codes: a.codes } };
      u.result = null;
      renderInputResult();
      submitPendingCodes();
    },
    lookup: function (form) {
      var text = $('#lk-codes').value, codes = C.splitCodes(text), btn = $('#lk-btn');
      S.ui.lookup.text = text;
      if (!codes.length) { toast('Enter at least one client code.', 'warn'); return; }
      if (codes.length > 500) { toast('Look up at most 500 codes at a time.', 'warn'); return; }
      busy(btn, true);
      Api.call('lookupCodes', { codes: codes }).then(function (d) { S.ui.lookup.results = d.results; }, function (e) { S.ui.lookup.results = { error: errMsg(e) }; }).then(function () { busy(btn, false); renderLookupResults(); });
    },
    ledger: function (form) {
      var L = S.ui.ledger;
      ['q', 'vrmId', 'from', 'to', 'batchId'].forEach(function (k) { L[k] = String(fval(form, k) || '').trim(); });
      if (form.elements.status) L.status = fval(form, 'status');
      L.pageSize = +fval(form, 'pageSize') || 50;
      L.page = 1;
      loadLedger();
    },
    logs: function (form) {
      var L = S.ui.logs;
      ['from', 'to', 'actorId', 'eventAction', 'outcome'].forEach(function (k) { L[k] = fval(form, k); });
      L.page = 1;
      loadLogs();
    },
    'import-preview': function (form) { runPreview(form); },
    'vrm-add': function (form) {
      var name = C.displayName(fval(form, 'name')), btn = $('button[type="submit"]', form);
      if (!name) { toast('Enter a VRM name.', 'warn'); return; }
      busy(btn, true);
      Api.call('addVRM', { name: name }, { requestId: C.uuid() }).then(function () { toast(name + ' added.', 'ok'); return refreshData({ quiet: true }); }, function (e) { toast(errMsg(e), 'err'); busy(btn, false); });
    },
    'alias-add': function (form) {
      var alias = C.displayName(fval(form, 'alias')), vrmId = fval(form, 'vrmId'), btn = $('button[type="submit"]', form);
      if (!alias || !vrmId) { toast('Enter the alias and choose a VRM.', 'warn'); return; }
      busy(btn, true);
      Api.call('addAlias', { alias: alias, vrmId: vrmId }, { requestId: C.uuid() }).then(function (d) { toast(d.alreadyExists ? 'That alias already exists.' : 'Alias added.', 'ok'); loadAliases(); }, function (e) { toast(errMsg(e), 'err'); busy(btn, false); });
    }
  };

  var CH = {
    trend: function () { S.ui.trend.vrmId = $('#trend-scope').value; S.ui.trend.mode = $('#trend-range').value; var b = $('#trend-body'); if (b) { b.innerHTML = trendBody(trendSeries()); drawCharts(); } },
    mis: function (el) {
      var f = S.ui.mis;
      f[el.name] = el.value;
      updateMisControls();
      renderMisResults();
    },
    'input-vrm': function (el) { S.ui.input.vrmId = el.value; renderInputStatus(); },
    'input-date': function (el) { S.ui.input.date = el.value; renderInputStatus(); },
    'import-file': function (el) { var f = el.files && el.files[0]; if (f) readImportFile(f); },
    'import-sheet': function (el) { selectSheet(el.value); renderImportBody(); },
    'import-mode': function (el) { S.ui.imp.mode = el.value; renderImportBody(); },
    'import-head': function (el) { var im = S.ui.imp; im.headerRow = +el.value; im.map = C.autoMapHeaders((im.grid[im.headerRow] || []).map(C.cellText)); renderImportBody(); },
    'import-listheader': function (el) { S.ui.imp.listHeader = el.checked; renderImportBody(); },
    'import-approve': function (el) { S.ui.imp.approve[el.getAttribute('data-key')] = el.checked; renderImportBody(); var cb = $('[data-key="' + el.getAttribute('data-key') + '"]'); if (cb) cb.focus(); }
  };
  var IN = {
    paste: function (el) { S.ui.input.text = el.value; updatePasteStats(); }
  };

  /* ================================ boot ================================ */
  /* Partial re-renders replace the focused control. Restore focus to its replacement (or the content region)
     so keyboard and screen-reader users never fall back to the top of the document. */
  var lastFocusKey = null;
  function focusKey(el) {
    if (!el || el === document.body || !el.getAttribute) return null;
    if (el.id) return '#' + CSS.escape(el.id);
    var a = el.getAttribute('data-action');
    if (!a) return null;
    var sel = '[data-action="' + CSS.escape(a) + '"]';
    ['data-id', 'data-key', 'data-g', 'data-page', 'data-fmt', 'data-all', 'data-tab', 'data-batch', 'data-table'].forEach(function (k) {
      var v = el.getAttribute(k);
      if (v !== null) sel += '[' + k + '="' + CSS.escape(v) + '"]';
    });
    return sel;
  }
  function watchFocus() {
    document.addEventListener('focusin', function (e) { if ($('#main').contains(e.target)) lastFocusKey = focusKey(e.target); });
    new MutationObserver(function () {
      var a = document.activeElement;
      if (modalOpen || (a && a !== document.body && document.contains(a))) return;
      var main = $('#main');
      if ($('#app').hidden) return;
      var t = lastFocusKey && main.querySelector(lastFocusKey);
      if (t && !t.disabled && t.offsetParent !== null) t.focus({ preventScroll: true });
      else main.focus({ preventScroll: true });
    }).observe($('#main'), { childList: true, subtree: true });
  }

  function bindGlobal() {
    watchFocus();
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      var fn = A[el.getAttribute('data-action')];
      if (!fn) return;
      if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
      fn(el, e);
    });
    document.addEventListener('submit', function (e) {
      var f = e.target, name = f.getAttribute('data-submit');
      if (!name || !F[name]) return;
      e.preventDefault();
      F[name](f, e);
    });
    document.addEventListener('change', function (e) {
      var el = e.target.closest('[data-change]');
      if (el && CH[el.getAttribute('data-change')]) CH[el.getAttribute('data-change')](el, e);
    });
    document.addEventListener('input', function (e) {
      var el = e.target.closest('[data-input]');
      if (el && IN[el.getAttribute('data-input')]) IN[el.getAttribute('data-input')](el, e);
    });
    var caps = function (e) {
      if (!e.target.getAttribute || !e.target.getAttribute('data-caps') || !e.getModifierState) return;
      var form = e.target.form, note = form && $('[data-caps-note]', form);
      if (note) note.hidden = !e.getModifierState('CapsLock');
    };
    document.addEventListener('keydown', caps);
    document.addEventListener('keyup', caps);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modalOpen && $('#app').classList.contains('side-open')) { setSide(false); $('#menu-btn').focus(); }
    });
    window.addEventListener('hashchange', renderRoute);
    window.addEventListener('online', function () { if (S.me) refreshData({ quiet: true }).catch(function () {}); });
    window.addEventListener('offline', function () { setSync('off', 'Offline — select to retry'); });
    window.addEventListener('storage', function (e) {
      if (e.key === Api.SKEY && !e.newValue && S.me && Api.session && Api.session.remember) { Api.session = null; resetUi(); showLogin('You signed out in another tab.', 'info'); }
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && S.me && S.loaded && Date.now() - lastAuto > 60000) { lastAuto = Date.now(); refreshData({ quiet: true }).catch(function () {}); }
    });
    window.matchMedia('(max-width:1100px)').addEventListener('change', syncSideMode);
  }
  var lastAuto = Date.now(), lastDay = '';
  function tick() {
    if (!S.me || !S.loaded) return;
    var t = today();
    if (lastDay && t !== lastDay) { toast('A new business day has started (IST). Figures now show ' + C.fmtDate(t) + '.', 'info'); updateToday(); rerenderData(); }
    lastDay = t;
    if (document.visibilityState === 'visible' && Date.now() - lastAuto > 5 * 60000 && !modalOpen && Api.inflight === 0) { lastAuto = Date.now(); refreshData({ quiet: true }).catch(function () {}); }
  }

  function boot() {
    Api.onBusyChange = function (n) { $('#topline').classList.toggle('show', n > 0); };
    Api.onAuthLost = onAuthLost;
    Api.onNetwork = function (ok) { if (!ok && S.me) setSync('off', 'Offline — select to retry'); };
    var session = Api.init();
    if (!Api.url) { showBoot('This dashboard is not connected to its v3 backend yet. An administrator must set the API URL in config.js after the approved deployment (see docs/06_DEPLOYMENT_RUNBOOK.md).', false); return; }
    if (!session) { showLogin(); return; }
    showBoot('Restoring your session…');
    Api.call('getData', {}, { timeout: 45000 }).then(function (d) {
      applySnapshot(d);
      showScreen('app');
      syncSideMode();
      setSync('ok', 'Synced ' + timeIST(d.asOf));
      renderRoute();
    }, function (e) {
      if (e.code === 'PASSWORD_CHANGE_REQUIRED' || ['AUTH_REQUIRED', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'ACCOUNT_DISABLED'].indexOf(e.code) >= 0) return; // handled by onAuthLost
      showBoot(e.code === 'NETWORK' || e.code === 'TIMEOUT' ? 'The server could not be reached. Nothing is shown until data can be loaded from the server.' : 'Could not load data: ' + errMsg(e), true);
    });
  }

  bindGlobal();
  setInterval(tick, 30000);
  boot();
})();
