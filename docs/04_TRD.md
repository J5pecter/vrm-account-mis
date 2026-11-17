# 04 · Technical Requirements — VRM Account MIS v3

## 1. Components
| Component | Tech | Notes |
|---|---|---|
| Frontend | Static HTML/CSS/ES5-compatible JS, no build | `index.html`, `config.js`, `assets/css/app.css`, `assets/js/{theme-init,core,api,app}.js` |
| Spreadsheet library | SheetJS 0.20.3, self-hosted | Loaded on demand with SRI `sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT` (v2 used CDN 0.18.5, which has published CVEs) |
| Backend | Google Apps Script V8 | `backend/Code.gs`, `backend/appsscript.json` (time zone Asia/Kolkata) |
| Store | Private Google Sheet | Schema in [08_DATA_DICTIONARY.md](08_DATA_DICTIONARY.md) |
| Tooling | Node ≥20 | emulator, dev server, tests, migration and reconciliation scripts |

## 2. Protocol
`POST <exec URL>` with `Content-Type: text/plain`, body JSON `{action, token?, requestId?, ...}`. Response envelope
`{ok, apiVersion: 3, requestId, serverTime, today, data | error:{code, message, details}}`. Contract: [07_API_CONTRACT.md](07_API_CONTRACT.md).
Mutations require `requestId` (8–120 chars `[A-Za-z0-9_:-]`); the same ID replays the stored result. Bodies > 3,000,000 chars are refused.

## 3. Authentication & sessions
- Name (case/space-insensitive) + password. Hash: `HMAC_SHA256(pepper, PBKDF2_SHA256(password, salt, 1000))`; algorithm string stored
  per user (`pbkdf2-sha256$1000`) to allow upgrades. Constant-time compare.
- Lockout: 5 consecutive failures → 15 min (`locked_until`); unknown names throttled in CacheService; failure audit capped.
- Token: 96 hex chars from three UUIDv4; only `SHA-256("session|"+token)` stored. Expiry 12 h / 7 d (remember);
  idle 120 min / 72 h; `last_seen_at` refreshed at most every 5 min (under a short lock).
- Revocation: logout; password change (other sessions); reset, role change, disable (all sessions).
- Browser: token in `sessionStorage` (default) or `localStorage` (“keep me signed in”); v2 keys `vrm_pw`, `vrm_role`, `vrm_user`,
  `vrm_api` are deleted on load. Cross-tab sign-out via the `storage` event (remembered sessions).

## 4. Validation (identical in `core.js` and `Code.gs`, parity-tested on a 330-string fuzz corpus)
- **Code:** string only; trim; NFKC; 1–70 code points; no whitespace, no Unicode category C (control/format/unassigned/private);
  not starting `= + - @`; optional `CODE_PATTERN` (unicode regex). Key = NFKC(trimmed).toUpperCase().
- **Date:** `^\d{4}-\d{2}-\d{2}$`, real Gregorian date, year ≥ 2000, ≤ today in IST (server clock).
- **Names:** NFKC, collapse spaces; 2–100 chars, letters/marks/space/`.`/`'`/`-`, starting with a letter.
- **Reasons:** 3–500 chars, no control characters.

## 5. Writes
All mutations: authenticate → role check (denials audited) → `LockService.getScriptLock().tryLock(25 s)` (else `BUSY`, nothing
written) → clear per-request cache (fresh reads) → idempotency lookup → handler → audit → idempotency record → flush → release.
Entries carry `request_id`; if a previous attempt wrote rows but failed before responding, a retry reports those rows as
`ADDED/ACCEPTED (recovered)` instead of duplicates. Writes use `setNumberFormat('@')` + `setValues` (text cells; no formulas).

## 6. Import
Browser parses (`XLSX.read`: CSV as raw strings with UTF-8 → Windows-1252 fallback; XLSX with cell types), builds a cell grid,
maps columns (exact aliases, see templates/README), runs client checks (`core.buildImportRows`), calls `previewImport` per ≤1,500
rows, then `commitImport` per part with `requestId = batchId:index`. Server creates/updates the `ImportBatches` register
(`file_rows`, `client_rejected`, `chunks_committed`, outcome counters, status `in_progress|completed|cancelled`).
Admin-approved new VRMs are created inside the first part. Members: foreign VRM → `UNAUTHORIZED_VRM`, unknown → `UNKNOWN_VRM`.

## 7. Calculations
`core.computeMetrics` over `(vrmId, date, count)`: today/month/year from the IST date (server-offset corrected clock), period by
`resolvePeriod` (mirrors `resolvePeriod_`), team = Σ VRMs (active + archived with history), share with zero-safe denominator.
Server `exportReport` computes the same period, checks Σ summary = detail rows before responding; the client compares the total
with its own figure and refreshes when they differ. Day rollover at IST midnight triggers a re-render.

## 8. Non-functional
| Area | Requirement / result |
|---|---|
| Performance (emulator) | 50k entries: getData p95 0.83 s; 100-code add p95 0.72 s; 1,500-row chunk ≈1.0 s (docs/perf-results.json). Google latency NOT TESTED. |
| Payload | getData ≈77 KB at 2.7k entries (counts, not codes) |
| Limits | 1,500 codes/rows per request; 500 lookups; 200 rows per page; 10 MB import file; Sheets 10M cells |
| Browsers | Tested: Microsoft Edge 156 (Windows) at 360–1920 px and 125/150 % zoom equivalents. Chrome Android/iOS Safari NOT TESTED. |
| Accessibility | Labels on every control (tested), skip link, focus trap + ESC + focus restore in modals, focus kept across re-renders, aria-live results, table alternative for the chart, reduced motion |
| Observability | Internal errors logged to Stackdriver with server request ID; clients see `INTERNAL` + reference only |

## 9. Security headers
GitHub Pages cannot set HTTP headers; CSP is delivered by `<meta>` (no `frame-ancestors` possible: clickjacking residual risk
documented in docs/09). `referrer=no-referrer`, `robots=noindex`.
