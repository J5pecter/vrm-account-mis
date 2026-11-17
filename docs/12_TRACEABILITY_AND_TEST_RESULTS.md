# 12 · Audit, traceability, test evidence, issues and release status

**Code under test:** branch `feature/v3-secure-mis`, commit `419f0a6` (evidence logs in `docs/evidence/`).
**Status legend:** **PASS-EMU** = passed against `backend/Code.gs` in the local Apps Script emulator · **PASS-E2E** = passed in
Microsoft Edge 156 (Playwright 1.59.1) against the local staging server (static UI + emulator) · **NOT TESTED** = not executed ·
**BLOCKED** = cannot be executed without access/approval. Nothing in this document was run on Google infrastructure.

## 1. Current-state audit (baseline `main` @ `c88bd4d`)
| # | Finding | Severity | v3 resolution |
|---|---|---|---|
| A-01 | Backend source (`backend/Code.gs`, manifest, sample CSV) documented in README but never committed (all 15 commits checked) | P0 | v3 backend versioned in `backend/` |
| A-02 | Production `/exec` URL and constant `API_TOKEN` embedded in public `index.html` | P0 | Removed; `config.js` holds a public URL only; token retired (still in history → OI-04) |
| A-03 | Two shared role passwords sent on every request and stored in `localStorage`/`sessionStorage` | P0 | Individual accounts + hashed expiring tokens; legacy keys purged on load |
| A-04 | Server decided role from which shared password was sent ⇒ member VRM could not be enforced server-side | P0 | `assigned_vrm_id` enforced on every write |
| A-05 | Audit actor = self-reported, editable name; IP from third-party api.ipify.org | P0 | Actor from session; no IP collection |
| A-06 | `todayISO()` used UTC ⇒ wrong “today” 00:00–05:30 IST; year from local clock | P1 | IST from server-corrected clock |
| A-07 | Import: loose header guessing (`/client/`, `/account/`, `/manager/`), invalid row date silently replaced by the selected date, plain list read every column, `raw:false` text could swap day/month, numeric codes lost leading zeros silently | P1 | Exact aliases + manual mapping; preview; strict date resolution; numeric/scientific codes flagged |
| A-08 | Unknown VRMs auto-created by any import | P1 | Never automatic; admin approval only |
| A-09 | “Delete VRM” UI text: removes all entries (cascade) | P1 | No delete; archive/restore |
| A-10 | `onclick="openRename('${esc(name)}')"`: HTML-escaped quote decodes back in the attribute ⇒ script injection via a VRM name (names could arrive from imports) | P1 | No inline handlers; CSP; escaping tested |
| A-11 | Error text from the server inserted with `innerHTML` in toasts | P2 | Toasts use `textContent` |
| A-12 | No CSV formula escaping in exports | P1 | `csvCell` neutralises `= + - @ TAB CR` |
| A-13 | Optimistic UI showed success before the server answered; no retry safety | P1 | No optimistic writes; idempotent retry; “Not confirmed” state |
| A-14 | From > To produced an unlabelled empty result | P2 | Blocked with message |
| A-15 | SheetJS 0.18.5 from CDN without SRI (published CVEs) | P2 | 0.20.3 self-hosted with SRI |
| A-16 | `?api=` URL parameter could persist an arbitrary backend URL in the browser | P2 | Removed |
| A-17 | Login page claimed a “tamper-proof activity log” | P3 | Claim removed |
| A-18 | No All-time KPI, no zero report, no correction/restore, no import preview, no paginated ledger | P1 | Implemented |
Not inspected (no access): the live v2 Apps Script, its Sheet schema and data (OI-01). The v2 README says `GET <exec>?action=getData`
returned data; whether v2 serves data without a password via GET is **unverified** (OI-13).

