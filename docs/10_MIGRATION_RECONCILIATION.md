# 10 · Migration and reconciliation

## Status
The v2 backend source and Sheet schema were never committed and no access was provided, so the **real** migration is BLOCKED.
The tooling and procedure below were rehearsed end-to-end on a **3,200-row synthetic legacy export** in the local emulator
(`tests/backend/migration.test.mjs`): baseline → chunked import → v3 export → `RECONCILIATION PASS`, and the reconciler was shown
to detect a missing row and a mis-attributed row.

## Inputs
A CSV export of the v2 entries tab. Columns are auto-detected from the exact header aliases (`VRM`, `Date`, `Client Code`, …) or
given with `--vrm-col/--date-col/--code-col`. Codes **must** be exported as text: if the v2 Sheet column was numeric, leading zeros may
already be lost in v2 itself — compare a sample against source documents before migrating (open issue OI-02).

## Procedure
```bash
node scripts/migrate-legacy.mjs v2-export.csv --out migration --as-of 2026-11-30
```
Outputs `migration/baseline.json|md`, `migration/exceptions.csv`, `migration/import-NNN.csv` (≤1,500 rows each).
The baseline records: source data rows, blank rows, distinct normalised codes, rows to migrate, exceptions by reason
(duplicates in source, invalid codes/dates, future dates, missing VRM, ambiguous dates), alias resolutions, and per VRM / year /
month / VRM-date totals of the clean set. Its own checks: `clean + exceptions = source`, `clean codes unique`.

Review `exceptions.csv` with Ops. Fix in the **source export copy** (never in v2) and re-run, or accept the exclusion in writing.
Then import each `import-NNN.csv` as an admin (Excel/CSV Import). Export **All data** (Excel) from v3 and run:
```bash
node scripts/reconcile.mjs --expected migration --actual VRM-MIS_Whole-team_All-time_asof-....xlsx --json reconcile.json
```
It compares row counts, code sets (missing / unexpected / duplicate keys) and per VRM, date, month, year and VRM-date counts, and
exits non-zero on any difference.

## Cutoff and delta
1. Freeze v2 writes at an announced time T. 2. Export → migrate → reconcile. 3. If anything was written to v2 after T, export rows
with `Date ≥ T-date` and codes not in the first export, run the same steps for the delta, reconcile the union. 4. Go-live.

## Known limitations of migrated rows
- `created_at`/`created_by` become the migration time and the importing admin (v2 actor data was self-reported and is not trusted);
  `import_batch_id` identifies migrated rows. The Admin Overview “backdated entries (30 days)” panel will list migrated rows for
  30 days after migration — expected.
- Deleted v2 rows (if v2 hard-deleted) cannot be recovered; their codes are not reserved in v3 unless present in the export.
- Names not in the roster or aliases are reported as exceptions, never auto-created; add aliases (Management) and re-run.

## Rollback
The v2 Sheet is never modified. Rolling back = reverting the frontend (docs/06 §9); v3 data can be exported for reference.
