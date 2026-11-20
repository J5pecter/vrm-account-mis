# 06 · Deployment, migration and rollback runbook

**Repository:** https://github.com/J5pecter/vrm-account-mis · **Public URL:** https://j5pecter.github.io/vrm-account-mis/
**Rule:** v3 runs on a **new** private Sheet and a **new** Apps Script project. The v2 Sheet, script and `main` stay untouched and
recoverable until sign-off. Nothing in this runbook has been executed against Google yet (status: BLOCKED — no access).

## 0. Prerequisites and approvals
| Gate | Owner | Evidence to file |
|---|---|---|
| Hosting model approved (public static UI + Internet-reachable Apps Script + private Sheet) | IT/Security | Approval note |
| Business decisions D-03, D-05, D-07, retention (docs/02 §4) | Product/Ops, Compliance | Decision record |
| Service-owner Google account for the script and Sheet | IT | Account name (not password) |
| Read-only export of the v2 Sheet for migration | Ops | Export file in a private location |

## 1. Back up v2 first (read-only)
1. In the v2 Sheet: **File → Make a copy** to a private Drive folder named `VRM MIS v2 BACKUP <date>`; also **Download → CSV**
   of the entries tab. Record row counts per tab.
2. Record the current v2 Apps Script deployment ID and `/exec` URL in the password vault (not in Git). The v2 page in Git history
   is commit `c88bd4d`.
3. Do not edit, re-deploy or share the v2 Sheet during migration.

## 2. Create the staging backend
1. Create Sheet `VRM MIS v3 - STAGING` (service-owner account). Copy its ID.
2. **Extensions → Apps Script**. Replace `Code.gs` with `backend/Code.gs`; Project Settings → show manifest → replace
   `appsscript.json` with `backend/appsscript.json`.
3. **Project Settings → Script Properties:** `SPREADSHEET_ID = <staging sheet id>`. Optional: `MEMBER_SCOPE`, `CODE_PATTERN`,
   `PUBLIC_LOGIN_ROSTER`, `BACKUP_FOLDER_ID` (private Drive folder ID), `BACKUP_RETENTION_DAYS`.
4. Select `setup` → **Run** → authorise. Check the execution log: “schema ready and roster seeded”. Tabs: Meta, VRMs (9 rows),
   Users, Entries, Aliases (7 rows), ImportBatches, AuditEvents, Sessions, ZeroReports, IdempotencyRequests. `PASSWORD_PEPPER` now
   exists — **copy it into the password vault** (losing it invalidates every password).
5. Run `installTriggers` (daily 01:00 IST backup, hourly maintenance).
6. Sheet sharing: owner + named admins only. `setup()` protects every tab; confirm under **Data → Protect sheets and ranges**.

## 3. Provision accounts (no passwords in Git, chat or email)
For each person: Script Properties `SETUP_NAME` (exact name), `SETUP_PASSWORD` (temporary, ≥12 chars, generated in the vault),
`SETUP_ROLE` (`admin` | `member` | `reviewer`), `SETUP_VRM` (canonical VRM name; required for members, optional for admins).
Run `provisionUserFromProperties` — it deletes the four properties even on failure. Hand the temporary password over in person or via
the approved channel; the user must change it at first sign-in. After the first admin exists, further accounts can be created in
**Management → User accounts** (the UI generates the temporary password).
Reference roster: admins Jayesh Mahajan (admin only), Lavina Saldanha and Rajashri Mohandas (admin + their VRM); members Parth Sharma,
Khushi Dodiya, Aakansha Baranwal, Manisha Mahante, Pavan Soni, Swarna Shetty, Riddhi Mistry.

## 4. Deploy the staging Web App
1. **Deploy → New deployment → Web app**: *Execute as*: Me (service owner); *Who has access*: **Anyone** (required for calls from
   GitHub Pages; the application authenticates every non-public call — must be accepted by IT/Security).
2. Copy the `/exec` URL into the vault. `GET <exec>` must return `{"ok":true,…"configured":true}`.
3. Later code changes: **Manage deployments → Edit → New version** (keeps the URL). Record the version number per release.