## 2. Requirements coverage matrix
| Req | Implementation | Tests | Result |
|---|---|---|---|
| FR-01 individual sign-in, server role | `login_`, `authenticate_`, `me_` (Code.gs); `showLogin`, `F.login` (app.js) | B TC-001–004, lockout; E1 #1–2 | PASS-EMU, PASS-E2E |
| FR-02 roster add/rename/archive/restore | `addVrm_`, `renameVrm_`, `archiveVrm_`, `restoreVrm_`; Management tab | B TC-032/033, aliases; E2 #21 | PASS-EMU, PASS-E2E |
| FR-03 multi-code entry | `core.splitCodes/analyzePaste`, `addEntries_` | U, B TC-008–010; E1 #2 | PASS-EMU, PASS-E2E |
| FR-04 global duplicate blocking | `normCode_`, `entryIndex_` under `withLock_` | B TC-011–013, NFKC, tombstone; E1 #2–3 | PASS-EMU, PASS-E2E; Google concurrency NOT TESTED |
| FR-05 Excel/CSV import | `core.buildImportRows`, import wizard, `previewImport_`, `commitImport_` | U (XLSX/CSV), B TC-019–024, chunks; E1 #4; E2 #24 | PASS-EMU, PASS-E2E |
| FR-06 KPIs in IST | `core.computeMetrics`, `renderDashboard` | U metrics, TC-018; E1 #2 | PASS-EMU, PASS-E2E |
| FR-07 period filters | `core.resolvePeriod` = `resolvePeriod_`; MIS | U parity, B TC-026–028; E1 #5 | PASS-EMU, PASS-E2E |
| FR-08 exports reconcile | `exportReport_`, `exportWorkbook`, `exportCsvRows` | U property test (client = server for random data/filters), B TC-030; E1 #5 | PASS-EMU, PASS-E2E |
| FR-09 server-side permissions | `ROUTES` roles, `requireWriteVrm_`, `canReadVrm_` | B TC-006/007, reviewer, MEMBER_SCOPE; E1 #9; E2 #23 | PASS-EMU, PASS-E2E |
| FR-10 audit | `audit_`, `auditDenied_`, `auditRejected_`; Activity Log | B TC-036, logs; E1 #6 | PASS-EMU, PASS-E2E |
| FR-11 lookup + ledger | `lookupCodes_`, `queryEntries_`; Lookup screen | B lookup, pagination; E1 #3, #6 | PASS-EMU, PASS-E2E |
| FR-12 daily board | `computeMetrics.reporting`, Admin Overview | U, B zero report; E2 #16 | PASS-EMU, PASS-E2E |
| FR-13 trend/leaderboard/share | `monthlySeries`, `leaderboardHtml`, `shareHtml`, `drawCharts` | U; E3 screenshots | PASS-EMU, PASS-E2E (visual) |
| FR-14 import preview + exceptions | import steps 3–5, `exceptionRows` | E1 #4 (exception CSV contents), E2 #24 | PASS-E2E |
| FR-15 correction | `correctEntry_`; ledger modal | B correction; E1 #6 | PASS-EMU, PASS-E2E |
| FR-16 zero report | `submitZeroReport_`, `withdrawZeroReport_` | B; E2 #16 | PASS-EMU, PASS-E2E |
| FR-17 refresh / sync | `refreshData`, `setSync`, auto refresh, IST day rollover | E2 #14 (sync after expiry), E2 #20 | PASS-E2E (day rollover NOT TESTED in browser) |
| FR-19 reviewer | role `reviewer` | B; E2 #23 | PASS-EMU, PASS-E2E |
| FR-21 account admin | `createUser_` … `unlockUser_`; Users tab | B; E2 #21, #25 | PASS-EMU, PASS-E2E |
| FR-22 idempotent retry | `idempotent_`, `request_id` recovery; `submitPendingCodes`, `commitNext` | B replay, crash recovery; E2 #10–13 | PASS-EMU, PASS-E2E |
| FR-23 integrity report | `integrityReport_`; Data health | B; E1 #6 | PASS-EMU, PASS-E2E |
| FR-24 backup/restore | `backupNow`, `installTriggers`; runbook §9 | M restore drill (emulator copy) | PASS-EMU; Google drill NOT TESTED |
| Migration with reconciliation | `scripts/migrate-legacy.mjs`, `scripts/reconcile.mjs` | M (3,200 synthetic rows) | PASS-EMU; real data BLOCKED |
| Responsive / zoom | `app.css` breakpoints, drawer | E3 9 widths × 9 screens | PASS-E2E (Edge only) |
| Accessibility | labels, focus trap/restore, skip link, aria-live, chart table, reduced motion | E1 #7, E2 #18, E3 #37 | PASS-E2E (no screen-reader run: NOT TESTED) |
| No secrets / handlers / CSP / SRI | `scripts/check.mjs` | check.log | PASS |
| FR-18 targets, FR-20 digest | — | — | Not implemented (P2, future) |

