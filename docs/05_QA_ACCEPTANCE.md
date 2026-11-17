# 05 · QA and acceptance plan

Environments: **EMU** = local Apps Script emulator (Node VM running `backend/Code.gs` unmodified with strict service mocks);
**E2E** = Microsoft Edge driven by Playwright against `scripts/dev-server.mjs` (static UI + EMU behind `/exec`, with Apps Script's
302 redirect mimicked); **GAS** = real Google staging (not yet available). Results per run are in
[12_TRACEABILITY_AND_TEST_RESULTS.md](12_TRACEABILITY_AND_TEST_RESULTS.md); raw logs in `docs/evidence/`.

Test files: U = `tests/unit/core.test.mjs`, B = `tests/backend/api.test.mjs`, M = `tests/backend/migration.test.mjs`,
E1/E2/E3 = `tests/e2e/01-core-flows`, `02-resilience-security`, `03-responsive`, P = `tests/perf/perf.mjs`.

## A. Functional cases (from the v3 build kit)
| ID | Scenario | Expected | Automated in |
|---|---|---|---|
| TC-001 | Member sign-in | Member session bound to assigned VRM | B, E1 |
| TC-002 | Admin sign-in (incl. admin + VRM) | Admin privileges; VRM link kept | B, E1–E3 |
| TC-003 | Wrong password | Rejected, no token, audited without password | B, E1 |
| TC-004 | Admin name + member password | Rejected | B |
| TC-005 | Expired / revoked / idle / malformed token | Session error, nothing changed; UI returns to sign-in | B, E1 (logout replay), E2 (expiry) |
| TC-006 | Member writes for another VRM | FORBIDDEN, audited, no change | B, E1 |
| TC-007 | Member/reviewer call every admin API | FORBIDDEN | B, E1, E2 |
| TC-008–010 | One / many / mixed-delimiter codes, blanks | One record per non-blank normalised code | B, U, E1 |
| TC-011 | Same code repeated with case/space variants | 1 added, rest “repeated in paste” | B, U, E1 |
| TC-012 | Code already recorded for another VRM | 0 added, owner unchanged, owner shown per scope | B, E1 |
| TC-013 | Concurrent duplicate submission | Exactly one accepted (fresh check under lock) | B (EMU injection + sequential race); **GAS NOT TESTED** |
| TC-014 | Leading zeros | Preserved through entry, storage, ledger, CSV and XLSX export | B, U, E1 |
| TC-015/016 | 29 Feb leap / non-leap | Valid / rejected | B, U |
| TC-017 | Future date | Rejected | B, U, E1 (import) |
| TC-018 | 00:15 IST | Today = new IST day | B, U |
| TC-019 | Structured CSV import | Correct VRM/date/code mapping | B, E1 |
| TC-020 | XLSX import with text codes | No loss of leading zeros; numeric/scientific codes flagged | U (real XLSX round-trip), E2 (UI upload) |
| TC-021 | File mixes new and existing codes | Exact accepted/skipped reconciliation | B, E1 |
| TC-022 | Alias names | Canonical VRM, no roster duplicates | B, E1 |
| TC-023 | Member imports foreign/unknown VRM | Rejected per row; no VRM created | B |
| TC-024 | Malformed / ambiguous date | Flagged, never defaulted or swapped | B, U, E1 |
| TC-025 | Team total = Σ VRMs | Exact | B, U (property test vs export) |
| TC-026/027 | Month / whole year / inclusive range overriding year | Correct totals | B, U, E1 |
| TC-028 | From > To | Visible error; report and exports blocked | U, B, E1 |
| TC-029 | Whole team vs one VRM, zero states | Correct breakdown | U, E1 |
| TC-030 | Export single VRM / range | Summary = detail = screen | B, U, E1 |
| TC-031 | Formula-like values | CSV neutralised; XLSX text; no formula written to the Sheet | U, B |
| TC-032 | Rename VRM with history | Stable ID; old spelling becomes alias | B, E2 |
| TC-033 | Delete VRM with history | No delete; archive keeps history | B, E2 |
| TC-034 | Soft delete | Excluded from metrics; tombstone + audit | B, E1 |
| TC-035 | Re-add deleted code | Blocked; restore instead | B, E1 |
| TC-036 | Audit actor | From session; spoofed body fields ignored | B, E1 |
| TC-037 | Repository / responses leak nothing | No secrets in tracked files or responses | B, `scripts/check.mjs` |
| TC-038 | Network loss during submit | No false success; safe retry, no duplicates | E2 (dropped response ×2, browser auto re-send), B (crash recovery) |
| TC-039 | 360/390/1366 px etc. | No page overflow; tables scroll in place | E3 (9 widths) |
| TC-040 | Keyboard only | Focus order, modal ESC, focus restore | E2 |

## B. Additional cases
| ID | Scenario | Automated in |
|---|---|---|
| TC-041 | Lockout after 5 failures; unlock by time or admin | B |
| TC-042 | Temporary password must be changed before data access (API + UI) | B, E2 |
| TC-043 | Disable account mid-session revokes it immediately | B, E2 |
| TC-044 | Zero report: distinct from not reported; blocked when entries exist; withdraw | B, E2 |
| TC-045 | Chunked import: cross-part duplicates, register reconciliation, replay, re-send refused, cancel | B |
| TC-046 | Admin-approved VRM creation in import; never automatic | B |
| TC-047 | Idempotent replay; crash-after-write recovery | B |
| TC-048 | Lock contention → BUSY, nothing saved (API + UI) | B, E2 |
| TC-049 | Double-click submit saves once | E2 |
| TC-050 | Stored XSS in a code renders as text | E2 |
| TC-051 | Accessible names on every control of every screen | E1 |
| TC-052 | Remembered session: sign-out in one tab signs out others | E2 |
| TC-053 | Back/forward navigation | E2 |
| TC-054 | Reviewer read-only | B, E2 |
| TC-055 | `MEMBER_SCOPE=own` restricts every read path | B |
| TC-056 | Alias collisions; VRM name rules | B, E2 |
| TC-057 | Last-admin and self-disable protection | B |
| TC-058 | Activity log filters/pagination | B, E1 |
| TC-059 | Client/server rule parity (codes, names, periods, metrics) | U |
| TC-060 | Legacy migration rehearsal + reconciliation detects differences | M |
| TC-061 | Backup/restore drill | M (EMU); **GAS NOT TESTED** |
| TC-062 | Performance at 10k/25k/50k | P (EMU); **GAS NOT TESTED** |
| TC-063 | Light theme persistence; reduced motion | E3 |
| TC-064 | Static: handlers defined, CSP, SRI, secrets | `scripts/check.mjs` |

## C. Must run on Google staging before production (cannot be emulated)
Apps Script POST→302 redirect and CORS from the real Pages origin in Chrome, Edge, Safari iOS, Chrome Android; real concurrent
writes from two devices (TC-013); real quotas/latency at 10k/25k/50k rows; `setup()` protections and `installTriggers()`;
`backupNow()` + restore drill; time-zone behaviour of the Google runtime at 00:15 IST; UAT by one admin and one VRM with sanitised
data. Record tester, browser, date, result and evidence in docs/12 §5.
