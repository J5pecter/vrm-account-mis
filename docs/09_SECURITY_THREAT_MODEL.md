# 09 · Security threat model

Assets: client codes and activation history (internal business data), account credentials, the audit trail, report integrity.
Actors: VRMs, admins, reviewers, anyone on the Internet (public UI + `Anyone` web app), a compromised browser, the Sheet owner.

## Threats and controls
| # | Threat | Control (v3) | Evidence | Residual risk |
|---|---|---|---|---|
| T1 | Anyone calls the API | Every non-public action requires a valid session token; public actions: `health`, `getLoginBootstrap`, `login` | TC-005, protocol tests | Endpoint is Internet-reachable by design (IT approval) |
| T2 | Password guessing | Salted PBKDF2 + server pepper; 5-failure lockout (15 min); generic error; unknown-name throttle; no roster disclosure by default | lockout tests | Apps Script cannot rate-limit by IP; distributed guessing against many names is only slowed. No MFA. |
| T3 | Member acts for another VRM / as admin | Role table + `assigned_vrm_id` checked server-side for every write; denials audited | TC-006/007, E2E member denial | — |
| T4 | Forged audit actor (v2 `by`, `ip`) | Actor and time from session/server only; body fields ignored | TC-036 | — |
| T5 | Stolen bearer token (XSS, shared PC) | Strict CSP (no inline script), escaping everywhere, no third-party scripts at runtime, SRI on SheetJS; short expiry + idle timeout; sessionStorage by default; revoke on logout/disable | XSS E2E, check.mjs | Token readable by any script that does run in the origin; GitHub Pages cannot send `frame-ancestors`/HSTS headers |
| T6 | Leaked legacy secrets | v2 `API_TOKEN` and `/exec` URL are in Git history (commit `ba31bdb`…`c88bd4d`) — treat as public; v3 never uses them; archive v2 deployment after cutover | check.mjs INFO line | Until v2 deployment is archived, v2 data remains reachable with v2 shared passwords |
| T7 | Duplicate/inflated counts | Global `code_key` uniqueness under lock incl. tombstones; idempotent retries with crash recovery; integrity report | TC-011–013, TC-038, recovery test | Lock serialises writers (throughput) |
| T8 | Formula/CSV injection | Codes and names may not start with `= + - @`; free text prefixed; text-format cells; CSV export prefixes `= + - @ TAB CR`; XLSX codes typed as text | csvCell tests, emulator formula guard | — |
| T9 | Malicious spreadsheet | Parsed in the browser with pinned SheetJS 0.20.3 (fixes CVE-2023-30533 / CVE-2024-22363 present in v2's 0.18.5); 10 MB limit; values treated as data | import tests | Parser bugs remain possible |
| T10 | Over-disclosure | Counts-only snapshot; codes only via ledger/lookup/export within scope; `MEMBER_SCOPE=own` option; hashes/salts/peppers never returned | TC-037 test | Default `team` scope lets members see team codes (v2 behaviour) — business decision D-03 |
| T11 | Destructive admin error | No hard delete; soft delete/restore/correct with reason and before/after; archive instead of delete; last-admin protection | TC-032–035 | Sheet owner can still edit tabs directly |
| T12 | Data loss | Daily Drive copy trigger; restore procedure; migration never edits v2 | restore drill (emulator) | Google-side drill NOT TESTED |
| T13 | Audit tampering | App only appends; tabs protected to owner | — | Sheet owner can edit audit rows; for tamper-evidence export audit to an append-only store (P2) |
| T14 | Clickjacking | — | — | No `frame-ancestors` via meta CSP on GitHub Pages; impact limited (actions need deliberate form input) |
| T15 | Session fixation / replay | Tokens issued only by server at login; logout revokes; replay after logout fails | E2E logout replay | — |

## Privacy
No client PII beyond client codes. No IP addresses or device data collected (v2 used api.ipify.org; removed). Audit never stores
passwords, tokens or pasted code lists. Import files never leave the browser except as validated rows.

## Approvals required (not obtainable by engineering)
IT/Security: hosting model, `Anyone` web-app access, password policy, session lengths, CSP limits. Compliance: retention of entries,
audit and backups; client-code classification. Product/Ops: D-03, D-05, D-07.
