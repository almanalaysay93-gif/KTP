# Product

<!-- impeccable:product-schema 1 -->

Owner: U2 (Agent 1, impeccable-director). Sources: `docs/plans/2026-09-30-ktp-patient-tracker-design.md` (the spec), `docs/buildme/ORCHESTRATOR.md` (Design Read confirmed 2026-09-30), `docs/reference/kt-evaluation-monitoring-guide.md`. No separate user interview was run for this file; facts marked **(inferred)** come from the orchestrator brief and need confirmation by the product owner. Everything else is quoted or derived from the spec.

## Platform

web (responsive; admin is desktop-first, the patient portal is phone-first)

## Users

**1. The admin (one person).** A kidney transplant (KT) coordinator or nephrology admin at Organ Transplant Services (OTS). Works on a desktop, usually at the start of the day and again between clinic tasks. Owns every write in the system: enrollment, lab results, claim deadlines, appointments, messages. A second admin is possible via the email allowlist (spec A1) but is not designed for.

**2. Patients: recipients and living donors.** Adults of mixed ages and tech comfort, on phones. Recipients are before or after a transplant; donors are linked to one recipient and have their own login (D15). Many are anxious: they are waiting for surgery, living with a new kidney, or recovering from donation. **(inferred)** Many use low-end Android phones on slow or metered mobile data, and share or borrow devices. Patients are read-only except for appointment responses, acknowledgments, contact number, and photo (D2, D3, D6).

## Jobs to be done

### Admin

| When I... | I want to... | So that... |
|---|---|---|
| open the app in the morning | see every overdue service, claim due within 7 days, reschedule request, and superseded unfiled claim in one place | nothing slips past a deadline and I know who to call first |
| open one patient | see stage, doctors, the four tracker items (Meds, Laboratory, Tacro, X-ray and USD), claim status, and lab trends at a glance | I can answer a doctor's or patient's question without digging |
| get a lab report | record values, see flags against the unit's reference ranges, and have the next due date suggested from the guide tiers | the schedule stays correct without manual date math |
| find a typo or a hemolyzed sample | correct with a reason, or record a retest that supersedes the original | the history stays honest and auditable |
| need to reach patients | message one patient, a stage, all recipients, all donors, or everyone, and see who acknowledged | important notices are confirmed, not assumed |

### Patient (recipient or donor)

| When I... | I want to... | So that... |
|---|---|---|
| open the app | see my next due test or appointment and its date first | I know what I have to do and when, without reading everything |
| have a claim deadline coming | see the deadline and whether it is filed | I do not lose a benefit because of a missed date |
| get an appointment | confirm it, or request a reschedule with a note | the unit knows I am coming, or why I cannot |
| get my results | see values, flags, and trends in plain words | I understand my results before my follow-up |
| read a message | acknowledge it and always see the emergency contact | I know who to call if something is wrong |
| am in work-up | see my checklist progress by phase | I know what is left before surgery or donation |

## Product Purpose

KTP replaces the unit's post-KT spreadsheet and scattered reminders with one private registry for pre and post kidney transplant recipients and their living donors: laboratory tracking with flags and trends, claims deadlines, scheduling with patient confirmation, work-up checklists, and one-way admin messaging with acknowledgment. Success means no missed claim deadlines or overdue tests go unnoticed, and patients know their next step without calling the unit.

## Positioning

A registry shaped around one real unit's workflow: the same four tracker items, the same stages, the same guide tiers that auto-suggest post-KT lab and tacro dates from the transplant date (D14), and claims deadlines tracked separately from service dates (D9). The patient sees exactly what the admin sees about them (D13). A generic EMR or reminder app cannot truthfully claim that fit.

## Operating Context

- Organ Transplant Services, established 2017 (per logo). Timezone Asia/Manila. Hosting region Singapore (`sin1`), closest to Davao (spec section 4).
- Admin: desktop browser, daily triage session, keyboard and mouse. Patients: mobile browser, short sessions, often one-handed, sometimes outdoors in strong light **(inferred)**.
- Reminder emails run once daily at 08:00 Asia/Manila (spec A7); the in-app bell mirrors them.
- Copy language: English UI. Taglish or Filipino copy decisions belong to U1 (`docs/buildme/VOICE.md`).

## Capabilities and Constraints

- Stack: React 19, Tailwind 4, framer-motion 12, recharts 2, lucide-react, wouter, tRPC 11, Drizzle, Postgres (Supabase), Vercel. No new npm dependencies (orchestrator rule 6).
- Sign-in is Google only. Admin access is an email allowlist; patients are matched by enrolled Gmail (D5).
- Recipient stages: Orientation, Phase1, Phase2, Clearances, PhilHealthZ, Phase3, PostKT. Donor stages: Orientation, Phase1, Phase2, Clearances, Phase3, PostDonation. Status: Active, Inactive, Deceased, Transferred (D7).
- Service record status: Planned, Done, Superseded. Claim status is computed: Filed, Overdue, DueSoon (7 days), Open, None (spec 6.5). Lab flags: Low, Normal, High, or none when the range is blank (A5).
- Hundreds of patients, not thousands (A3).
- Terminology: "KT" (kidney transplant), "HRN" (hospital record number), "Tacro" (tacrolimus trough), "X-ray and USD" (ultrasound), "claim deadline", "filed", "superseded", "work-up".