Test keys: U = `tests/unit/core.test.mjs` (22), B = `tests/backend/api.test.mjs` (60), M = `tests/backend/migration.test.mjs` (2),
E1/E2/E3 = E2E specs (9 + 16 + 12 = 37; numbers above are the run order in `docs/evidence/e2e.log`). QA IDs: docs/05.

## 3. Test execution summary (commit `419f0a6`, 17 Nov 2026, Windows 11, Node v24.21.0)
| Suite | Command | Environment | Result |
|---|---|---|---|
| Static checks | `node scripts/check.mjs` | repo | All pass (syntax, 52 actions / 10 forms / 10 change / 1 input handlers, no orphans, CSP, SRI, secret scan) |
| Unit + backend + migration | `npm test` | EMU | **84 / 84 pass** |
| Browser E2E | `npx playwright test` | E2E, Edge 156 | **37 / 37 pass** (3.3 min) |
| Performance | `npm run test:perf` | EMU | see §6 |

Defects found and fixed by these tests during development (not waived): `getLogs` filter read the route name instead of the
action filter; legacy `{pw}` calls hit authentication before the upgrade check; alias form input wiped by the list reload;
mobile inline `<span>` bars rendered empty; focus lost after partial re-renders; codes wrapping mid-string in narrow columns.

Observation: one earlier responsive run took 44 min and lost the page at 768 px; three subsequent runs completed in 1.4–3.3 min with
no failure. Not reproduced; tracked as OI-10.

## 4. Reconciliation evidence
- QA fixture (6 rows): 3 accepted + 2 duplicates + 1 invalid = 6; Parth 2, Khushi 1, Pavan 0; replay accepts 0 — PASS-EMU.
- E2E import (7 rows): rejected before upload 3, sent 4, saved 2, already recorded 1, unknown VRM 1; server register accepted 2 ✓ — PASS-E2E.
- Exports: CSV detail rows = screen total = Summary TOTAL; XLSX Detail rows = total, codes typed text — PASS-E2E.
- Property test: for 30 random submissions × 6 filters × 3 scopes the client engine equals server `exportReport` totals — PASS-EMU.
- Migration rehearsal: 3,200-row synthetic legacy export → baseline → 3 import parts → v3 export → `RECONCILIATION PASS`;
  reconciler detects 1 missing + 1 mis-attributed row — PASS-EMU.

## 5. Google staging record (to be completed by testers)
| Check (docs/05 §C, docs/06 §6) | Tester | Browser/device | Date | Result |
|---|---|---|---|---|
| Sign-in + data load from staging Pages origin (POST→302, CORS) | | Chrome / Edge / Safari iOS / Chrome Android | | NOT TESTED |
| TC-013 two devices, same codes, same moment | | | | NOT TESTED |
| TC-018 00:15 IST on Google runtime | | | | NOT TESTED |
| TC-038 airplane mode during submit | | | | NOT TESTED |
| Load 10k / 25k / 50k rows: p95 getData, 100-row import | | | | NOT TESTED |
| `setup()` protections, `installTriggers()`, `backupNow()` + restore drill | | | | NOT TESTED |
| Offboarding drill | | | | NOT TESTED |
| UAT: one admin + one VRM, sanitised data | | | | NOT TESTED |

## 6. Performance (EMU — algorithmic cost on this PC, not Apps Script latency; `docs/perf-results.json`)
| Entries | getData p95 | add 100 codes p95 | import 1,500 rows p95 | ledger page p95 | lookup 100 p95 | export year p95 |
|---:|---:|---:|---:|---:|---:|---:|
| 10,000 | 76 ms | 62 ms | 174 ms | 181 ms | 198 ms | 208 ms |
| 25,000 | 438 ms | 442 ms | 637 ms | 434 ms | 428 ms | 465 ms |
| 50,000 | 827 ms | 723 ms | 1,010 ms | 771 ms | 653 ms | 752 ms |
Scaling is linear. Real Sheets reads/writes add latency (unknown until staging; OI-03).

## 7. Screenshots (real running UI, LOCAL EMULATOR with fictional data — not production)
`docs/screenshots/`: every screen at 390 px (`*-mobile-390.png`), 768 px (`*-tablet-768.png`) and 1366 px (`*-laptop-1366.png`),
light theme (`dashboard-light-1366.png`), and flow states (`input-result-1366.png`, `import-preview-1366.png`,
`import-result-1366.png`, `mis-1366.png`, `admin-1366.png`, `activity-1366.png`). Full-page captures render the fixed sidebar at the
scroll position where the capture started; that is a capture artefact.

