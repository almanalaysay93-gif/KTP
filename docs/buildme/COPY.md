# KTP Copy Deck

Owner: Agent 9 (content-voice), unit U1. Rules live in `docs/buildme/VOICE.md`. Screens follow ORCHESTRATOR "Wow screens".
Keys are suggested ids for a `copy.ts` map. `{braces}` are runtime values (VOICE.md section 8). `\|` in a table is a literal pipe. ` / ` separates variants or sibling labels.
Admin strings are terse. Patient strings (keys starting `me.`) are grade 6 to 8, calm, no medical advice.

## 0. Global

| Key | Copy | Notes (aria, tooltip, states) |
|---|---|---|
| meta.defaultTitle | KTP Patient Tracker | page title pattern: `{Page} \| KTP` |
| meta.description | Private pre and post kidney transplant tracker for enrolled patients and the KT unit. | robots: `noindex, nofollow`. No Open Graph, no JSON-LD |
| nav.admin | Dashboard / Patients / Calendar / Messages / Settings | aria: Admin navigation |
| nav.patient | Home / Results / Checklist / Calendar / Messages / Profile | aria: Main menu |
| nav.signOut | Sign out | toast after: You are signed out. |
| nav.bell | (icon) | aria: Notifications, {n} new |
| sample.badge | Sample data | preview routes only. tooltip: Fictional patients for preview only. No real patient data. aria: Sample data: fictional patients for preview only |
| emergency.banner | In an emergency, call {hotlineText} or go to the nearest emergency room. | spec D6: top of every patient message view. region aria: Emergency information |
| emergency.bannerNoHotline | In an emergency, go to the nearest emergency room. | when the hotline text is blank |
| emergency.settingsLabel | Emergency hotline text | admin Settings help: Shown after the word "call" on every patient message. Enter the hotline name and number exactly as patients should dial it. |

### 0.1 Consent screen (first sign-in and after a version bump, spec 4)

| Key | Copy | Notes |
|---|---|---|
| me.consent.pageTitle | Privacy notice \| KTP | |
| me.consent.heading | Privacy notice | subheading: Data Privacy Act of 2012 (RA 10173) |
| me.consent.intro | Please read how the KT unit handles your health information. | |
| me.consent.body | {consentNoticeText} | footer line: Notice version {consentVersion} |
| me.consent.updated | The privacy notice has changed. Please read it and agree again to keep using KTP. | shown after a version bump |
| me.consent.checkbox | I have read the privacy notice and I agree. | |
| me.consent.button | Agree and continue | disabled hint: Tick the box above to continue. loading: Saving... |
| me.consent.signOut | Sign out | secondary button |
| me.consent.needed | You need to agree before you can see your records. If you have questions, please ask the KT unit. | shown when a blocked page redirects here |
| me.consent.missing | The privacy notice is not ready yet. Please ask the KT unit. | when the notice text is blank |
| me.consent.error | We could not save your answer. Check your internet, then try again. | role="alert" |

### 0.2 Shared errors (spec 8)

| Case | Admin copy | Patient copy |
|---|---|---|
| Network | Could not reach the server. Check the connection and retry. [Retry] | We could not connect. Check your internet, then try again. [Try again] |
| `NOT_FOUND` | Record not found. The link may be out of date. [Back] | We could not find that page. It may have moved. [Go to Home] |
| `FORBIDDEN` admin procedure | not shown | This page is not available for your account. [Go to Home] |
| `FORBIDDEN` consent code | not shown | no message, redirect to the consent screen |
| Session revoked (archived or Gmail changed, spec 4) | Session ended. Sign in again. | Your session has ended. Please sign in again. [Sign in] |
| Email send fails | Email queued for retry. | not shown |

## 1. Sign-in (`/preview/sign-in`, component `KtpSignIn`)

| Key | Copy | Notes |
|---|---|---|
| signin.pageTitle | Sign in \| KTP | main region aria: Sign in |
| signin.logo | (wordmark image) | alt: Organ Transplant Services, established 2017 |
| signin.heading | KTP Patient Tracker | |
| signin.subheading | For enrolled patients and the kidney transplant (KT) unit. | |
| signin.button | Sign in with Google | loading: Signing you in... then Checking your enrollment... |
| signin.helper | Use the Gmail address the KT unit has on file for you. | |
| signin.whyGoogle | Why Google? | tooltip: KTP uses your Google account, so there is no extra password. The KT unit adds your Gmail address when you enroll. |
| signin.privacyNote | Only you and the KT unit can see your records. On your first sign-in, you will see a privacy notice (Data Privacy Act of 2012, RA 10173). You choose whether to agree. | consent note, always visible |
| signin.footer | Organ Transplant Services. Established 2017. | |
| signin.error.cancelled | Sign-in was closed before it finished. Try again when you are ready. | role="alert" |
| signin.error.network | We could not reach Google. Check your internet, then try again. | role="alert" |
| signin.error.generic | Sign-in did not go through. Please try again. | role="alert" |
| notEnrolled.heading | This Google account is not enrolled | page title: Not enrolled \| KTP |
| notEnrolled.body | We could not find {email} in KTP. If you are a KT unit patient, please ask them to check the Gmail address on file. Then sign in again. | same page for unknown and archived emails. Never say which |
| notEnrolled.actions | Use another account / Back to sign-in | primary / secondary |

