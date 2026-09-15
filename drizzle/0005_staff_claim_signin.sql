-- Staff claim-then-Google sign-in (docs/plans/2026-09-15-staff-signin-claim-then-google-design.md).
-- Case-insensitive uniqueness on nurses.accountEmail: it is now the staff
-- sign-in identity (claimed once, then matched against the Google email on
-- every return visit), so two nurses can no longer share one address in any
-- casing. NULLs are unaffected (a unique index allows any number of NULLs).
--
-- drizzle-kit's meta/*.json snapshots for this project were already malformed
-- before this change (pre-existing — `drizzle-kit generate` fails on all five
-- prior migrations, unrelated to this feature), so this file is hand-written
-- and NOT registered in drizzle/meta/_journal.json. Apply it by hand against
-- the target Postgres database; the guarded index means a re-run is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nurses_account_email
  ON nursetrack.nurses (lower("accountEmail"));
