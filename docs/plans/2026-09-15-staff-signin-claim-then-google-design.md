# SKTI NurseTrack Staff Sign-In Design

**Date:** 2026-09-15
**Status:** Accepted
**Approach:** O1 claim cookie, then Google

This document is the locked design for staff first-visit claim and return Google sign-in.

It replaces the current staff path that required Google first, then PRC plus full name.

---

## 1. Understanding summary

- Staff claim their own NurseTrack profile without the supervisor dashboard.
- First visit uses PRC license number, or employee ID for an attendant with no PRC.
- The first visit opens only that profile so the staff member can save Gmail and missing personal data.
- Return visits use Google sign-in with that Gmail.
- Supervisors keep the current Google admin login.
- A staff session cannot open another staff record or an admin page.

---

## 2. Assumptions

- **A1.** This work replaces Google-first staff linking (`linkByPrc` after OAuth).
- **A2.** The hospital has about 200 staff. Login volume is low.
- **A3.** Failed first-visit lookups use one generic error and are rate-limited.
- **A4.** A changed Gmail is the only address that Google may match after the change.
- **A5.** Google email must match `nurses.accountEmail` with case ignored.
- **A6.** Archived, resigned, or retired rows cannot be claimed or signed in.
- **A7.** Existing reminder email stays unchanged. This path does not send a login code.
- **A8.** After Gmail is saved, PRC or employee ID cannot open the profile again.

---

## 3. Decision log

- **D1.** First visit: identifier, then type Gmail. Return visits: Google / Gmail.
- **D2.** Registered nurses identify with PRC license number only.
- **D3.** Typed Gmail is saved at once. First visit does not send a code and does not require Google.
- **D4.** Staff may edit email, contact number, photo, license files, training files, and personal fields such as middle name and suffix. Supervisors keep area, employment status, and employee ID.
- **D5.** Attendants with no PRC number use employee ID on the first visit.
- **D6.** Staff can change account Gmail from the profile with a button, at any time, after Google sign-in.
- **D7.** After Gmail is saved, only Google opens the profile.
- **D8.** Operating assumptions in section 2 are accepted.
- **D9.** A Gmail already used by another nurse or a supervisor is rejected.
- **D10.** Registered nurses use PRC. Attendants use employee ID only when no PRC is on file.
- **D11.** Staff who already linked with Google skip the first-visit form.
- **D12.** Implementation approach is O1: claim cookie, then Google. Rejected: O2 create a user on first visit. Rejected: O3 keep Google-first linking.
- **D13.** Architecture in section 4 is accepted.
- **D14.** Data and screens in section 5 are accepted.
- **D15.** Errors in section 6 are accepted.
- **D16.** Tests in section 7 are accepted.

---

## 4. Architecture

NurseTrack uses two session types.

### 4.1 Claim session (first visit only)

An unauthenticated form posts PRC license number, or attendant employee ID when no PRC is on file.

The server finds one active nurse row.

The server sets a short-lived httpOnly cookie.

The cookie lasts 30 minutes.

The cookie is signed with the existing app secret.

The cookie holds `nurseId`, a nonce, and an expiry time.

The cookie is not a `users` row.

Admin routes stay closed.

### 4.2 Google session (return visits)

Existing Google OAuth stays.

After Google returns, the server finds a nurse whose `accountEmail` equals the Google email with case ignored.

On match, the server sets `linkedUserId` if it is empty.

The server issues the normal user session.

The server sends the staff member to `/my-profile`.

Supervisors keep the current admin path.

A Google email that matches no staff email and is not an admin stays unlinked.

That unlinked user cannot open a staff profile.

### 4.3 Claim end

Claim ends when Gmail is saved.

The server writes `accountEmail`.

Further claim attempts for that row fail with the generic error.

The change-email button exists only on a Google session.

### 4.4 Authorization

Staff profile APIs accept a valid claim cookie for that `nurseId`.

They also accept a Google user whose `linkedUserId` is that nurse.

They do not accept another nurse id.

---

## 5. Data and screens

### 5.1 Data

Keep `nurses.accountEmail` and `nurses.linkedUserId`.

Do not add a second claimed flag.

A non-empty `accountEmail` means first visit is done.

Add a unique index on lowercased `accountEmail`.

Do not create a `users` row at claim time.

### 5.2 First-visit screen

Route: `/staff-signin`.