## 2. Admin dashboard (`/preview/admin`, spec 7.1)

| Key | Copy | Notes |
|---|---|---|
| dash.pageTitle | Dashboard \| KTP | |
| dash.heading | Dashboard | date line: {Weekday}, {d} {Month} {yyyy}. Sample: Wednesday, 30 September 2026 |
| dash.updated | Updated {time} | refresh icon aria: Refresh dashboard |
| dash.tiles | Active patients / Recipients / Donors / Overdue services / Claims due in 7 days / Reschedule requests / Superseded, claim not filed | tile aria: {label}: {n}. Go to list |
| dash.stage.heading | Patients by stage | series: Recipients, Donors. tooltip: Active patients by current stage. Select a stage to open the filtered patient list. |
| dash.stage.chart | (bar chart) | aria: Bar chart of active {type} by stage. {stageLabel} {n}, for each stage. bar aria: {stageLabel}: {n} {type}. Open filtered list |
| dash.stage.empty | No active patients yet. | button: Enroll patient |
| dash.cell | {n} d / Today / {n} d left | "Overdue by" cells / "Time left" cells |
| dash.list.viewAll | View all {n} | |
| dash.loading | Loading dashboard... | per region, aria-busy |
| dash.error | Could not load the dashboard. Check the connection and retry. | per list: Could not load this list. [Retry] |
| claimFiled.title | Mark claim filed | dialog, spec D10 |
| claimFiled.body | {serviceLabel} for {lastName}, {firstName}. Service date {date}. | field: Date filed |
| claimFiled.buttons | Mark filed / Cancel | |
| claimFiled.toast | Claim marked filed: {lastName}, {firstName}, {serviceLabel}. | error: Could not mark the claim filed. Retry. |

Action lists:

| Heading | Tooltip | Columns | Row action (aria) | Empty |
|---|---|---|---|---|
| Overdue services | Planned services past their due date. Counted in Asia/Manila time. | Patient, HRN, Service, Label, Due date, Overdue by | Open (Open tracker for {lastName}, {firstName}) | No overdue services. |
| Claims due within 7 days | Unfiled claims with a deadline from today to 7 days out. | Patient, HRN, Service, Service date, Claim deadline, Time left | Mark filed (Mark claim filed: {serviceLabel}, {lastName}, {firstName}) | No claims due in the next 7 days. |
| Reschedule requests | Setting a new time resets the reply to Pending and notifies the patient. | Patient, Appointment, Scheduled for, Patient note, Requested on | Set new time (Set new time: {title}, {lastName}, {firstName}) | No reschedule requests. |
| Superseded, claim not filed | A repeat test replaced this record. Its own claim is still unfiled. | Patient, HRN, Service, Service date, Repeat reason, Claim deadline | Mark filed (same as above) | No superseded records with unfiled claims. |

## 3. Patient home (`/preview/me`, spec 7.2, phone first)

