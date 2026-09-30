# KTP Patient Tracker Design

**Date:** 2026-09-30
**Status:** Accepted (sections 1 to 5 approved in brainstorming)
**Approach:** Strip and rename the NurseTrack codebase in place
**Clinical source:** `docs/reference/kt-evaluation-monitoring-guide.md`

This document is the locked design for turning SKTI NurseTrack into KTP, a patient registry for pre and post kidney transplant (KT) recipients and their living donors, with laboratory tracking, claims tracking, scheduling, and admin messaging.

---

## 1. Understanding summary

- KTP holds two patient types: **Recipient** (needs the kidney) and **Donor**. A donor is linked to one recipient.
- A patient signs in with Google and sees only their own profile. A master admin sees every patient and can message them.
- Post-KT tracking follows the unit's existing sheet: patient name, HRN, nephrologist, fellow in charge, and four recurring items (Meds claim, Laboratory, Tacro test, X-ray and USD). Each item has a service date, a next due date, and a separate claim deadline with a filed tick.
- Pre-KT and pre-donation tracking is a work-up checklist by phase (labs, imaging, clearances, milestones) seeded from the guide, plus recurring items with manual due dates.
- Key numeric lab values are stored against an admin-editable lab catalog with reference ranges and out-of-range flags.
- Post-KT lab and tacro due dates are auto-suggested from the transplant date using the guide's monitoring tiers.
- Labs can be corrected (typo) or repeated (retest) with full history.
- Admin schedules appointments. The patient can confirm or request a reschedule.

---

## 2. Assumptions

- **A1.** Single master admin in practice. Admin access stays an email allowlist, so a second admin needs no code change.
- **A2.** Every enrolled patient has a Google (Gmail) account. Admin enters it at enrollment.
- **A3.** Patient count is in the hundreds, not thousands. No pagination beyond what the existing tables already do.
- **A4.** Inpatient post-operative labs (days 0 to 6) are out of scope. The hospital EMR covers them.
- **A5.** Lab reference ranges differ by hospital lab. The catalog seeds names and units only. Admin enters ranges. No flag is shown while a range is blank.
- **A6.** KTP runs on its own Supabase project, Vercel project, and Google OAuth client. NurseTrack production is untouched.
- **A7.** Reminder emails use the existing Resend integration and daily cron (00:00 UTC, 08:00 Asia/Manila).
- **A8.** No real patient data enters the system until phase 7 (deploy) is verified.

---

## 3. Decision log

- **D1.** Lab tracking = schedule + result upload + numeric values for key labs.
- **D2.** Only the admin enters lab results. Patients are read-only.
- **D3.** Scheduling = admin-set appointments. Patient can Confirm or Request reschedule with a note.
- **D4.** Due dates are manual per patient with an optional repeat interval, except post-KT Laboratory and Tacro, which follow D14.
- **D5.** Login = admin enrolls the patient's Gmail. Patient uses Google sign-in only. The NurseTrack claim-cookie flow is removed.
- **D6.** Messaging is one-way (admin to patient) with acknowledgment, plus a fixed emergency banner on every patient-facing message.
- **D7.** Recipient stages: `Orientation, Phase1, Phase2, Clearances, PhilHealthZ, Phase3, PostKT`. Donor stages: `Orientation, Phase1, Phase2, Clearances, Phase3, PostDonation`. Archive status: `Active, Inactive, Deceased, Transferred`.
- **D8.** Post-KT recurring items: Meds claim, Laboratory, Tacro test, X-ray and USD.
- **D9.** Each recurring item has a service date, a next due date, and a separate claim deadline.
- **D10.** Claim deadline is typed by the admin. Admin ticks "Claim filed" with a date.
- **D11.** Numeric labs use an admin-editable catalog with units and reference ranges.
- **D12.** Pre-KT tracking = work-up checklist + recurring labs and claims.
- **D13.** The patient sees everything the admin sees about them, including claim deadlines and filed status.
- **D14.** Guide tiers auto-suggest post-KT Laboratory and Tacro due dates. CMV PCR and RT-PCR timepoints are created automatically from the transplant date. Admin can override any suggested date.
- **D15.** Donors are their own patient profiles, linked to a recipient, with their own login.
- **D16.** Corrections: typo = edit with required reason and revision history. Retest = new linked record, original marked Superseded.
- **D17.** A repeat test gets its own claim deadline and filed tick.
- **D18.** Deployment: separate Supabase, Vercel, and OAuth client.
- **D19.** Implementation approach: strip and rename in place. Rejected: keep nurse code side by side (dead code, doubled schema). Rejected: fresh scaffold (slower, loses tested isolation logic).
- **D20.** Branding: Organ Transplant Services logo (`client/public/branding/ots-logo.png` wordmark, `ots-mark.png` square mark). Done in commit `60e4889`.