## 8. Open issues register
| ID | Sev | Issue / impact | Owner | Next action |
|---|---|---|---|---|
| OI-01 | P1 BLOCKED | Live v2 backend and Sheet not inspected; legacy schema, row counts and data quality unknown | Repo owner (Jayesh) / Ops | Grant read-only export; run `migrate-legacy.mjs` baseline |
| OI-02 | P1 | v2 may already have lost leading zeros if its code column was numeric | Ops | Compare 20 sampled codes with source documents before migration |
| OI-03 | P1 BLOCKED | Not deployed to Google staging: CORS/redirect, quotas, latency, real concurrency, triggers untested | Repo owner + IT | Follow runbook §2–6, fill §5 |
| OI-04 | P1 Security | v2 `API_TOKEN` + `/exec` URL are public in git history; v2 deployment stays reachable with shared passwords | Repo owner | Rotate v2 shared passwords now; archive v2 deployment after cutover (runbook §8.5) |
| OI-05 | P2 | No SSO/MFA (Apps Script password model) | IT/Security | Accept for pilot or plan ADR-001 migration |
| OI-06 | P2 | Audit tab editable by the Sheet owner (not tamper-evident) | Compliance | Accept, or schedule audit export to append-only storage |
| OI-07 | P2 | GitHub Pages: no `frame-ancestors`, HSTS or other response headers | IT/Security | Accept, or front with a host that sets headers |
| OI-08 | P2 Decision | D-03 member scope, D-05 code format, D-07 attribution, retention | Product/Ops/Compliance | Decide before production |
| OI-09 | P2 | Browser matrix: only Edge desktop automated; Chrome Android, Safari iOS, screen readers not tested | QA | Manual pass on staging |
| OI-10 | P3 | One unexplained 44-min responsive run (environmental?) | QA | Watch CI; re-run with trace if it recurs |
| OI-11 | P3 | Migrated rows show as “backdated” in Admin Overview for 30 days | Ops | Expected; note in cutover comms |
| OI-12 | P3 | Single script lock serialises writers; peak throughput unknown | Eng | Measure on staging; ADR-001 thresholds |
| OI-13 | P2 Security | v2 README describes data via unauthenticated `GET ?action=getData`; unverified | Repo owner | Check v2 script; archive v2 deployment if true |
| OI-14 | P3 | FR-18 targets, FR-20 digest not built | Product | Backlog |

No P0 issue is open in the delivered code. P1 items above are environment/access/approval blockers, not code defects.

## 9. Stop-ship checklist (build prompt §12)
| Condition | Status |
|---|---|
| Same repo; production untouched; feature branch + review | ✔ branch `feature/v3-secure-mis`; `main` untouched; PR draft |
| Every displayed control works (incl. negative paths) | ✔ handler check + 37 E2E (EMU) |
| Individually authenticated users; server enforces scopes | ✔ (EMU/E2E) |
| No hardcoded passwords/tokens/sheet contents in public repo | ✔ current tree; ✖ history still contains v2 token (OI-04) |
| Global uniqueness incl. concurrency; leading zeros | ✔ EMU; Google concurrency NOT TESTED |
| One stable record per code; no count mode | ✔ |
| Imports preview, explain, reconcile, retry safely | ✔ |
| IST filters correct; reports/exports reconcile | ✔ |
| Rename/archive/correct/delete/restore keep history + audit | ✔ |
| Filed / confirmed zero / not reported | ✔ |
| Desktop/mobile viewports + keyboard; truthful states | ✔ Edge; other browsers NOT TESTED |
| E2E on authorised **staging** | ✖ BLOCKED (OI-03) |
| Backup restored in a test environment; migration/rollback reconcile | ✔ EMU rehearsal; ✖ Google NOT TESTED |
| Product/Ops + IT/Security/Compliance approvals | ✖ not obtained |
| No unresolved P0 / unapproved P1 | ✖ P1 blockers OI-01/03/04 open |

## 10. Final status: **BLOCKED**
Engineering deliverables are complete and verified in the local emulator and in Edge. The release cannot become **READY FOR UAT**
until a Google staging backend exists (OI-03) and cannot be **APPROVED FOR PRODUCTION** until OI-01/OI-04, the business decisions
(OI-08) and the approvals in §9 are in place. Deployment state: **not deployed**; production site and backend unchanged.