| Key | Copy | Notes |
|---|---|---|
| me.home.pageTitle | Home \| KTP | |
| me.home.greeting | Hi, {firstName} | fallback: Hi there |
| me.home.subheading | Here is what is coming up. | |
| me.home.stageChip | {patientStageLabel} | from 5.1. Sample: After your transplant |
| me.home.surgeryDate | Transplant date: {date} / Donation date: {date} | recipient / donor |
| me.home.loading | Loading your updates... | |
| me.home.error | We could not load your updates. Check your internet, then try again. | button: Try again |
| me.due.heading | What is due next | order: past due first, then by date. Past due uses the calm chip, never red alarm styling |
| me.due.item | {serviceLabel}, due {date} | relative: Today / Tomorrow / In {n} days / Yesterday / {n} days ago. aria: {serviceLabel}, due {date}, {dueStateLabel} |
| me.due.pastDue | The due date has passed. Please ask the KT unit to set a new date. If you already had this done, the KT unit may not have recorded it yet. | under a Past due item |
| me.due.reminder | You will get an email reminder 7 days before and on the due date. | spec 6.7 |
| me.due.empty | Nothing is due right now. New dates from the KT unit will show here. | link: See all dates |
| me.claims.heading | Claim deadlines | |
| me.claims.helper | Deadlines for claims on your services. Please ask the KT unit if you are not sure what to do. | |
| me.claims.item | {serviceLabel} on {serviceDate}. Deadline {date}. | aria: Claim for {serviceLabel} on {serviceDate}, deadline {date}, {claimLabel} |
| me.claims.pastDeadline | This deadline has passed and the claim is not marked filed. Please ask the KT unit what to do next. | under a Past deadline item |
| me.claims.repeated | This test was repeated. Its claim is still tracked. | under a Superseded item |
| me.claims.empty | No claim deadlines right now. | |
| me.appt.heading | Appointments | |
| me.appt.item | {title}. {date} at {time}. {location} | hint line under each: patient explanation from 5.5 |
| me.appt.confirm | Confirm | aria: Confirm {title} on {date} at {time}. toast: Thanks. Your appointment on {date} is confirmed. error: We could not confirm. Check your internet, then try again. |
| me.appt.reschedule | Request new time | aria: Request a new time for {title} on {date}. Opens the dialog below |
| me.appt.reminder | You will get a reminder 1 day before. | |
| me.appt.empty | No upcoming appointments. | |
| me.resched.title | Request a new time | dialog, spec 6.6 |
| me.resched.body | Tell the KT unit which days or times work better for you. | |
| me.resched.field | Your note | label suffix: Required. placeholder: Example: I can come on Monday or Tuesday morning. |
| me.resched.validation | Please write a short note so the KT unit can find a better time. | spec 8, note required |
| me.resched.buttons | Send request / Cancel | loading: Sending... |
| me.resched.toast | Request sent. You will get a notice when the KT unit sets a new time. | error: We could not send your request. Check your internet, then try again. |
| me.msg.heading | Messages | chip: {n} new. Emergency banner (section 0) sits at the top of this section |
| me.msg.item | From the KT unit | unread chip: New |
| me.msg.ack | I have read this | aria: Mark "{subject}" as read. After: Read on {date} |
| me.msg.ack.toast | Thanks. The KT unit can see that you read this. | error: We could not save that. Check your internet, then try again. |
| me.msg.oneWay | You cannot reply here. For questions, please ask the KT unit. | spec D6, one way |
| me.msg.empty | No new messages. | link: See all messages |

## 4. Patient profile tracker (`/preview/patient`, admin view, spec 7.1)

| Key | Copy | Notes |
|---|---|---|
| profile.pageTitle | {lastName}, {firstName} \| KTP | back link: Back to patients |
| profile.name | {lastName}, {firstName} {middleInitial}. | photo alt: Photo of {fullName} |
| profile.meta | {hrn} · {patientType} · {age} y, {sex} · {status} | |
| profile.doctors | Nephrologist / Fellow in charge | |
| profile.linked | Linked donor / Linked recipient | aria: Open profile of {lastName}, {firstName}, {hrn} |
| profile.surgery | Transplant date / Donation date | then: Post-KT day {n} / Post-donation day {n} |
| profile.risk | Risk | values in 5.1 |
| profile.followup | Follow-up after year 1: every {n} month / every {n} months | |
| profile.actions | Edit patient / Add service / Schedule appointment / Send message | |
| profile.viewLogged | Opening this profile is recorded in the activity log. | spec 4 |
| profile.loading | Loading patient... | not found: Patient not found. The link may be out of date. [Back to patients] |
| stepper | (component) | aria: Stage progress. step aria: {stageLabel}, step {i} of {total}, plus ", current stage" on the current step. button: Change stage |
| stage.error.invalid | Stage not valid for a {patientType}. | spec 8 |
| stage.error.noSurgery | Add the transplant date before moving to Post-KT. / Add the donation date before moving to Post-donation. | spec 8 |
| stage.info.postKt | Moving to Post-KT creates the guide schedule: monthly panel and tacro at day 7, CMV PCR at 1 week and months 1, 2, 3, 6, RT-PCR at months 1, 2, 3. | spec 6.2 |
| tabs | Tracker / Labs / Checklist / Appointments / Messages / History | |
| tracker.card | Last done / Next due / Claim | one card per service type. empty value: Not set. aria: {serviceType}: last done {date}, next due {date}, {dueState}, claim {claimStatus} |
| tracker.toolbar | All services / Show superseded / Add service | filter / toggle / button |
| tracker.columns | Service, Label, Due date, Done on, Status, Claim deadline, Filed on, Claim, Source | |
| tracker.source | Guide / Manual | Guide tooltip: Created from the monitoring guide schedule. You can change the date. |
| tracker.row.superseded | Superseded by the repeat on {date}. Left out of trends and flags. | row greyed |
| tracker.row.repeat | Repeat of {date}. Reason: {repeatReasonLabel}. | |
| tracker.row.corrected | Corrected on {date} | tooltip: Edited with reason: {reason}. See History. |
| tracker.row.actions | Record result / Edit / Repeat test / Mark claim filed | menu aria: Actions for {serviceLabel}, due {date} |
| tracker.empty | No services yet. Add the first planned service. | loading: Loading tracker... |
| result.title | Record result: {serviceLabel} | fields: Service date, Claim deadline, Claim filed on |
| result.values | Lab values | columns: Test, Value, Unit, Usual range, Flag. placeholder: Enter value |
| result.value.error | Enter a number of 0 or more. | spec 8. Note under table: Out-of-range values are saved and flagged. |
| result.nextDue | Next due date | |
| result.nextDue.guide | Suggested from the transplant date: {date}. Rule: {tierRule}. You can change it. | tierRule: month 1, every 7 days / month 2, every 14 days / months 3 to 12, every month / after year 1, every {followupMonths} month(s) |
| result.nextDue.manual | Prefilled: due date plus {n} days. You can change it. | when `repeatEveryDays` is set |
| result.buttons | Save result / Cancel | loading: Saving... |
| result.toast | Result saved. Next due {date} added. | error: Could not save the result. Check the values and retry. |
| repeat.title | Repeat test | |
| repeat.body | Creates a new record for the same due date ({dueDate}). The current record becomes Superseded and is left out of trends and flags. | |
| repeat.fields | Reason / Note (optional) / Claim deadline for the repeat | claim help: The repeat has its own claim deadline and filed tick. |
| repeat.buttons | Create repeat / Cancel | toast: Repeat created. Original marked Superseded. |
| repeat.error.planned | Only a Done record can be repeated. | spec 8 |
| edit.title | Edit record | |
| edit.reason | Reason for change | help: Required. Saved to History with the before and after values. error: Enter a reason for this change. |
| edit.buttons | Save changes / Cancel | toast: Record updated. Change saved to History. |
| labs.picker | Test | |
| labs.chart.title | {testName} trend | y axis: {unit} |
| labs.chart.band | Reference range {low} to {high} {unit} | no range: No range set. Flags are off for this test. |
| labs.chart.legend | Result / Out of range | note: Superseded results are not charted. |
| labs.chart.tooltip | {date}: {value} {unit}, {flagLabel} | |
| labs.chart.aria | Line chart of {testName}: {n} results from {firstDate} to {lastDate}. Latest {value} {unit}, {flagLabel}. | sample: Line chart of Creatinine: 10 results from 6 May 2026 to 3 Sep 2026. Latest 96 umol/L, In range. |
| labs.toggle | Show as table / Show as chart | table columns: Date, Value, Flag, Service record |
| labs.empty | No results yet for {testName}. | loading: Loading results... |
| history.columns | When, Who, What, Reason | empty: No changes yet. |