---

## 4. Architecture and access

**Stack (unchanged):** React 19, Tailwind 4, Express, tRPC 11, Drizzle ORM, Postgres (Supabase), Vercel.

**Sign-in routing (Google OAuth callback):**

```
email in FULL_ACCESS_EMAILS                          -> admin session   -> /dashboard
email equals patients.accountEmail (ignore case),
  patient status Active                              -> link user, patient session -> /me
otherwise                                            -> "Not enrolled. Contact the KT unit."
```

**Procedures:**

- `adminProcedure`: unchanged allowlist check.
- `staffProcedure` becomes `patientProcedure`. The claim-cookie branch is deleted. The patient id always comes from the session (`ctx.patientId`), never from input. Every patient query filters by `ctx.patientId`.
- A session loses access at once if the patient is archived or the admin changes the patient's Gmail (existing NurseTrack behavior, kept).
- Recipients and donors share the same `/me` portal and see only their own rows. A donor cannot see the linked recipient's data and a recipient cannot see the donor's.

**Privacy (Data Privacy Act of 2012, RA 10173):**

- First patient sign-in shows a privacy notice and consent screen. Store `consentAcceptedAt` and `consentVersion`. The portal stays blocked until consent is given. Bumping the version in Settings asks every patient again.
- `activityLog` records every admin write and every admin open of a patient profile.
- Patients are never hard-deleted. Archive status is admin-only.
- Before go-live, the hospital DPO confirms registration and retention requirements. This is a go-live checklist item, not code.

**Removed from NurseTrack:** claim cookie flow and `StaffSignIn`, PRC OCR and upload review, areas UI, seminars, LDI reports, smart import (including `api/py.py` and `data_import/`), AI insights, training matrix, inquiry chatbot (`inquiry/`, `ChatAssistantWidget`), Excel roster import, `memos` (merged into messages). `api/index.js` is untracked and added to `.gitignore`, since `vercel.json` rebuilds it with `build:vercel-api`.

**Vercel region:** change `syd1` to `sin1` (Singapore), the closest region to Davao.

---

## 5. Data model

All tables live in one Postgres schema (`ktp`). Migrations restart from a single baseline (`drizzle/0000_ktp_baseline.sql`), since the database is new. NurseTrack migrations 0001 to 0007 are removed.

### 5.1 Kept tables (renamed columns)

| Table | Change |
|---|---|
| `users` | none |
| `activityLog` | `supervisorId` to `actorUserId`, `nurseId` to `patientId` |
| `appSettings` | new keys: `emergencyHotlineText`, `consentNoticeText`, `consentVersion` |
| `storedFiles` | none |
| `emailLogs` | `nurseId` to `patientId` |
| `notifications` | `nurseId` to `patientId` |
| `staffMessages`, `staffMessageRecipients`, `staffMessageAcknowledgments` | renamed `messages`, `messageRecipients`, `messageAcknowledgments`; `nurseId` to `patientId` |
| `trainingOutbox` | renamed `reminderOutbox`; references service records and appointments |

### 5.2 Dropped tables

