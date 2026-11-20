/* VRM Account MIS - API client for the Apps Script backend (API v3). */
(function () {
  'use strict';
  var C = window.VRMCore;
  var SKEY = 'vrm_v3_session';
  var LEGACY_KEYS = ['vrm_pw', 'vrm_role', 'vrm_user', 'vrm_api'];
  var PUBLIC = { login: true, getLoginBootstrap: true, health: true };
  var AUTH_LOST = { AUTH_REQUIRED: true, SESSION_EXPIRED: true, SESSION_REVOKED: true, ACCOUNT_DISABLED: true, PASSWORD_CHANGE_REQUIRED: true };

  function ApiError(code, message, details, requestId) {
    var e = new Error(message);
    e.name = 'ApiError';
    e.code = code;
    e.details = details || null;
    e.requestId = requestId || '';
    /** True when the request may or may not have reached the server. */
    e.uncertain = code === 'NETWORK' || code === 'TIMEOUT' || code === 'BAD_RESPONSE';
    return e;
  }

  function store(kind) { try { return window[kind]; } catch (e) { return null; } }
  function readSession() {
    var raw = null;
    ['sessionStorage', 'localStorage'].some(function (k) { var s = store(k); raw = s && s.getItem(SKEY); return !!raw; });
    if (!raw) return null;
    try {
      var s = JSON.parse(raw);
      if (!s || typeof s.token !== 'string' || Date.parse(s.expiresAt) <= Date.now()) return null;
      return s;
    } catch (e) { return null; }
  }
  function writeSession(s) {
    clearSession();
    var target = store(s.remember ? 'localStorage' : 'sessionStorage');
    try { if (target) target.setItem(SKEY, JSON.stringify({ token: s.token, expiresAt: s.expiresAt, remember: !!s.remember })); } catch (e) { /* private mode: session lives in memory only */ }
  }
  function clearSession() {
    ['sessionStorage', 'localStorage'].forEach(function (k) { var s = store(k); try { if (s) s.removeItem(SKEY); } catch (e) { /* ignore */ } });
  }
  function purgeLegacy() {
    ['sessionStorage', 'localStorage'].forEach(function (k) {
      var s = store(k);
      LEGACY_KEYS.forEach(function (key) { try { if (s) s.removeItem(key); } catch (e) { /* ignore */ } });
    });
  }

  var Api = {
    url: (window.VRM_CONFIG && window.VRM_CONFIG.apiUrl) || '',
    session: null,
    serverOffset: 0,
    inflight: 0,
    onAuthLost: null,
    onBusyChange: null,
    onNetwork: null,
    ApiError: ApiError,
    SKEY: SKEY,

    init: function () {
      purgeLegacy();
      this.session = readSession();
      return this.session;
    },
    setSession: function (s) { this.session = s; writeSession(s); },
    clearSession: function () { this.session = null; clearSession(); },

    now: function () { return Date.now() + this.serverOffset; },
    today: function () { return C.todayIST(this.now()); },

    /**
     * POST one action. Resolves with `data`; rejects with ApiError.
     * opts: {timeout (ms), requestId (idempotency key for mutations)}
     */
    call: function (action, params, opts) {
      var self = this;
      opts = opts || {};
      if (!self.url) return Promise.reject(ApiError('SERVER_NOT_CONFIGURED', 'This dashboard is not connected to a backend.'));
      var body = Object.assign({}, params || {}, { action: action });
      if (!PUBLIC[action]) {
        if (!self.session) return Promise.reject(ApiError('AUTH_REQUIRED', 'Please sign in.'));
        body.token = self.session.token;
      }
      if (opts.requestId) body.requestId = opts.requestId;
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timedOut = false;
      var timer = setTimeout(function () { timedOut = true; if (ctrl) ctrl.abort(); }, opts.timeout || 45000);
      self.inflight++;
      if (self.onBusyChange) self.onBusyChange(self.inflight);
      return fetch(self.url, {
        method: 'POST',
        // text/plain keeps this a "simple" request: Apps Script has no OPTIONS handler for a CORS preflight.
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        redirect: 'follow',
        credentials: 'omit',
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        if (!res.ok) throw ApiError('BAD_RESPONSE', 'The server returned HTTP ' + res.status + '.');
        return res.text().then(function (text) {
          var j;
          try { j = JSON.parse(text); } catch (e) { throw ApiError('BAD_RESPONSE', 'The server sent an unreadable response.'); }
          if (j && j.serverTime) {
            var st = Date.parse(j.serverTime);
            if (!isNaN(st)) self.serverOffset = st - Date.now();
          }
          if (self.onNetwork) self.onNetwork(true);
          if (!j || j.ok !== true) {
            var er = (j && j.error) || {};
            var err = ApiError(er.code || 'BAD_RESPONSE', er.message || 'Request failed.', er.details, j && j.requestId);
            if (AUTH_LOST[err.code] && !PUBLIC[action] && self.onAuthLost) self.onAuthLost(err);
            throw err;
          }
          return j.data;
        });
      }, function (e) {
        if (self.onNetwork) self.onNetwork(false);
        if (timedOut) throw ApiError('TIMEOUT', 'The server did not respond in time. Your request may or may not have been saved.');
        throw ApiError('NETWORK', 'Could not reach the server. Check your connection.');
      }).then(function (data) {
        clearTimeout(timer);
        self.inflight--;
        if (self.onBusyChange) self.onBusyChange(self.inflight);
        return data;
      }, function (e) {
        clearTimeout(timer);
        self.inflight--;
        if (self.onBusyChange) self.onBusyChange(self.inflight);
        throw e.name === 'ApiError' ? e : ApiError('BAD_RESPONSE', 'Unexpected client error.');
      });
    }
  };

  window.VRMApi = Api;
})();
