# 11 · Release notes — VRM Account MIS 3.0.0 (release candidate)

**Branch:** `feature/v3-secure-mis` · **Not deployed.** Requires a new Apps Script deployment (API v3) and new private Sheet.
**Breaking:** the v3 frontend and backend are incompatible with v2. Switch both together at cutover (docs/06 §8).

## Security
- Individual accounts replace the two shared role passwords; PBKDF2 + pepper; lockout; forced change of temporary passwords.
- Hashed, expiring, idle-timed, revocable session tokens replace storing the password in the browser. v2 browser keys are wiped.
- Server derives the audit actor; removed the editable “Set your name” identity, the `by`/`ip` request fields and the
  api.ipify.org lookup. Removed the embedded `API_TOKEN` and production `/exec` URL from the frontend.
- Members are bound to their VRM on the server; reviewer read-only role added.
- Strict CSP (no inline script/style/handlers); all output escaped (fixes an `onclick` injection path via VRM names in v2);
  formula-safe CSV; SheetJS upgraded 0.18.5 (CDN) → 0.20.3 (self-hosted, SRI).

## Data integrity
- Global uniqueness by normalised key (NFKC + case) across VRMs, dates, imports and deleted rows, re-checked under the lock.
- Idempotent writes with crash recovery; truthful “Not confirmed” state with safe retry; no optimistic success.
- IST everywhere (“today”, month/year, filenames); strict dates; future dates refused; 00:15 IST correct.
- No VRM delete (archive/restore); soft delete/restore/correct with reasons and before/after audit.
- Imports never default a bad date to the selected date (v2 did), never swap day/month silently, never take a number-typed or
  scientific-notation code without warning; unknown VRMs are never auto-created.

## Features
- Dashboard: Today, Month, Year, **All time**, Active VRMs; reporting strip (filed / confirmed zero / not reported); rolling
  12-month or calendar-year trend with accessible table; month leaderboard; team share; VRM cards with status.
- MIS: sortable table (Today, Month, Year, All time, Selected period, Share), team/VRM scope, inclusive ranges with explicit
  “range active” state, From > To blocked, Excel (Report/Summary/Detail) and CSV exports reconciled with the screen; All-data export.
- Analysis & Input: live paste analysis, per-code results with owners, result CSV, daily status and **zero reports**.
- Client Code Lookup: multi-code lookup (available/taken/reserved), paginated sortable ledger with filters, admin correct/delete/restore.
- Excel/CSV Import wizard: worksheet selection, structured or single-column layouts, explicit mapping, date-format detection,
  preview with per-row status and filters, admin approval of new VRMs, chunked commit with progress, pause/retry/stop,
  reconciliation and exception CSV.
- Admin Overview: reporting board (outstanding first), leaderboard/share, team & access, import exceptions, corrections and
  backdated entries (30 days), recent changes, data-health integrity check.
- Activity Log: filters (IST dates, actor, action, outcome), before/after, pagination, CSV export.
- Management: VRM roster (add/rename/archive/restore), aliases, user accounts (create, role/VRM, reset, enable/disable, unlock).
- Account page with password change; light/dark theme (dark default kept), responsive drawer navigation, keyboard support.

## Operations
- `setup()` (non-destructive, schema-checked), `provisionUserFromProperties()`, `installTriggers()`, `backupNow()`,
  `maintenance()`, `verifyIntegrity()`.
- Tooling: local emulator + dev server, migration baseline and reconciliation scripts, static checks, CI workflow.

## Known limitations
See docs/12 §8 (issues register). Highlights: not yet run on Google staging; no SSO/MFA; audit editable by the Sheet owner;
GitHub Pages cannot send security headers; Sheets throughput bound by a single script lock.