`areas`, `areaAssignments`, `credentialTypes`, `nurseCredentials`, `licenseReminders`, `trainingCatalog`, `trainingEvents`, `areaTrainingRequirements`, `nurseTrainings`, `trainingActivity`, `customCalendarEvents`, `memos`, `memoRecipients`.

### 5.3 New or reshaped tables

**`doctors`**: `id`, `name`, `role` (`Nephrologist | Fellow`), `active`.

**`patients`** (replaces `nurses`):

| Column | Notes |
|---|---|
| `hrn` | unique, required |
| `patientType` | `Recipient | Donor` |
| `firstName`, `middleName`, `lastName`, `suffix`, `sex`, `birthDate`, `contactNumber` | |
| `accountEmail` | required, unique on `lower(accountEmail)` |
| `linkedUserId` | unique, set on first Google sign-in |
| `nephrologistId`, `fellowId` | FK `doctors` |
| `stage` | per D7; server validates the value against `patientType` |
| `riskCategory` | `StandardLow | High`, nullable, set from the CDTE milestone |
| `surgeryDate` | transplant date (recipient) or donation date (donor); required when stage is `PostKT` or `PostDonation` |
| `linkedRecipientId` | donors only; must point to a Recipient, never to self |
| `followupMonths` | `1 | 2 | 3`, default 1; cadence after 1 year post-KT |
| `status` | `Active | Inactive | Deceased | Transferred` |
| `photoFileId` | FK `storedFiles` |
| `consentAcceptedAt`, `consentVersion` | |
| `createdAt`, `updatedAt` | |

**`checklistCatalog`**: `id`, `name`, `category` (`Lab | Imaging | Clearance | Milestone`), `phase` (1, 2, 3, or null), `appliesTo` (`Recipient | Donor | Both`), `asIndicated` (bool), `sortOrder`, `active`. Seed in section 5.4.

**`patientChecklist`**: `id`, `patientId`, `catalogId`, `status` (`Pending | Done | NA`), `doneDate`, `note`, `fileIds`. Unique on (`patientId`, `catalogId`). Rows are created at enrollment for every active catalog item that applies to the patient type. Items added to the catalog later are added to existing patients whose stage is not yet `PostKT` or `PostDonation`.

**`serviceRecords`** (the tracker; one row per due slot or completed service):

| Column | Notes |
|---|---|
| `patientId` | |
| `serviceType` | `Meds | Laboratory | Tacro | XrayUsd` |
| `label` | free text, e.g. "Monthly panel", "CMV PCR", "RT-PCR" |
| `status` | `Planned | Done | Superseded` |
| `dueDate` | the due slot |
| `serviceDate` | set when Done |
| `claimDeadline`, `claimFiledDate` | per D9, D10 |
| `repeatOfId` | FK self, set on retests |
| `repeatReason` | `Hemolyzed | Clotted | WrongTroughTiming | LabError | DoctorRequest | Other` |
| `repeatEveryDays` | optional manual prefill for the next due date |
| `source` | `Manual | Guide` |
| `note`, `fileIds` | |

**`labTests`**: `id`, `name`, `unit`, `low`, `high` (nullable), `active`, `sortOrder`. Seed in section 5.5.

**`labResults`**: `id`, `serviceRecordId`, `labTestId`, `value` (numeric), `lowSnapshot`, `highSnapshot`, `flag` (`Low | Normal | High | null`). The snapshot keeps old flags stable when catalog ranges change later.

**`recordRevisions`**: `id`, `entityType`, `entityId`, `before` (jsonb), `after` (jsonb), `reason` (required), `userId`, `createdAt`.

**`appointments`**: `id`, `patientId`, `title`, `kind` (`FollowUp | Biopsy | Workup | Clearance | Other`), `startsAt`, `location`, `note`, `response` (`Pending | Confirmed | RescheduleRequested`), `responseNote`, `respondedAt`, `cancelledAt`.

### 5.4 Checklist catalog seed (from the guide)

