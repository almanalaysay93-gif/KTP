# KTP Voice Rails

Owner: Agent 9 (content-voice), unit U1. Every screen builder reads this before writing any string.
Companion file: `docs/buildme/COPY.md` (screen copy, status dictionary, sample data).

## 1. Who reads KTP

| Surface | Reader | Setting | What they need from the words |
|---|---|---|---|
| Admin console (`/dashboard`, `/patients`, `/calendar`, `/messages`, `/settings`) | The KT unit master admin (spec A1). Clinical, knows every term | Desktop, many patients, repeat daily use | Facts fast. Counts, dates, names, HRNs, what to do next |
| Patient portal (`/me/*`) | Kidney transplant recipients and living donors (spec 1). Mixed ages, mixed tech comfort, often anxious | Phone first, one hand, sometimes weak signal | What is next, when, and who to ask. Calm and clear |

Both surfaces show the same facts (spec D13). The admin and the patient see the same dates, statuses, and claim deadlines. Only the tone and the wording depth change.

## 2. Voice in one line each

- **Admin console:** terse, exact, scannable. A clinical logbook, not a chat.
- **Patient portal:** a calm nurse at the front desk. Plain words, short sentences, never alarming, never medical advice, always points to the care team.

## 3. Admin console rules

1. Lead with the number or the name. "5 overdue services", not "There are currently 5 services that are overdue".
2. Use the unit's own terms from the tracker sheet and spec: HRN, Meds claim, Laboratory, Tacro test, X-ray and USD, Post-KT, Superseded, CMV PCR, RT-PCR.
3. Labels are nouns. Buttons are verb first: "Mark claim filed", "Record result", "Repeat test", "Set new time".
4. Sentence case everywhere. Capitalize only the first word and proper nouns ("PhilHealth Z", "Google").
5. No filler, no praise, no exclamation marks. "Saved." not "Great job, saved!".
6. Show exact values with units: "96 umol/L", "6.8 ng/mL". One decimal for tacrolimus, whole numbers for creatinine.
7. Durations use short units in tables: "18 d", "5 d left". Spell out in toasts and dialogs.
8. Errors say what failed and how to fix it in one line. The tRPC code may appear in small muted text after the sentence for the admin only.
9. Never use a color alone. Every status chip carries its text label.

Admin do and don't:

| Do | Don't |
|---|---|
| "Overdue by 8 d" | "Uh oh, this one is late!" |
| "Claim deadline 02 Oct 2026. Not filed." | "Don't forget to file the claim soon" |
| "Stage not valid for a Donor." | "Something went wrong." |
| "Superseded, claim not filed" (spec 6.5 wording) | "Old record with pending paperwork" |

## 4. Patient portal rules

1. **Reading level: grade 6 to 8.** Average sentence 12 words or fewer. Hard cap 20 words. Prefer one and two syllable words.
2. **Second person, active voice.** "Your blood test is due tomorrow." not "A laboratory procedure has been scheduled".
3. **Say the date in words and in time.** "Thu, 1 Oct" plus "Tomorrow". Never a bare number of days alone.
4. **Explain a term the first time it shows on a screen.** "Tacro test: a blood test for your tacrolimus level." "USD (ultrasound)". Keep the unit's term so patient and staff use the same words.
5. **Never alarm.** State the fact, then the next step. No red-alert words (list in section 6).
6. **Never give medical advice.** Do not tell a patient what a result means for their body, what to take, when to take a dose, or what to eat. Do not predict. Do not reassure about health ("this is normal", "nothing to worry about").
7. **Always point to the care team.** Any screen that shows a result, a flag, a past-due item, or a past-deadline claim ends with a pointer: "Your care team can explain what this means for you." or "Please ask the KT unit what to do next."
8. **Name the team the same way every time:** "the KT unit" (spec 4 and 8 wording). First mention on sign-in expands it: "the kidney transplant (KT) unit". Use "your care team" only for medical questions ("Your care team can explain...").
9. **No contact channel we cannot back up.** The spec stores only one contact value: the emergency hotline text (`appSettings.emergencyHotlineText`). Do not write phone numbers, emails, office hours, or reply times. Patients cannot reply to messages (spec D6, one-way), so never say "reply to this message".
10. **Be kind, not cute.** No jokes, no emoji, no exclamation marks, no "Oops".
11. **English only in v1.** Keep sentences simple so a Filipino or Cebuano version is easy to add later. Not in spec scope.

Patient do and don't:

| Do | Don't |
|---|---|
| "Your blood test is due tomorrow, Thu 1 Oct." | "URGENT: Lab work required!" |
| "This result is above the lab's usual range. Your care team can explain what it means for you." | "Your creatinine is too high, which may mean your kidney is in trouble." |
| "The due date has passed. Please ask the KT unit to set a new date." | "You missed your test." |
| "We could not save your request. Check your internet, then try again." | "Request rejected. Error 400." |
| "In an emergency, call {hotlineText} or go to the nearest emergency room." | "Message us anytime, we reply within the hour." |