## 5. Status label dictionary

Patient label is what `/me` shows. Admin label is what the console shows. Explanation is the patient tooltip or helper line.

### 5.1 Patient stages (spec D7)

| Value | Type | Admin label | Stepper short | Patient label | Patient explanation |
|---|---|---|---|---|---|
| Orientation | Both | Orientation | Orientation | Getting started | You learn about the transplant process with the KT unit. |
| Phase1 | Both | Phase 1 work-up | Phase 1 | First tests | Your first set of blood, urine, and imaging tests. |
| Phase2 | Recipient | Phase 2 work-up | Phase 2 | Matching tests | Tissue matching tests between you and your donor. |
| Phase2 | Donor | Phase 2 work-up | Phase 2 | Matching and kidney scans | Tissue matching, plus scans of your kidneys and blood vessels. |
| Clearances | Recipient | Clearances | Clearances | Specialist check-ups | Visits with other doctors, such as heart, dental, and infection doctors, to check you are ready for surgery. |
| Clearances | Donor | Clearances | Clearances | Specialist check-ups | Visits with other doctors, including a donor advocate, to check you are ready for surgery. |
| PhilHealthZ | Recipient | PhilHealth Z | PhilHealth Z | PhilHealth Z Package | Qualifying and applying for the PhilHealth Z Package. |
| Phase3 | Both | Phase 3 pre-admission | Phase 3 | Final tests before surgery | Last tests before you are admitted for surgery. |
| PostKT | Recipient | Post-KT | Post-KT | After your transplant | Regular tests, medicine claims, and follow-up visits after your transplant. |
| PostDonation | Donor | Post-donation | Post-donation | After your donation | Follow-up tests and visits after your donation. |

Archive status (admin only, never shown to patients): Active, Inactive, Deceased, Transferred.
Risk category (admin only): StandardLow "Standard or low", High "High", null "Not set".

### 5.2 Service types (spec D8)

| Value | Label (both surfaces) | Patient explanation |
|---|---|---|
| Meds | Meds claim | Your recurring medicine claim, tracked by the KT unit. |
| Laboratory | Laboratory | Blood and urine tests your care team uses to follow your health. |
| Tacro | Tacro test | A blood test for your tacrolimus level. Tacrolimus is one of your transplant medicines. |
| XrayUsd | X-ray and USD | Imaging tests: a chest X-ray and an ultrasound (USD) scan. |