Admin can edit, add, or deactivate any item. `appliesTo` below is the seed default.

**Milestones:** Pre-transplant orientation (Both); Initial nephrology assessment (Both); HTEC evaluation and approval (Both); CDTE and risk stratification (Recipient; result sets `riskCategory`); PhilHealth Z Package qualification and application (Recipient).

**Phase 1 labs (Both):** CBC with differential; Blood typing ABO and Rh; BT, CT, PT/INR, aPTT; FBS and HbA1c; Creatinine, BUN, uric acid; SGPT, SGOT, ALP; Na, K, Ca, phosphorus, Mg; Lipid profile; Albumin and total protein; iPTH; Hepatitis B markers (HBsAg, anti-HBs, anti-HBc; HBV DNA as indicated); Anti-HCV; TPPA/VDRL/RPR; HIV; Malaria (BSMP); CMV IgG; EBV IgG; Varicella IgG; TB Quantiferon; Throat swab GS and C/S; Urinalysis with microscopy; Urine C/S; UACR or 24-hour urine protein and creatinine; Fecalysis with occult blood or FIT; Pregnancy test (females, as indicated).

**Phase 1 imaging (Both):** Chest X-ray PA; 12-lead ECG; Whole abdomen ultrasound; 2D echo with Doppler.

**Phase 2 (immunologic):** HLA typing class I and II (Both); PRA screening class I, II, MICA (Recipient); Single antigen bead / DSA (Recipient); T and B cell crossmatch, CDC or flow (Recipient).

**Phase 2 (donor anatomy, Donor):** Renal CT angiography with 3D reconstruction; Nuclear GFR scan (split function); Aorto-iliac duplex ultrasound.

**Phase 3 (Both unless noted):** Repeat chest X-ray (1 day before admission); Repeat urinalysis and CBC; RT-PCR on admission day; Pre-transplant HD or PD session (Recipient, as indicated).

**Clearances:** Cardiology (Both); Infectious disease (Both); Dental (Both); Neuropsychiatric (Both); Endocrinology (Both); Donor advocate (Donor); Gastroenterology or hepatology (Both, as indicated); Pulmonology (Both, as indicated); Urology (Both, as indicated); OB-Gyn with Pap smear or mammogram (Both, female, as indicated).

### 5.5 Lab catalog seed

Names and units only. Ranges are blank until the admin enters the hospital lab's reference ranges.

| Test | Unit |
|---|---|
| Hemoglobin | g/L |
| WBC | x10^9/L |
| Platelets | x10^9/L |
| Creatinine | umol/L |
| BUN | mmol/L |
| FBS | mmol/L |
| Sodium | mmol/L |
| Potassium | mmol/L |
| ALT (SGPT) | U/L |
| Tacrolimus trough | ng/mL |
| Total cholesterol | mmol/L |
| Triglycerides | mmol/L |
| HDL | mmol/L |
| LDL | mmol/L |
| CMV PCR | IU/mL |

---

## 6. Scheduling, claims, reminders

### 6.1 Guide auto-suggest (post-KT recipients, Laboratory and Tacro only)

When the admin marks a Laboratory or Tacro record Done, the next `Planned` row is prefilled:

| Days from `surgeryDate` to the completed slot's `dueDate` | Next due = slot `dueDate` + |
|---|---|
| 0 to 30 (month 1) | 7 days |
| 31 to 60 (month 2) | 14 days |
| 61 to 365 (months 3 to 12) | 1 calendar month |
| over 365 | `followupMonths` calendar months |

- The anchor is the slot's due date, not the service date, so a late test does not shift the schedule.
- The admin sees the prefilled date in the Record result dialog and can change it before saving.
- The rule lives in one pure function in `shared/` with a table-driven test.

### 6.2 Auto-created rows when stage becomes PostKT

When a recipient moves to `PostKT` with a `surgeryDate`, create `Planned` rows with `source = Guide`:

