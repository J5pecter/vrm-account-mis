# VRM Account MIS (v3)

Daily MIS for **client-code activations** per Virtual Relationship Manager (VRM): record and import client codes,
reconcile team totals, review reporting status and audit every change.

> **Status (20 Nov 2026): v3 live** at https://j5pecter.github.io/vrm-account-mis/ on a new Apps Script backend and private Sheet
> owned by the repository owner. Switched by the owner's decision **without migrating v2 history** (the v2 Sheet is untouched and can
> be imported later with `scripts/migrate-legacy.mjs`). Open items: [docs/12 §8 and §10](docs/12_TRACEABILITY_AND_TEST_RESULTS.md).

```
Browser ──HTTPS──▶ GitHub Pages (this repo: static UI, no secrets)
                        │  POST text/plain JSON (session token in body)
                        ▼
              Google Apps Script Web App (backend/Code.gs)
              auth · RBAC · validation · LockService · idempotency · audit
                        │
                        ▼
              Private Google Sheet (VRMs, Entries, Users, Sessions, Aliases,
              ImportBatches, AuditEvents, ZeroReports, IdempotencyRequests, Meta)
```

## What “activation” means
One **distinct, accepted client code** recorded for a VRM and activation date. Codes are globally unique across all VRMs,
dates and imports (case-insensitive, Unicode-normalised, leading zeros kept). It is an operational proxy for “account opened”;
it is **not** verified against back-office account opening. There is no manual “count” entry.

## Repository layout
| Path | Purpose |
|---|---|
| `index.html`, `config.js`, `assets/` | Static frontend (no build step). `config.js` holds the public API URL only. |
| `assets/js/core.js` | Shared domain rules: code normalisation, IST dates, period filter, metric engine, import parsing, CSV escaping. |
| `assets/js/api.js`, `assets/js/app.js` | Session-token API client and the UI. |
| `vendor/xlsx-0.20.3.full.min.js` | Pinned, self-hosted SheetJS (loaded on demand with Subresource Integrity). |
| `backend/Code.gs`, `backend/appsscript.json` | Apps Script API v3 (source contains no credentials or IDs). |
| `templates/` | Fictional import templates. |
| `scripts/` | Local emulator server, legacy migration, reconciliation, static checks. |
| `tests/` | Unit, backend (emulator), migration, E2E (Playwright + Edge), performance. |
| `docs/` | Workflow, architecture, PRD, TRD, QA, runbook, API, data dictionary, threat model, migration, release notes, evidence. |

## Roles (enforced on the server)
| Role | Can |
|---|---|
| **Member (VRM)** | Record, import and file zero reports for **their own** VRM only; read team MIS (configurable to own-only). |
| **Admin** | Everything above for any VRM; roster (add/rename/archive/restore), aliases, user accounts, corrections, soft delete/restore, activity log. An admin may also be linked to a VRM. |
| **Reviewer** | Read-only: dashboards, MIS, exports, ledger, activity log. |

Every person has an individual account (name + password, PBKDF2-HMAC-SHA256 with a server-side pepper). Shared passwords are gone.

## Run locally (no Google account needed)
Requires Node 20+.
```bash
npm install
npm run dev
```
Then open http://127.0.0.1:8787 and sign in with an account from `tests/fixtures/local-users.json`
(fictional people, test-only passwords). `npm run dev` serves the UI and runs `backend/Code.gs` in a local
Apps Script **emulator** with synthetic demo data. It is not Google infrastructure.

## Tests
```bash
npm run check
```
```bash
npm test
```
```bash
npx playwright test
```
```bash
npm run test:perf
```
`check` = static release checks (syntax, handler coverage, CSP rules, SRI, secret scan). `npm test` = unit + backend + migration
tests in the emulator. Playwright runs the browser E2E suite with the installed Microsoft Edge (`PW_CHANNEL=chrome` for Chrome).

## Deploying
Follow [docs/06_DEPLOYMENT_RUNBOOK.md](docs/06_DEPLOYMENT_RUNBOOK.md): new private staging Sheet → Apps Script → `setup()` →
provision accounts → deploy Web App → set `config.js` `apiUrl` on a staging copy → run the staging checklist → migrate with
`scripts/migrate-legacy.mjs` + `scripts/reconcile.mjs` → approvals → cut over. **Do not point this frontend at the legacy v2
backend, and do not deploy the v3 backend over the production Sheet.**

## Daily operation
- VRMs record codes in **Analysis & Input** (or import a file) for the actual activation date; future dates are refused.
- If a VRM had no activations, they file a **zero report** so the desk shows “Confirmed zero” instead of “Not reported”.
- Admins check **Admin Overview** each evening: reporting status, import exceptions, corrections and backdated entries,
  and run **Data health** (integrity check).
- Mistakes are fixed by an admin in **Client Code Lookup** (correct / delete / restore, each with a reason). Nothing is hard-deleted.

## Security notes
- No passwords, tokens, Sheet IDs or client data in this repository. The old embedded `API_TOKEN` and `/exec` URL remain in git
  history and must be treated as public: retire the v2 deployment after cutover (see docs/09).
- Session tokens are random, stored hashed on the server, expire (12 h, or 7 days with “keep me signed in”), time out when idle
  and are revoked on sign-out, password change, role change or account disable.
- Strict Content-Security-Policy (no inline script/style), escaped rendering, formula-safe CSV exports, text-typed XLSX codes.