## 5. Staging frontend
GitHub Pages serves only `main`. Options for UAT without touching production:
- **A (recommended):** a private fork or a second repository `vrm-account-mis-staging` with Pages enabled, containing this branch and
  `config.js` → `apiUrl: '<staging exec>'`, `environment: 'staging'`.
- **B:** run `npm run dev` style static hosting locally with a `config.js` pointing at the staging URL (the CSP already allows
  `script.google.com` and `script.googleusercontent.com`).

## 6. Staging verification checklist (record PASS/FAIL, tester, browser, date in docs/12)
1. CORS/redirect: sign-in from the staging Pages origin in Chrome, Edge, Safari (iOS) and Chrome (Android).
2. Run TC-001…TC-040 manually where not automated against Google, especially TC-013 (two people submitting the same codes at the
   same moment from two devices), TC-018 (00:15 IST), TC-038 (airplane mode during submit).
3. Member direct-API denial: from the browser console, call `addVRM` with a member token → `FORBIDDEN`.
4. Measure `getData` and a 100-row import with 10k/25k synthetic rows (`node tests/perf/perf.mjs` generates the same shape; import
   via the UI in a staging copy). Target p95 < 4 s load, < 10 s for 100 rows.
5. Backup/restore drill: run `backupNow`, open the copy, point a scratch script's `SPREADSHEET_ID` at it, run `verifyIntegrity` and
   compare with the original's report.
6. Offboarding drill: disable a test account while it is signed in → next action shows sign-in.

## 7. Migration (see docs/10)
1. Announce a **write freeze** time (cutoff). Export v2 entries as CSV after the cutoff.
2. `node scripts/migrate-legacy.mjs v2-export.csv --out migration --as-of <today>` → review `baseline.md` and `exceptions.csv` with Ops.
3. Import `migration/import-NNN.csv` as an admin through **Excel / CSV Import** (or in the staging-validated production Sheet).
4. **All data** export from v3 → `node scripts/reconcile.mjs --expected migration --actual <export.xlsx>` → must print
   `RECONCILIATION PASS`. Investigate every difference before go-live.
5. If v2 accepted writes after the cutoff, export the delta and repeat 2–4 for the delta only.

## 8. Go-live (only with all approvals in docs/12 §9)
1. Production Sheet + script created exactly as §2–4 (never reuse staging data unless that is the approved plan).
2. Migrate and reconcile (§7). Provision real accounts (§3).
3. Merge the reviewed PR into `main` with `config.js` `apiUrl` set to the production v3 URL (this is the only change that switches
   users). GitHub Pages republishes the same URL.
4. Smoke test: admin sign-in, member sign-in, one synthetic code for a test VRM, MIS export, then soft-delete the synthetic code
   with reason “go-live smoke test” (audit retained), sign-out.
5. Keep v2 Sheet **read-only** (remove edit sharing) and the v2 deployment **active but unused** for the rollback window (suggested
   14 days), then archive the v2 deployment (Deploy → Manage → Archive) so the public v2 `/exec` + token stop working.

## 9. Rollback
| Situation | Action |
|---|---|
| Frontend defect after merge | `git revert` the merge commit on `main` (or redeploy `c88bd4d`'s `index.html`); Pages republishes in minutes. v2 users return to the v2 backend. |
| v3 backend defect | Apps Script → Manage deployments → select previous version. |
| Data problem in v3 | Stop writes (disable accounts or set `MEMBER_SCOPE`/archive), restore from the latest Drive backup copy into a new Sheet, re-point `SPREADSHEET_ID`, re-apply audited changes made after the backup (Activity Log lists them). |
| Abandon v3 | Revert frontend; v2 Sheet still holds pre-cutoff data. **Export any v3-only writes first** and re-enter them into v2 deliberately; never copy sheets over each other blindly. |

## 10. BAU
Daily: Admin Overview, import exceptions, integrity check. Weekly: review Activity Log (denied/failure outcomes), aliases, backup
presence. Monthly: review accounts (disable leavers), unlock/reset as needed. Quarterly: restore drill, re-run `npm test` +
`npx playwright test` on the current code, review the threat model. Every backend change: staging first, new deployment version,
release note.