The form has one field: PRC license number or employee ID.

On success, redirect to `/my-profile` under the claim cookie.

On failure, show: "No matching staff record, or this profile already has a sign-in email."

Do not say which case it was.

The same page also has "Sign in with Google" for return visits.

### 5.3 Profile under claim

Use the existing `/my-profile` page.

Show a banner: "First visit. Save your Gmail before this session ends."

Required on this visit: account Gmail.

Optional: contact number, photo, middle name, suffix, other allowed personal fields, license files, training files.

Area, employment status, and employee ID are visible and read-only.

### 5.4 Save Gmail

Validate email format.

Reject the address if another nurse or a supervisor already uses it.

Write `accountEmail`.

Block further claim logins for that row.

Change the banner to: "Next time, sign in with Google using this Gmail."

A "Continue with Google" button may show.

That button is not required on the first visit.

### 5.5 Change email

This action exists on a Google session only.

A button opens a small form.

The new address must pass the unique-email rule.

The next Google sign-in must use the new address.

`linkedUserId` stays until the new Google login.

Then the server binds `linkedUserId` to the user for the new email.

---

## 6. Errors and edge cases

- **E1.** No row, archived row, or a row that already has `accountEmail` uses the same generic failure.
- **E2.** Two rows that share one PRC cause a claim reject. A supervisor must fix the data.
- **E3.** An attendant with PRC on file must use PRC, not employee ID.
- **E4.** If the claim cookie expires before Gmail is saved, PRC or employee ID still works.
- **E5.** If the claim cookie expires after Gmail is saved, only Google works.
- **E6.** A Google email that does not match `accountEmail` does not create a nurse. Supervisors still reach admin.
- **E7.** A supervisor Gmail typed as staff email is rejected.
- **E8.** Failed lookups from one IP are rate-limited. The message stays generic.
- **E9.** Change email to an address in use is rejected. The old address stays.
- **E10.** After a change, the old Gmail cannot open the profile. A supervisor may clear `accountEmail` and `linkedUserId` so first visit can run again. Staff UI does not offer that reset.
- **E11.** Already-linked staff use Google on `/staff-signin` and skip the first-visit field.
- **E12.** Two concurrent first visits for the same PRC: the first saved Gmail wins. The second save fails.

---

## 7. Testing

Use Vitest beside the existing staff and auth tests.

### 7.1 First visit

- A valid PRC for an active registered nurse issues a claim cookie and returns that nurse only.
- A wrong number, an archived row, and a filled `accountEmail` return the same generic error.
- An attendant with no PRC can use employee ID.
- An attendant with PRC cannot use employee ID and must use PRC.
- Duplicate PRC is rejected.
- Extra attempts after the rate limit still return the generic error.

### 7.2 Gmail save

- A valid unique email writes `accountEmail` and blocks a second claim.
- A duplicate staff or supervisor email is rejected.
- A claim cookie cannot read or write another `nurseId`.

### 7.3 Google return

- A Google email that matches `accountEmail` sets `linkedUserId` and opens `/my-profile`.
- An unknown Gmail does not create a nurse.
- A supervisor Gmail still reaches admin.
- Already-linked staff skip claim.

### 7.4 Change email

- A Google session can change `accountEmail`.
- A claim session cannot change `accountEmail`.
- The unique-address rule holds.
- The old Gmail no longer matches.

### 7.5 UI checks

These checks may be manual or Playwright later.

- `/staff-signin` shows the identifier field and "Sign in with Google".
- `/my-profile` under claim shows the first-visit banner.
- Area, employment status, and employee ID are read-only for staff.
- The change-email button shows only after Google sign-in.

This path does not add an identity vendor.

This path does not send email.

---

## 8. Non-goals

- Email one-time codes for login.
- Password login.
- Public sign-up.
- Staff access to other staff records or admin pages.
- Staff edits to area, employment status, or employee ID.
- A change to supervisor Google login.

---

## 9. Risks

- **R1.** First visit uses one identifier and no second factor. Mitigation: one-time claim, lock after Gmail, rate limit, generic errors.
- **R2.** Return login depends on Google. If Google is down, staff cannot sign in.
- **R3.** A staff member who types the wrong Gmail is locked out of PRC. Recovery is a supervisor reset of `accountEmail` and `linkedUserId`.
- **R4.** Duplicate PRC values in the roster block claim until a supervisor fixes the data.