### 5.3 Service status and due states

| Value | Admin label | Patient label | Rule | Patient explanation |
|---|---|---|---|---|
| Planned | Planned | Scheduled | stored | This test is scheduled and not done yet. |
| Done | Done | Done | stored | Done on {serviceDate}. |
| Superseded | Superseded | Repeated | stored | This test was done again. The newer result is the one shown in your charts. |
| Overdue | Overdue | Past due | Planned and dueDate before today | The due date has passed. Please ask the KT unit to set a new date. |
| DueSoon | Due soon | Due soon | Planned and dueDate from today to today + 7 | Due within the next 7 days. |
| Upcoming | Upcoming | Coming up | Planned and dueDate after today + 7 | Due later. You will get a reminder 7 days before. |

### 5.4 Claim status (computed, spec 6.5)

| Value | Admin label | Patient label | Patient explanation |
|---|---|---|---|
| Filed | Filed | Claim filed | This claim was marked filed on {claimFiledDate}. |
| Overdue | Overdue | Past deadline | The deadline has passed and the claim is not marked filed. Please ask the KT unit what to do next. |
| DueSoon | Due soon | Claim due soon | The claim deadline is within 7 days. |
| Open | Open | Claim open | The claim is not filed yet. The deadline is more than 7 days away. |
| None | No deadline | No deadline | There is no claim deadline for this item. |

### 5.5 Appointment responses (spec 6.6)

| Value | Admin label | Patient label | Patient explanation |
|---|---|---|---|
| Pending | Awaiting reply | Please reply | Please tap Confirm or Request new time. |
| Confirmed | Confirmed | Confirmed | You confirmed this appointment. |
| RescheduleRequested | Reschedule requested | New time requested | You asked for a new time. You will get a notice when the KT unit sets it. |
| cancelledAt set | Cancelled | Cancelled | The KT unit cancelled this appointment on {date}. |

Appointment kinds: FollowUp "Follow-up visit", Biopsy "Biopsy", Workup "Work-up test", Clearance "Clearance visit", Other "Other".

### 5.6 Lab flags (spec 5.3, A5)

| Value | Admin label | Patient label | Patient explanation |
|---|---|---|---|
| Low | Low | Below range | This result is below the lab's usual range. Your care team can explain what it means for you. |
| Normal | Normal | In range | This result is within the lab's usual range. |
| High | High | Above range | This result is above the lab's usual range. Your care team can explain what it means for you. |
| null | No range | No range set | The lab has not set a usual range for this test, so there is no flag. |

### 5.7 Repeat reasons (spec 5.3)

| Value | Admin label | Patient label | Patient explanation |
|---|---|---|---|
| Hemolyzed | Hemolyzed | Sample damaged | The blood cells in the sample broke apart, so the test was done again. |
| Clotted | Clotted | Sample clotted | The blood sample clotted before testing, so the test was done again. |
| WrongTroughTiming | Wrong trough timing | Timing issue | The tacro sample was not taken at the planned time, so the test was done again. |
| LabError | Lab error | Lab problem | The lab had a problem with the test, so it was done again. |
| DoctorRequest | Doctor request | Doctor's request | Your doctor asked for the test to be done again. |
| Other | Other | Other reason | The test was done again. See the note from the KT unit. |

## 6. Sample data, fictional

Every name, HRN, date, location, and value below is invented for preview screens. No real patients. Today is `2026-09-30` (Wednesday, Asia/Manila). Show the "Sample data" badge on every screen that uses it.

### 6.1 Doctors

| id | name | role |
|---|---|---|
| d1 | Dr. Leonora Bautista-Galvez | Nephrologist |
| d2 | Dr. Rafael Macaraeg | Nephrologist |
| d3 | Dr. Soledad Evangelista | Nephrologist |
| d4 | Dr. Paolo Sarmiento | Fellow |
| d5 | Dr. Kristine Abad | Fellow |
| d6 | Dr. Jericho Lumbao | Fellow |

### 6.2 Patients (all `status: Active`)

