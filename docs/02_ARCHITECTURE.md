# 02 · Architecture and decisions — VRM Account MIS v3

## 1. Baseline found (audit of `J5pecter/vrm-account-mis` @ `c88bd4d`, 17 Nov 2026)
- Repository contained only `index.html` (single file, ~2,000 lines) and `README.md`. The README described `backend/Code.gs`,
  `backend/appsscript.json` and `sample-import.csv`; **none were ever committed** (verified through full git history).
- The frontend embedded the production Apps Script `/exec` URL and a constant `API_TOKEN`; authenticated with **two shared role
  passwords** sent on every request and stored in `localStorage`/`sessionStorage`; the audit actor was a **self-reported name**
  editable in the UI plus a **public IP fetched from api.ipify.org**.
- The live backend (not in the repo) decided role purely from which shared password was sent, so a member could not be bound to a
  VRM server-side. The production backend and Sheet were **not inspected** (no access granted); see issue OI-01.
Full defect list: [12_TRACEABILITY_AND_TEST_RESULTS.md §1](12_TRACEABILITY_AND_TEST_RESULTS.md).

## 2. Target architecture
```
Browser (GitHub Pages origin)
  index.html + assets/ + vendor/ (CSP: script-src 'self', no inline code)
  │  fetch POST /exec, body = JSON as text/plain (simple CORS request; Apps Script has no OPTIONS handler)
  │  { action, token, requestId, ...params }  →  302 → script.googleusercontent.com → JSON envelope
  ▼
Google Apps Script Web App (backend/Code.gs, V8, executes as the service-owner account)
  doPost → route table (auth level, roles, write?) → authenticate → authorise → [LockService script lock]
         → idempotency check → handler (validate, normalise, fresh duplicate check, persist) → audit → flush → respond
  ▼
Private Google Sheet (owner + named admins only; tabs protected)
  Meta · VRMs · Users · Entries · Aliases · ImportBatches · AuditEvents · Sessions · ZeroReports · IdempotencyRequests
  + Script Properties: SPREADSHEET_ID, PASSWORD_PEPPER, optional policy flags
  + Daily Drive backup copy (installTriggers) · hourly maintenance (expired sessions / idempotency rows)
```

### Trust boundaries
| Zone | Holds | Never holds |
|---|---|---|
| Public repo / GitHub Pages | UI code, docs, fictional templates, test fixtures with fictional names | Passwords, tokens, Sheet IDs, deployment IDs, client data |
| Browser | Short-lived bearer token (sessionStorage; localStorage only with “keep me signed in”), UI state | Passwords after sign-in, role decisions |
| Apps Script | Authentication, authorisation, validation, uniqueness, audit actor, timestamps | — |
| Sheet + Script Properties | All business data, hashed tokens, salted+peppered password hashes, pepper | — |

### Read model
`getData` returns the roster plus **(vrmId, activationDate, count)** rows for active entries in the caller's scope and the zero
reports. All dashboard and MIS figures are computed from these rows by `core.computeMetrics` (same rules as the server's export).
Detail rows (codes) are only fetched on demand: ledger pages (`queryEntries`), `lookupCodes`, `exportReport`. This keeps the
dashboard payload small (≈77 KB at 2.7k entries) and limits code disclosure.

## 3. Key controls
- **Identity:** per-user accounts; PBKDF2-HMAC-SHA256 (1,000 iterations, per-user salt) then HMAC with a server pepper; lockout
  5 failures/15 min (persistent per account; cache-based for unknown names); temporary passwords force a change.
- **Sessions:** 3×UUID random token, SHA-256 hash stored; absolute expiry 12 h (7 days remembered); idle timeout 2 h (72 h remembered);
  revoked on logout, password change/reset, role change, disable.
- **Authorisation:** route table with roles per action; members may write only for `assigned_vrm_id`; reviewers never write;
  denials are audited.
- **Integrity:** global `code_key` uniqueness including tombstones, re-read under the script lock; idempotency records +
  `request_id` on each entry so an interrupted write is recovered on retry, not duplicated; append-only audit with server time.
- **Output safety:** escaped rendering, strict CSP, formula-safe CSV, text-typed XLSX codes, no formula writes to the Sheet
  (codes/names may not start with `= + - @`; free text is prefixed).

## 4. Conflict and decision log
| # | Conflict / gap | Decision | Reversible? |
|---|---|---|---|
| D-01 | Reference backend (v2 kit) vs current frontend protocols incompatible | New API v3; legacy calls return `CLIENT_UPGRADE_REQUIRED`; new deployment, never in-place over v2 | Yes (old deployment untouched) |
| D-02 | Public login roster (v2 dropdown) vs least disclosure | Default typed name; `PUBLIC_LOGIN_ROSTER=true` restores the dropdown | Config |
| D-03 | Members seeing team data (v2 behaviour) vs “explicitly authorised scopes” | Default `MEMBER_SCOPE=team` (preserves v2); `own` restricts every read path | Config — **business decision needed** |
| D-04 | Duplicate owner disclosure to members | Shown in `team` scope, hidden in `own` scope; override `MEMBER_SEE_DUP_OWNER` | Config |
| D-05 | Code format undefined by business | Pilot rule: 1–70 chars after NFKC, no whitespace/control/invisible chars, not starting `= + - @`; optional `CODE_PATTERN` | Config — **business decision needed** |
| D-06 | “Delete VRM” in v2 cascaded entries | No delete endpoint; archive/restore only | — |
| D-07 | Transfer attribution policy (PRD) | Original attribution kept; admin correction changes it with audit | Policy — confirm |
| D-08 | Import rows that fail file checks | Not sent; counted as *rejected before upload* in the batch register | — |
| D-09 | Ambiguous `NN/NN/YYYY` dates | File-level evidence decides; otherwise flagged until the user chooses a format | — |
| D-10 | Numeric-typed Excel codes | Flagged; included only on explicit confirmation; scientific notation always rejected | — |
| D-11 | Minimum activation year | 2000 | Code constant |
| D-12 | Archived VRM history | Counts in historical/team totals; excluded from Active VRMs | — |
| D-13 | Password policy | ≥12 chars, ≠ name; no complexity rules (passphrases) | Code constant — confirm with IT |
| D-14 | SSO/MFA | Not available in Apps Script password model; recommended P2 (Google Workspace-restricted deployment or SQL backend + IdP) | — |

## 5. ADR-001: Google Sheets + Apps Script vs SQL
**Context.** Small team (≈9 VRMs, 3 admins), existing GitHub Pages UI, existing Google tooling, no approved database platform.

**Decision.** Keep Sheets + Apps Script for the controlled pilot, with every mutation serialised by the script lock and made
idempotent. Measured in the emulator: 50k entries → `getData` p95 0.83 s, 1,500-row import chunk ≈1.0 s (algorithmic cost only;
Sheets I/O not measured — OI-03).

**Limits accepted (documented, not hidden).** No transactional rollback across tabs (mitigated by write order + request-ID
recovery + integrity report); the script lock serialises all writers (throughput bound); audit rows are editable by the Sheet
owner (not tamper-proof); no SSO/MFA; quotas (6 min/execution, ≈20k URL-fetch irrelevant, Sheets 10M cells ⇒ ≈600k entries).

**Revisit when** any of: >25k entries with p95 load > 4 s on staging; >30 concurrent writers; SSO/MFA mandated; immutable audit
retention required by Compliance. Target then: PostgreSQL (e.g. Supabase or org-approved) with a unique index on `code_key`,
transactional imports, RLS and IdP login; keep the API contract (docs/07) so the UI is unchanged. Requires Product + IT approval.