## Success Criteria

Targets are proposals **(inferred)**; the orchestrator or product owner confirms them.

| # | Criterion | Measure |
|---|---|---|
| S1 | Admin triage is one screen | From dashboard load, every overdue service, claim due within 7 days, reschedule request, and superseded unfiled claim is reachable in 1 click; a full morning triage pass takes 60 seconds or less |
| S2 | No silent claim deadlines | 100% of unfiled claims with a deadline within 7 days appear on the dashboard and in the daily digest |
| S3 | Recording is fast | Record a lab result with 5 values in 90 seconds or less; the suggested next due date is prefilled |
| S4 | Patient next step is immediate | At 360x640 and 390x844, the next due item and its date are visible without scrolling |
| S5 | Appointment response is short | Confirm an appointment in 2 taps or fewer from `/me` |
| S6 | Works on slow phones | `/me` LCP 2.5 s or less and CLS under 0.1 on Lighthouse mobile (Moto G Power, Slow 4G); webfont bytes 90 KB or less (latin) |
| S7 | Accessible | Lighthouse accessibility 95 or more and zero axe serious or critical issues on the four wow screens; all text 4.5:1 or more |
| S8 | Patients understand flags | Every flag and status shows a word and an icon, never color alone |

## Non-goals

From spec section 11:

- Inpatient post-operative labs (days 0 to 6); the hospital EMR covers them.
- Per-patient tacrolimus target ranges by months post-KT (one catalog range for now).
- Two-way messaging or patient replies.
- Patient self-booking of appointments.
- Patient-entered or patient-uploaded lab results.
- SMS reminders.
- Bulk import of the existing post-KT spreadsheet.

From the orchestrator brief: no dark mode, no public marketing site or SEO, no llms.txt, no native apps.

## Privacy Stance

- Private health data under the Data Privacy Act of 2012 (RA 10173). First sign-in shows a privacy notice and consent screen; the portal stays blocked until consent (spec section 4).
- Not indexed: `<meta name="robots" content="noindex, nofollow">` on every page and an `X-Robots-Tag: noindex` header. No sitemap, no llms.txt, no analytics or third-party trackers.
- No data in URLs beyond opaque ids: no names, HRNs, emails, dates of birth, or lab values in paths, query strings, or fragments. Search terms stay in component state, not in the URL.
- Document titles and notification text never contain patient names, HRNs, or lab values (tabs, history, and lock-screen previews leak on shared devices). Title pattern: `Patient profile | KTP`.
- Patients see only their own rows. Donors and recipients never see each other's data (spec section 4).
- Every admin write and every admin open of a patient profile is logged (`activityLog`).
- No real patient data in mocks, previews, screenshots, or tests. Demo names are clearly fictional (orchestrator rule 4).
- Open decision: webfonts load from Google Fonts, which sends the viewer's IP to Google. If the hospital DPO objects, self-host the same three families.

## Brand Commitments

- Organ Transplant Services logo: `client/public/branding/ots-logo.png` (wordmark), `client/public/branding/ots-mark.png` (3x3 organ grid mark). Do not recolor, crop, or redraw the mark itself; slicing it into its nine cells for the sign-in tray is allowed because each cell keeps its original pixels.
- Palette is sampled from the logo (see `docs/buildme/ORCHESTRATOR.md` and `DESIGN.md`).
- Confirmed Design Read: light claymorphism, full-blast spring motion on admin, calmer motion on patient surfaces, reduced motion always honored.

## Evidence on Hand

- Clinical workflow: the spec and `docs/reference/kt-evaluation-monitoring-guide.md`.
- Logo assets above. No photography, no patient testimonials, no outcome statistics. Do not invent any of these.

## Product Principles

1. **Next step first.** Every screen opens on what is due, overdue, or waiting for a response. History is one tap deeper.
2. **Numbers are evidence.** Values, dates, units, and HRNs are shown exactly, with the word for every flag. Nothing clinical is rounded, hidden, or carried by color alone.
3. **Fast for the admin, calm for the patient.** The admin gets density and speed. The patient gets one clear thing at a time, plain words, and no alarm styling for routine items.
4. **Same truth on both sides.** The patient sees what the admin sees about them, including claim deadlines and filed status.
5. **Private by default.** If a detail is not needed to act, it is not shown, sent, or put in a URL.

## Accessibility & Inclusion

- WCAG 2.2 AA minimum: text 4.5:1, large text and UI glyphs 3:1, touch targets 44 px or more, visible focus on every interactive element, full keyboard paths.
- `prefers-reduced-motion: reduce` is never waived.
- Mixed ages and possible low vision: patient body text 17 px or more, no text under 14 px on patient surfaces, 200% zoom without loss, reflow at 320 px.
- Screen reader labels for every status chip, chart, count, and stepper.