| id | hrn | firstName | middleName | lastName | type | sex | birthDate | age | stage | surgeryDate | neph | fellow | linkedRecipientId | riskCategory | followupMonths |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| p01 | HRN-2026-0147 | Analyn | Ferrer | Villacorta | Recipient | F | 1988-03-14 | 38 | PostKT | 2026-04-29 | d1 | d4 | null | StandardLow | 1 |
| p02 | HRN-2025-0832 | Rodel | Tupas | Dimaculangan | Recipient | M | 1974-06-02 | 52 | PostKT | 2025-11-12 | d2 | d5 | null | StandardLow | 1 |
| p03 | HRN-2024-0519 | Evangeline | Pacquing | Serrano | Recipient | F | 1981-01-19 | 45 | PostKT | 2024-08-20 | d3 | d6 | null | High | 2 |
| p04 | HRN-2026-0391 | Jomar | Alcantara | Pineda | Recipient | M | 1997-05-08 | 29 | PostKT | 2026-08-26 | d1 | d5 | null | StandardLow | 1 |
| p05 | HRN-2026-0412 | Charito | Lagman | Esguerra | Recipient | F | 1970-02-11 | 56 | Phase3 | null | d2 | d4 | null | StandardLow | 1 |
| p06 | HRN-2026-0228 | Bernardo | Yap | Ilagan | Recipient | M | 1979-07-21 | 47 | PhilHealthZ | null | d3 | d6 | null | High | 1 |
| p07 | HRN-2026-0455 | Maricar | Umali | Gallardo | Recipient | F | 1992-04-03 | 34 | Clearances | null | d1 | d6 | null | null | 1 |
| p08 | HRN-2026-0503 | Nestor | Quijano | Abellera | Recipient | M | 1965-08-30 | 61 | Phase1 | null | d2 | d5 | null | null | 1 |
| p09 | HRN-2026-0148 | Ramil | Ferrer | Villacorta | Donor | M | 1985-09-02 | 41 | PostDonation | 2026-04-29 | d1 | d4 | p01 | null | 1 |
| p10 | HRN-2025-0833 | Josielyn | Arcega | Dimaculangan | Donor | F | 1977-03-25 | 49 | PostDonation | 2025-11-12 | d2 | d5 | p02 | null | 1 |
| p11 | HRN-2026-0413 | Rhea | Esguerra | Tolentino | Donor | F | 1996-01-15 | 30 | Phase3 | null | d2 | d4 | p05 | null | 1 |
| p12 | HRN-2026-0456 | Arvin | Umali | Gallardo | Donor | M | 1989-06-17 | 37 | Phase2 | null | d1 | d6 | p07 | null | 1 |

Featured patient: **p01 Analyn F. Villacorta**, transplant 2026-04-29, Post-KT day 154. Linked donor p09 (her brother).
Stage spread note: 8 recipients cannot fill all 7 stages with 4 in Post-KT. Orientation and Phase 2 show 0 recipients, which also exercises the chart's zero state.

### 6.3 Featured service records (p01)

`rule` means `claimDeadline = serviceDate + 30 days` and `claimFiledDate = serviceDate + 14 days` (claim Filed).
Due states are as of 2026-09-30. `repeatOfId`, `repeatReason`, `repeatEveryDays`, `note` are null unless listed.

| id | serviceType | label | status | dueDate | serviceDate | claimDeadline | claimFiledDate | claim | source | extra |
|---|---|---|---|---|---|---|---|---|---|---|
| r01 to r07 | Laboratory | Monthly panel | Done | 2026-05-06, 05-13, 05-20, 05-27, 06-03, 06-17, 07-01 (one row each) | same as dueDate | rule | rule | Filed | Guide | |
| r08 | Laboratory | Interim check | Done | 2026-07-15 | 2026-07-15 | rule | rule | Filed | Manual | note: Extra draw ordered by Dr. Bautista-Galvez |
| r09 | Laboratory | Monthly panel | Done | 2026-08-01 | 2026-08-03 | 2026-09-25 | null | Overdue | Guide | |
| r10 | Laboratory | Monthly panel | Superseded | 2026-09-01 | 2026-09-01 | 2026-10-12 | null | Open | Guide | dashboard: Superseded, claim not filed |
| r11 | Laboratory | Monthly panel | Done | 2026-09-01 | 2026-09-03 | 2026-10-02 | null | DueSoon | Manual | repeatOfId r10, repeatReason Hemolyzed |
| r12 | Laboratory | Monthly panel | Planned | 2026-10-01 | null | null | null | None | Guide | Due soon (tomorrow) |
| r13 to r16 | Laboratory | CMV PCR | Done | 2026-05-06, 05-29, 06-29, 07-29 (1 week, months 1, 2, 3) | same as dueDate | rule | rule | Filed | Guide | |
| r17 | Laboratory | CMV PCR | Planned | 2026-10-29 | null | null | null | None | Guide | month 6, Upcoming |
| r18 to r20 | Laboratory | RT-PCR | Done | 2026-05-29, 06-29, 07-29 (months 1, 2, 3) | same as dueDate | rule | rule | Filed | Guide | |
| t01 to t07 | Tacro | Tacro trough | Done | same dates as r01 to r07 | same as dueDate | rule | rule | Filed | Guide | |
| t08 | Tacro | Tacro recheck | Done | 2026-07-15 | 2026-07-15 | rule | rule | Filed | Manual | |
| t09 | Tacro | Tacro trough | Done | 2026-08-01 | 2026-08-03 | rule | rule | Filed | Guide | filed 2026-08-17 |
| t10 | Tacro | Tacro trough | Done | 2026-09-01 | 2026-09-01 | 2026-10-15 | null | Open | Guide | |
| t11 | Tacro | Tacro trough | Planned | 2026-10-01 | null | null | null | None | Guide | Due soon (tomorrow) |
| m01 | Meds | Meds claim | Done | 2026-08-07 | 2026-08-07 | rule | rule | Filed | Manual | repeatEveryDays 28 |
| m02 | Meds | Meds claim | Done | 2026-09-04 | 2026-09-04 | 2026-10-05 | null | DueSoon | Manual | repeatEveryDays 28 |
| m03 | Meds | Meds claim | Planned | 2026-10-02 | null | null | null | None | Manual | Due soon (in 2 days) |
| x01 | XrayUsd | Chest X-ray and graft ultrasound | Done | 2026-06-24 | 2026-06-24 | 2026-07-24 | 2026-07-20 | Filed | Manual | repeatEveryDays 90 |
| x02 | XrayUsd | Chest X-ray and graft ultrasound | Planned | 2026-09-22 | null | null | null | None | Manual | Overdue by 8 d |