## 5. Shared formatting rules

| Item | Admin | Patient |
|---|---|---|
| Date | `01 Oct 2026` (fixed width, tabular numerals) | `Thu, 1 Oct 2026` or `Thu, 1 Oct` when the year is the current year |
| Relative date | `8 d overdue`, `5 d left`, `Today` | `Today`, `Tomorrow`, `In 5 days`, `Yesterday`, `8 days ago` |
| Time | `7:00 AM` (12 hour, Asia/Manila, spec 6.7) | same |
| Timezone | Never shown. All dates are Asia/Manila | Never shown |
| Person name, tables | `Villacorta, Analyn F.` | not used |
| Person name, greeting | not used | `Hi, Analyn` |
| Doctor | `Dr. Leonora Bautista-Galvez` | same |
| HRN | Uppercase as stored, tabular numerals: `HRN-2026-0147` | Shown on Profile as "HRN" with the value |
| Lab value | `96 umol/L` (unit exactly as stored in the lab catalog) | same |
| Range | `53 to 106` (word "to", never a dash) | "Usual range: 53 to 106 umol/L" |
| Empty cell | `Not set` | `Not set yet` |
| Counts | numerals always: `4 claims` | numerals always: `2 new messages` |
| Plurals | handle 1 vs many: `1 day`, `2 days` | same |
| Ellipsis | three periods `...` in loading text | same |

Never use a dash as an empty value or as a range separator. Hyphens inside words are fine ("Post-KT", "X-ray", "follow-up").

## 6. Word rules

### 6.1 Banned everywhere (grep gate)

The content-voice banned list, plus the long dash. Run this before every commit. It must return zero lines.

```bash
rg -n -i "unl[o]ck|elev[a]te|revolution[i]ze|seaml[e]ss|cutting-[e]dge|world-[c]lass|game-[c]hanger|empow[e]r|rob[u]st|lever[a]ge|innov[a]tive|next-[l]evel|stunn[i]ng|\x{2014}" <files>
```

The pattern covers every form of each word ("-ed", "-ing", "-s"). That means clinical phrases built on those stems are out too. Say "high" or "above range" for lab values.
The long dash is U+2014. Also avoid U+2013 (en dash) and U+2015. Use a comma, colon, period, or the word "to".

### 6.2 Patient portal: words to swap

| Avoid | Use instead | Why |
|---|---|---|
| rejected, invalid, denied, forbidden | "could not save", "not available for your account" | "Rejection" is a loaded word after a kidney transplant |
| failed, failure, error | "did not go through", "a problem" | "Failure" reads as graft failure |
| critical, danger, warning, alert, urgent | state the fact and the next step | alarm |
| abnormal | "above range", "below range" | alarm plus judgment |
| overdue, missed | "past due" | blame |
| deadline missed | "past deadline" | blame |
| superseded | "repeated" | jargon |
| submit | "send" | plain |
| terminate, expire | "ended", "sign in again" | plain |
| utilize | "use" | plain |
| "don't worry", "nothing to worry about", "this is normal" | say nothing, point to the care team | medical reassurance is advice |
| "journey", "exciting", "Welcome to KTP!" | plain greeting "Hi, {firstName}" | filler |
| "simply", "just", "easy", "quick" | cut the word | minimizes effort, may not be true |
| "Oops", "Whoops", "Uh oh" | cut | flippant |

### 6.3 Admin console: terms to keep exact

Superseded, Planned, Done, Filed, Overdue, DueSoon (display "Due soon"), Open, Post-KT, Post-donation, HRN, CDTE, HTEC, PhilHealth Z, CMV PCR, RT-PCR, Tacro, X-ray and USD. Do not rename them to sound friendlier. The admin matches them against the unit sheet.

## 7. Proof-point inventory

Only these facts may appear as claims in copy. Anything else is invented and banned.

