# KTP QA fix receipt

Date: 2026-10-02, Asia/Manila.
Report: `D:\Downloads\KTP-QA-Report-2026-10-02.pdf`.
Report SHA256: `0E326F559937A92C93CFB4EE7B7DC98DEC7076824D5CEDDDD73F7C8BEB8C5E16`.
Base commit: `24fe21a68c483a9ba3497ba06d7e437aa47a860a`.
Branch: `fix/ktp-qa-2026-10-02`.
The user authorized fixes, commit, and push. This change does not merge or deploy production.

## Report disposition

```toon
issues[9]{id,change,verification}:
  KTP-1,hide unavailable Calendar navigation and redirect legacy route,browser redirect check
  KTP-2,hide unavailable Messages navigation and redirect legacy routes,browser redirect check
  KTP-10,reveal and focus filtered list with URL selection and clear old search,all 22 buttons passed browser checks
  KTP-7,retain mobile patient cards and correct cold loading shell,fresh browser contexts at 360 390 400 430 pixels
  KTP-8,wrap tabs and privacy and care team content,actual tab clicks at 360 and 400 pixels
  NEW-1,responsive authentication and lazy loading skeleton,cold and loaded layouts passed
  KTP-9,remove unused automatic manifest request,no manifest link in rendered pages
  NEW-2,connect Tracker Labs Checklist and Appointments to saved records,API persistence and browser form checks
  NEW-3,return empty missing-profile result without expected query error,missing ID browser check with clean console
```

## Clinical workflows

Admins can schedule a service, record its completion and laboratory values, enter a claim deadline, and mark a claim filed. Laboratory ranges are captured from the configured catalog. No reference ranges are invented. Admins can update checklist progress, schedule appointments in Manila time, and cancel appointments. Changes and audit events use one database transaction. Results can only complete a planned service. Cross-patient service references are rejected.

The dashboard now reads saved services and appointments. Numeric patient IDs remain consistent with clinical records. Dashboard claim and appointment actions open the patient workflow instead of a preview dialog.

PostgreSQL and SQLite share the existing approved lab and checklist catalogs. An empty PostgreSQL catalog is initialized under a table lock. Existing populated catalogs are preserved. No schema migration or production patient mutation was run during this work.

This delivers the reported admin profile workflows. The broader roadmap, including patient self-service confirmations, automatic reminders, trend charts, repeat chains, and admin messaging, is not completed by this change. Unavailable admin navigation remains hidden.

## Verification

- `pnpm check`: passed.
- `pnpm test`: 94 tests passed in 14 files. Includes SQLite persistence, authorization, invalid dates, cross-patient rejection, duplicate completion, rollback, and PostgreSQL transaction checks with PGlite.
- `pnpm run build:vercel-api`: passed; generated `api/index.js`.
- `pnpm exec vite build`: passed. Existing large vendor chunk warning remains.
- Browser checks used the production bundle, a local server, fresh Chrome contexts, and a disposable fixture database. Cold and loaded routes fit 360, 390, 400, 430, and 1440 pixels. All 22 dashboard buttons update the URL and reveal and focus their list.
- Browser forms saved service results, displayed lab values, retained checklist completion after reload, and retained appointment cancellation after reload. No page errors occurred in the completed flow run.
- 81 sanitized browser checks passed. Results: `docs/qa/2026-10-02/browser-results.toon`.

The report's protected `ktp-alai2.vercel.app` alias redirects manifest requests to Vercel SSO. The app no longer initiates that unused request. This does not change Vercel protection settings or claim PWA installation support.

The exact signed-in production alias has not been retested with this commit. Local browser results do not prove production deployment or live acceptance. The persistent rail shown in the report was not reproduced in fresh local browser contexts; the loading skeleton and Settings overflow defects were corrected.