Tracker cards for p01:

| Service | Last done | Next due | Due state | Claim on last done |
|---|---|---|---|---|
| Meds claim | 04 Sep 2026 | 02 Oct 2026 | Due soon | Due soon (05 Oct) |
| Laboratory | 03 Sep 2026 (repeat) | 01 Oct 2026 | Due soon | Due soon (02 Oct) |
| Tacro test | 01 Sep 2026 | 01 Oct 2026 | Due soon | Open (15 Oct) |
| X-ray and USD | 24 Jun 2026 | 22 Sep 2026 | Overdue, 8 d | Filed (20 Jul) |

### 6.4 Lab trend points (p01, Superseded excluded)

Sample reference ranges (the admin enters the real hospital lab ranges, spec A5): Creatinine `low 53, high 106` umol/L. Tacrolimus trough `low 5.0, high 10.0` ng/mL.

| # | Creatinine record | date | umol/L | flag | Tacro record | date | ng/mL | flag |
|---|---|---|---|---|---|---|---|---|
| 1 | r01 | 2026-05-06 | 142 | High | t01 | 2026-05-06 | 7.4 | Normal |
| 2 | r02 | 2026-05-13 | 126 | High | t02 | 2026-05-13 | 9.1 | Normal |
| 3 | r03 | 2026-05-20 | 117 | High | t03 | 2026-05-20 | 11.3 | High |
| 4 | r04 | 2026-05-27 | 111 | High | t04 | 2026-05-27 | 10.6 | High |
| 5 | r05 | 2026-06-03 | 108 | High | t05 | 2026-06-03 | 9.4 | Normal |
| 6 | r06 | 2026-06-17 | 103 | Normal | t06 | 2026-06-17 | 8.7 | Normal |
| 7 | r07 | 2026-07-01 | 100 | Normal | t07 | 2026-07-01 | 12.1 | High |
| 8 | r08 | 2026-07-15 | 104 | Normal | t08 | 2026-07-15 | 8.9 | Normal |
| 9 | r09 | 2026-08-03 | 98 | Normal | t09 | 2026-08-03 | 7.6 | Normal |
| 10 | r11 | 2026-09-03 | 96 | Normal | t10 | 2026-09-01 | 6.8 | Normal |

Superseded, shown grey in tables and left out of the chart: r10, 2026-09-01, Creatinine 101 umol/L.

### 6.5 Appointments (`cancelledAt` null for all)

| id | patientId | title | kind | startsAt (Asia/Manila) | location | response | responseNote | respondedAt |
|---|---|---|---|---|---|---|---|---|
| a01 | p01 | Follow-up visit | FollowUp | 2026-09-03 08:30 | KT clinic | Confirmed | null | 2026-08-28 (past) |
| a02 | p01 | Blood draw: monthly labs and tacro | Other | 2026-10-01 07:00 | KT clinic | Pending | null | null |
| a03 | p01 | Chest X-ray and graft ultrasound | Other | 2026-10-02 10:00 | Imaging section | RescheduleRequested | I have work this Friday. Can we move it to Monday or Tuesday next week? | 2026-09-28 |
| a04 | p01 | Follow-up visit | FollowUp | 2026-10-06 09:00 | KT clinic | Confirmed | null | 2026-09-25 |
| a05 | p12 | Renal CT angiography | Workup | 2026-10-08 13:00 | Imaging section | RescheduleRequested | I need to file leave at work first. Any day the week after is fine. | 2026-09-29 |

### 6.6 Messages (p01 inbox)