- Laboratory "Monthly panel" and Tacro at surgeryDate + 7 days.
- Laboratory "CMV PCR" at + 7 days, + 1, + 2, + 3, + 6 months.
- Laboratory "RT-PCR" at + 1, + 2, + 3 months.

If `surgeryDate` changes later, delete and regenerate only `Planned` rows with `source = Guide`. Rows marked `Done` or `Superseded`, and all `Manual` rows, are never touched.

### 6.3 Manual items

`Meds`, `XrayUsd`, all pre-KT recurring items, and donor post-donation follow-up use manual due dates. If `repeatEveryDays` is set, the next due date prefills as `dueDate + repeatEveryDays`.

### 6.4 Corrections and repeats

- **Typo fix:** admin edits the record with a required reason. A `recordRevisions` row stores before, after, reason, user, and time. The patient sees the current value with a "Corrected on [date]" tag.
- **Retest:** the Repeat action is allowed on `Done` rows only. It creates a new row with the same `dueDate`, `repeatOfId` set, a reason, and its own claim fields. The original becomes `Superseded`, stays visible in grey, and is excluded from trend charts and flags. Repeating a `Superseded` row targets the latest row in its chain.
- A repeat fills the same due slot. It does not create an extra next-due row. The next due date is suggested when the repeat is marked Done.

### 6.5 Claims

Claim status is computed, never stored:

- `Filed` if `claimFiledDate` is set.
- `Overdue` if `claimDeadline` is before today.
- `DueSoon` if `claimDeadline` is within 7 days.
- `Open` otherwise, or `None` if there is no deadline.

A `Superseded` record with an unfiled claim appears on the admin dashboard as "Superseded, claim not filed".

### 6.6 Appointments

Admin creates the appointment and the patient is notified. The patient taps Confirm or Request reschedule (note required for reschedule). The admin sees a badge. When the admin edits `startsAt`, `response` resets to `Pending` and the patient is notified again. Cancel sets `cancelledAt` and notifies the patient.

### 6.7 Reminders

Daily cron, deduplicated through `emailLogs` and `reminderOutbox`. Dates are computed in Asia/Manila.

| Recipient | Trigger |
|---|---|
| Patient | Planned service due in 7 days and on the due date; appointment 1 day before; claim deadline in 7 days and on the day (unfiled only); new message |
| Admin (one digest email per day) | Overdue services, services due within 7 days, unfiled claims due within 7 days, reschedule requests, superseded records with unfiled claims |

The in-app notification bell mirrors the same events.

---

## 7. Screens

### 7.1 Admin

| Route | Content |
|---|---|
| `/dashboard` | Counts by type and stage. Lists: overdue services, claims due within 7 days, reschedule requests, superseded unfiled claims |
| `/patients` | Table matching the unit sheet: Name, HRN, Nephrologist, Fellow, then last date, next due, and claim due for Meds, Laboratory, Tacro, X-ray and USD. Filters: type, stage, doctor, status. Search by name or HRN. Excel export (reuses `reportBuilders`) |
| `/patients/new`, `/patients/:id/edit` | Enroll or edit: Gmail, HRN, names, type, doctors, stage, surgery date, linked recipient (donors), follow-up months |
| `/patients/:id` | Header with name, HRN, type, stage stepper, doctors, linked donor or recipient. Tabs: Tracker, Labs (values table and trend chart per test), Checklist, Appointments, Messages, History (activity and revisions) |
| `/calendar` | All appointments and planned due items |
| `/messages` | Compose to one patient, all Recipients, all Donors, one stage, or everyone. Sent list with read and acknowledgment counts |
| `/settings` | Doctors, lab catalog, checklist catalog, emergency hotline text, consent notice text and version |

### 7.2 Patient (mobile-first)

