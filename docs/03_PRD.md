# 03 · Product Requirements — VRM Account MIS v3

**Status:** Release candidate (feature branch), pending staging UAT and approvals. Status column = implementation state;
verification evidence is in [12_TRACEABILITY_AND_TEST_RESULTS.md](12_TRACEABILITY_AND_TEST_RESULTS.md).

## 1. Problem
The VRM desk needs one defensible daily MIS of client-code activations. v2 had shared passwords, a self-reported audit actor,
UTC “today”, silent import defaults and no backend source under version control, so totals and attribution could not be trusted.

## 2. Goals / non-goals
**Goals:** exact unique-code counts by IST date and VRM; trustworthy individual identity and audit; safe imports with previews and
exception reports; reconciled exports; controlled corrections that preserve history; same repo and public URL.
**Non-goals:** account-opening CRM integration, KYC/PAN storage, revenue, targets/incentives, native apps.

## 3. Requirements
| ID | Pri | Requirement | v3 status |
|---|---|---|---|
| FR-01 | P0 | Individual sign-in; role and VRM from server | Implemented |
| FR-02 | P0 | Admin roster: add, rename, archive/restore; no history loss | Implemented |
| FR-03 | P0 | Many codes per submission (comma/semicolon/newline) | Implemented |
| FR-04 | P0 | Global duplicate blocking (paste, file, existing, other VRM, case, Unicode, concurrency, tombstones) | Implemented |
| FR-05 | P0 | Excel/CSV import: structured or single column, aliases, worksheets | Implemented |
| FR-06 | P0 | KPIs Today/Month/Year/All time/Active VRMs in IST | Implemented |
| FR-07 | P0 | Year, month, inclusive range (overrides), VRM/team; From > To blocked | Implemented |
| FR-08 | P0 | Filtered Excel (Report/Summary/Detail) and CSV export reconciling with screen | Implemented |
| FR-09 | P0 | Server-side role enforcement | Implemented |
| FR-10 | P0 | Audit: server actor, time, action, entity, before/after, outcome | Implemented |
| FR-11 | P1 | Client-code lookup and searchable, paginated ledger | Implemented |
| FR-12 | P1 | Admin daily board: filed / confirmed zero / not reported | Implemented |
| FR-13 | P1 | Trend (rolling 12 months or calendar year), leaderboard, team share | Implemented |
| FR-14 | P1 | Import preview, per-row exceptions, exception CSV | Implemented |
| FR-15 | P1 | Admin correction of VRM/date with stable ID | Implemented |
| FR-16 | P1 | Explicit zero report | Implemented |
| FR-17 | P1 | Refresh / last sync timestamp / reconciliation | Implemented |
| FR-18 | P2 | Monthly targets | Not implemented (future) |
| FR-19 | P2 | Read-only reviewer | Implemented |
| FR-20 | P2 | Scheduled digest | Not implemented (future) |
| FR-21 | P0 | Account administration: create, role/VRM change, reset, disable/enable, unlock | Implemented |
| FR-22 | P0 | Idempotent retries; truthful uncertain-network state | Implemented |
| FR-23 | P1 | Integrity report (data health) | Implemented |
| FR-24 | P0 | Daily backup + restore procedure | Implemented (Apps Script function; Google drill NOT TESTED) |

## 4. Screens
Sign-in (and forced password change) · Dashboard · MIS – VRM Wise Summary · Analysis & Input · Client Code Lookup (lookup + ledger
with admin correct/delete/restore) · Excel/CSV Import (5-step wizard) · Admin Overview · Activity Log · Management (VRM roster,
aliases, user accounts) · Your account. Navigation is role-filtered; the server enforces the same rules.

## 5. Metric dictionary
| Metric | Definition |
|---|---|
| Activation | Active entry with a valid, globally unique normalised client code, a valid activation date ≤ today (IST) and a VRM |
| Today / This month / This year | Activations whose activation date is today / in the current calendar month / year, all in IST |
| All time | All active activations |
| Selected period | Activations with `from ≤ date ≤ to` for the chosen month, year or inclusive range (and VRM, if chosen) |
| Team total | Sum over all VRMs in scope (active and archived) = count of distinct active codes in scope |
| Share | VRM count / team count for the same period; 0% when the team count is 0 |
| Active VRMs | Roster VRMs with status *active*, including zero performers |
| Filed | ≥1 activation dated today · **Confirmed zero**: zero report for today and no activations · **Not reported**: neither |

## 6. Business rules
BR-01 code belongs to the activation. BR-02 no count entry. BR-03 key = NFKC + upper-case, trimmed; original text kept;
leading zeros kept. BR-04 duplicates never add. BR-05 inclusive ranges. BR-06 activation date ≠ server timestamp. BR-07 renames
keep IDs. BR-08 soft delete only. BR-09 no cascade delete of VRMs. BR-10 server decides permissions. BR-11 every import row has an
outcome. BR-12 exports match the screen filter and carry the as-of time. BR-13 zero reports never add activations.

## 7. Open business decisions (needed before production)
1. Approved client-code format (`CODE_PATTERN`) — D-05.
2. Member read scope: team (current behaviour) or own only — D-03/D-04.
3. Attribution policy for transferred clients — D-07.
4. Retention of audit log and backups (Compliance).
5. Whether “activation” may continue to be labelled “accounts opened” anywhere external.