| id | sentAt | audience | subject | body | readAt | acknowledgedAt |
|---|---|---|---|---|---|---|
| g01 | 2026-09-29 16:10 | One patient | Blood tests on Thursday | Hi Analyn. Your monthly blood tests and tacro test are due on Thu, 1 Oct. Please open Calendar and tap Confirm. | null | null |
| g02 | 2026-09-28 14:30 | One patient | We got your request | We received your request to move your chest X-ray and ultrasound. We will set a new time, and you will get a notice. | null | null |
| g03 | 2026-08-18 10:00 | One patient | Claim filed | The claim for your 3 Aug tacro test is filed. | 2026-08-18 | 2026-08-18 |
| g04 | 2026-09-01 09:00 | All recipients | Your records in KTP | You can now see your tests, claims, and appointments in KTP. If something looks wrong, please tell the KT unit. | 2026-09-02 | null |

Unread: g01, g02. Acknowledged: g03. Read, not acknowledged: g04.

### 6.7 Admin dashboard aggregates (derived from 6.2 to 6.5)

Tiles: Active patients 12. Recipients 8. Donors 4. Overdue services 5. Claims due in 7 days 4. Reschedule requests 2. Superseded, claim not filed 1.

Recipients by stage: Orientation 0, Phase 1 work-up 1, Phase 2 work-up 0, Clearances 1, PhilHealth Z 1, Phase 3 pre-admission 1, Post-KT 4 (total 8).
Donors by stage: Orientation 0, Phase 1 work-up 0, Phase 2 work-up 1, Clearances 0, Phase 3 pre-admission 1, Post-donation 2 (total 4).

Overdue services (sorted by days overdue):

| Patient | HRN | Service | Label | Due date | Overdue by |
|---|---|---|---|---|---|
| Dimaculangan, Rodel T. | HRN-2025-0832 | X-ray and USD | Chest X-ray and graft ultrasound | 11 Sep 2026 | 19 d |
| Abellera, Nestor Q. | HRN-2026-0503 | Laboratory | Phase 1 labs | 15 Sep 2026 | 15 d |
| Serrano, Evangeline P. | HRN-2024-0519 | Tacro test | Tacro trough | 21 Sep 2026 | 9 d |
| Villacorta, Analyn F. | HRN-2026-0147 | X-ray and USD | Chest X-ray and graft ultrasound | 22 Sep 2026 | 8 d |
| Pineda, Jomar A. | HRN-2026-0391 | Meds claim | Meds claim | 25 Sep 2026 | 5 d |

Claims due within 7 days (sorted by deadline):

| Patient | HRN | Service | Service date | Claim deadline | Time left |
|---|---|---|---|---|---|
| Dimaculangan, Rodel T. | HRN-2025-0832 | Tacro test | 10 Sep 2026 | 01 Oct 2026 | 1 d left |
| Villacorta, Analyn F. | HRN-2026-0147 | Laboratory, Monthly panel (repeat) | 03 Sep 2026 | 02 Oct 2026 | 2 d left |
| Villacorta, Analyn F. | HRN-2026-0147 | Meds claim | 04 Sep 2026 | 05 Oct 2026 | 5 d left |
| Villacorta, Ramil F. | HRN-2026-0148 | Laboratory, Donor follow-up | 16 Sep 2026 | 06 Oct 2026 | 6 d left |

Reschedule requests: a03 (Villacorta, Analyn F., requested 28 Sep 2026) and a05 (Gallardo, Arvin U., requested 29 Sep 2026).
Superseded, claim not filed: r10 (Villacorta, Analyn F., HRN-2026-0147, Laboratory, Monthly panel, 01 Sep 2026, Hemolyzed, claim deadline 12 Oct 2026).

Consistency rule: every other record of p02 to p12 is either Done with claim Filed or Planned and not yet past due, and every other appointment is Confirmed or Pending, so the counts above stay exact.

### 6.8 Patient home view for p01 (derived)

- What is due next: X-ray and USD, Tue 22 Sep, 8 days ago, Past due. Laboratory, Monthly panel, Thu 1 Oct, Tomorrow. Tacro test, Thu 1 Oct, Tomorrow. Meds claim, Fri 2 Oct, In 2 days. Laboratory, CMV PCR, Thu 29 Oct, In 29 days.
- Claim deadlines: Laboratory on 3 Aug, deadline Fri 25 Sep, Past deadline. Laboratory repeat on 3 Sep, deadline Fri 2 Oct, Claim due soon. Meds claim on 4 Sep, deadline Mon 5 Oct, Claim due soon. Laboratory on 1 Sep (repeated), deadline Mon 12 Oct, Claim open. Tacro test on 1 Sep, deadline Thu 15 Oct, Claim open.
- Appointments: Thu 1 Oct 7:00 AM, Please reply. Fri 2 Oct 10:00 AM, New time requested. Tue 6 Oct 9:00 AM, Confirmed.
- Messages: 2 new (g01, g02), emergency banner on top.