| Route | Content |
|---|---|
| `/me` | Next due items, claim deadlines, upcoming appointments, unread messages |
| `/me/labs` | Own results with trends and flags. Superseded rows greyed. "Corrected" tag |
| `/me/checklist` | Pre-KT or pre-donation progress by phase |
| `/me/calendar` | Appointments with Confirm and Request reschedule |
| `/me/messages` | Read and Acknowledge. Emergency banner on every message |
| `/me/profile` | Read-only, except contact number and photo |

---

## 8. Errors

| Case | Result |
|---|---|
| Google email not enrolled | "Not enrolled" page. No patient link is created |
| Duplicate HRN or Gmail, or Gmail on the admin allowlist | Field error on save |
| Donor linked to self or to a non-recipient | Rejected |
| Stage not valid for patient type | Rejected |
| Stage `PostKT` or `PostDonation` without `surgeryDate` | Rejected |
| Non-numeric or negative lab value | Rejected. Out-of-range values are flagged, not rejected |
| Edit without a reason | Rejected |
| Repeat on a `Planned` row | Rejected |
| Reschedule request without a note | Rejected |
| Patient passes another patient's record, appointment, or message id | `NOT_FOUND` |
| Patient calls an admin procedure | `FORBIDDEN` |
| Patient without current consent calls any portal procedure other than consent | `FORBIDDEN` with a consent-required code; client redirects to the consent screen |
| Email send fails | Outbox retry (existing behavior) |

---

## 9. Tests

Vitest, following the existing `server/*.test.ts` style.

- **Isolation:** for every `patientProcedure`, patient A cannot read or change patient B's rows.
- **Auth routing:** allowlisted email becomes admin; enrolled email becomes patient; unknown or archived email is denied; email match ignores case; changed Gmail revokes the old session.
- **Consent gate:** portal procedures are blocked until consent; a version bump blocks again.
- **Scheduler:** table test over days 0, 30, 31, 60, 61, 365, 366 with `followupMonths` 1, 2, 3; anchor is the slot due date; month-end dates (Jan 31 plus 1 month).
- **Auto rows:** PostKT creates the section 6.2 rows; editing `surgeryDate` regenerates only `Planned` Guide rows.
- **Repeat:** original becomes `Superseded`; repeat keeps the same `dueDate` and its own claim fields; superseded values are excluded from trends and flags.
- **Revisions:** edit without a reason fails; before and after are stored.
- **Flags:** range snapshot keeps old flags after a catalog range edit; blank range gives no flag.
- **Claims:** computed status for filed, overdue, due soon, open, none.
- **Reminders:** 7-day and same-day windows in Asia/Manila; no duplicate emails on a second cron run.

---

## 10. Build order

Each phase leaves a working app with passing tests.

1. **Strip and rebase.** Remove the modules listed in section 4. Fresh schema baseline. Rename `nurses` to `patients` with the section 5.3 columns, plus `doctors`. Google enrollment login, `patientProcedure`, consent gate. Patient CRUD. App name and manifest text become KTP.
2. **Tracker.** `serviceRecords`, claims, repeat, `recordRevisions`, guide scheduler, auto rows, patients table with Excel export.
3. **Labs.** `labTests` catalog and settings UI, `labResults`, flags, trend charts, patient labs page.
4. **Checklist.** Catalog seed from section 5.4, `patientChecklist`, admin and patient checklist pages.
5. **Appointments.** Appointments, admin calendar, patient Confirm and Request reschedule.
6. **Messages and reminders.** Rename messages tables, emergency banner, reminder rules from section 6.7, admin digest.
7. **Deploy.** New Supabase project, Vercel project (`sin1`), Google OAuth client, env vars, catalog seed, DPO go-live check. Real patient data only after this phase is verified.

---

## 11. Out of scope

- Inpatient post-operative labs (days 0 to 6).
- Per-patient tacrolimus target ranges by months post-KT. The catalog holds one range for now.
- Two-way messaging and patient replies.
- Patient self-booking of appointments.
- Patient-entered or patient-uploaded lab results.
- SMS reminders.
- Bulk import of the existing post-KT spreadsheet. Patients are enrolled one by one.