| Fact | Where copy may use it | Source |
|---|---|---|
| Organization name: Organ Transplant Services | sign-in footer, logo alt | logo wordmark |
| Established 2017 | sign-in footer, logo alt | logo wordmark |
| Logo mark: 3 by 3 grid of organ icons (heart, lungs, liver, pancreas, kidneys) with a donor exchange icon in the center | logo alt text | `ots-mark.png`, ORCHESTRATOR palette table |
| Two patient types: Recipient and Donor. A donor links to one recipient | labels, profile header | spec 1, D15 |
| Recipient and donor stages | stepper, stage labels | spec D7 |
| Four tracked items: Meds claim, Laboratory, Tacro test, X-ray and USD | tracker, patient home | spec D8 |
| Lab and tacro schedule after transplant: weekly in month 1, every 2 weeks in month 2, monthly in months 3 to 12, every 1 to 3 months after year 1 | "Suggested next due" helper text | guide Part 4B, spec 6.1 |
| CMV PCR at 1 week and 1, 2, 3, 6 months. RT-PCR monthly in months 1 to 3 | tracker labels, tooltips | guide Part 4C, spec 6.2 |
| Claim "due soon" means the deadline is within 7 days | claim chips, dashboard | spec 6.5 |
| Reminders: 7 days before and on the due date; appointments 1 day before; claim deadlines 7 days before and on the day | patient helper text | spec 6.7 |
| Daily reminder run at 8:00 AM Asia/Manila | admin settings help only | spec A7 |
| Sign-in is Google only, with the Gmail the KT unit enrolled | sign-in helper | spec D5, A2 |
| A patient sees only their own records. A donor and a recipient cannot see each other's data | sign-in note, profile | spec 4 |
| Only the admin enters results. Patients cannot edit results | patient labs note | spec D2 |
| Messages are one way, from the KT unit, with an "I have read this" acknowledgment the admin can see | messages helper | spec D6, 7.1 |
| Privacy notice and consent on first sign-in, asked again when the notice version changes | sign-in note, consent screen | spec 4 |
| Data Privacy Act of 2012 (RA 10173) | sign-in note, consent screen title only | spec 4 |
| Repeated tests keep full history. The older result is left out of charts and flags | patient labs note | spec 6.4 |
| Corrections show a "Corrected on {date}" tag | patient labs | spec 6.4 |
| No flag is shown while a lab range is blank | lab flag "No range set" | spec A5 |

### 7.1 Never claim (no source exists)

- Success rates, survival rates, number of transplants, patient counts in marketing copy.
- Hospital name, address, room numbers, clinic hours, accreditation, awards, rankings.
- Phone numbers, emails, URLs. The only contact value is `{hotlineText}`, set by the admin.
- Response times ("we reply within...").
- Security or legal promises: "secure", "encrypted", "HIPAA", "fully compliant", "100% private", "guaranteed".
- Medical outcomes or interpretations of any result.

## 8. Placeholders

Curly braces mark runtime values. Builders replace them from data or settings. Never ship a raw placeholder: every one has a fallback.

| Placeholder | Source | Fallback when empty |
|---|---|---|
| `{hotlineText}` | `appSettings.emergencyHotlineText` | banner drops the "call" clause: "In an emergency, go to the nearest emergency room." |
| `{consentNoticeText}` | `appSettings.consentNoticeText` | block the portal and show "The privacy notice is not ready yet. Please ask the KT unit." |
| `{consentVersion}` | `appSettings.consentVersion` | hide the version line |
| `{firstName}`, `{fullName}`, `{hrn}` | `patients` | `{firstName}` falls back to "there" ("Hi there") |
| `{email}` | Google account on sign-in | "this Google account" |
| `{serviceLabel}` | `serviceRecords.label`, else the service type label | service type label |
| `{date}`, `{time}` | formatted per section 5 | never empty |
| `{n}` | computed counts and day spans | never empty |

## 9. Accessibility copy rules

1. Every icon-only button has an `aria-label` that starts with a verb: "Open patient Villacorta, Analyn F.".
2. Status chips: text is the accessible name. Icons inside chips are `aria-hidden="true"`.
3. Charts: `role="img"` plus an `aria-label` that states test, count, date span, latest value, and its flag. Offer a "Show as table" toggle.
4. Stepper: `aria-label="Stage progress"`, current step `aria-current="step"`, each step name read in full ("Phase 2 work-up"), not "P2".
5. Live regions: toasts use `role="status"`. Blocking errors use `role="alert"`.
6. Alt text: the wordmark carries its text. The mark is `alt=""` when the word "KTP" or the org name sits next to it.
7. Loading skeletons: one visually hidden "Loading..." per region with `aria-busy="true"` on the region.
8. Touch targets 44px minimum (ORCHESTRATOR rule 3). Button labels stay 3 words or fewer on the patient portal so they fit one line at 360px width.

## 10. Page meta (private, noindex)

The site is private health data. No SEO or marketing copy. No Open Graph or Twitter card text. No JSON-LD.

| Tag | Value |
|---|---|
| `<title>` default | `KTP Patient Tracker` |
| `<meta name="description">` | `Private pre and post kidney transplant tracker for enrolled patients and the KT unit.` |
| `<meta name="robots">` | `noindex, nofollow` |
| Manifest `name` / `short_name` | `KTP Patient Tracker` / `KTP` |
| Per-page title pattern | `{Page} \| KTP` (a pipe, never a dash). Examples in COPY.md |

## 11. Pre-commit checklist for any string

- [ ] Passes the grep gate in 6.1 (zero hits).
- [ ] Patient string: 20 words or fewer per sentence, no word from 6.2 "Avoid".
- [ ] Any result, flag, past-due, or past-deadline string ends with a care team pointer.
- [ ] No number, name, URL, or claim outside the section 7 inventory.
- [ ] Every placeholder has a fallback.
- [ ] Status shown as text, not color only.
