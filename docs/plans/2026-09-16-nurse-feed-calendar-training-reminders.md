# Nurse portal: supervisor feed, training calendar, and email reminders

Date: 2026-09-16
Repository: `D:/al projects/sktiNODandNAtracker`
Inspected baseline: `2324d38`
Implementation owner: Antigravity

## 1. Outcome

After sign-in, a nurse sees private messages from the supervisor and a calendar of their own training assignments.
The calendar includes upcoming and past training.
Assigned training produces email reminders 14 days, 7 days, and 1 day before its start date.
The implementation also includes gaps G1 through G7: immediate notices, acknowledgment, conflicts, supervisor tracking, completion review, delivery recovery, and late assignments.
Section 13 defines these requirements and their implementation order.

This is an implementation plan, not a completed feature.
Check the current source and active writers before implementation.
Preserve the existing profile, sign-in, supervisor dashboard, and recent reliability fixes.
Use isolated writing worktrees when repository instructions require parallel agents.
Deployment and production email dispatch require separate release authorization.

## 2. Product decisions

- **D1:** `/me` becomes the nurse's default Feed page after successful sign-in and required onboarding.
- **D2:** The nurse portal has Feed, Training Calendar, and My Profile navigation.
- **D3:** Messages are private to the supervisor and the selected recipients.
- **D4:** Supervisors can send one message to one nurse or a selected list of nurses.
- **D5:** Nurses can read messages and explicitly acknowledge the current revision. General chat replies and message attachments remain outside scope.
- **D6:** The calendar is read-only for supervisor-assigned dates and attendance status.
- **D7:** Email reminders use the nurse's current saved sign-in email and Asia/Manila calendar dates.
- **D8:** Reminders run daily at the intended 08:00 Manila schedule through the existing protected reminder job.
- **D9:** The new training reminders replace the existing 48-hour seminar reminder for covered assignments.
- **D10:** Assignment, reschedule, and cancellation notices appear immediately in the portal and enter a durable email queue.
- **D11:** Nurses can confirm attendance or report inability to attend. Supervisors control assignment dates and final attendance outcomes.
- **D12:** Supervisors can track responses, completion verification, and delivery failures without treating these as equivalent states.

D3 through D6 are proposed defaults for the requested first release.
Keep existing nurse profile and certificate submission controls available.
Include immediate training notices as specified in section 13.
General supervisor message emails remain outside scope.
Show an assignment immediately in the portal even when its first reminder is not yet due.

## 3. Current system and reuse

`client/src/App.tsx` currently sends signed-in staff to `/me`.
`client/src/pages/MyProfilePage.tsx` currently provides the staff portal experience.
`server/routers/staffAccount.ts` already scopes self-service requests to `ctx.nurseId`.
The existing `staffProcedure` supports Google and first-visit claim sessions.
Preserve the existing onboarding and session restrictions when adding portal routes.

Training assignments already exist in `nurseTrainings`.
They can reference `trainingEvents` through `eventId` or use an individual `scheduledDate`.
The existing status values include Scheduled, Completed, Expired, and Cancelled.
Reuse these records rather than building a second assignment system.

`server/scheduled.ts` already runs a shared daily reminder job with a database lock.
`server/email/dispatcher.ts` currently includes license and seminar passes.
Reuse the email service, result counters, delivery history, and cron authorization.
Inspect the current lock and delivery behavior before extending them.
Do not assume a test count proves duplicate prevention or live delivery.

## 4. Nurse experience

### Feed

Add a staff layout with a compact header, unread message count, and mobile-friendly navigation.
Show supervisor messages newest first, with title, body, sender, and Manila timestamp.
Show an Edited label after a published message changes.
Show unread messages distinctly without relying on color alone.
Mark a message read when the nurse explicitly opens it, not when a background query fetches it.
Add a clear empty state, loading state, error state, and retry action.
Use cursor pagination so a long message history does not block the page.

Add an Upcoming Training panel using the same assignment data as the calendar.
Show training name, start date, time if known, venue if known, and current status.
Link each item to its calendar detail.
Keep a missing time visible as `Time not specified` instead of inventing a time.

### Training Calendar

Add `/me/calendar` with month navigation and an agenda view.
Use the agenda as the primary small-screen view.
Provide Upcoming and Past filters plus a Today action.
Keep training dates distinct from certificate expiry dates.
Do not display every hospital seminar unless this nurse has an assignment to it.

Selecting an event opens its details: title, date range, time, venue, provider, status, and supervisor instructions.
Show past Scheduled records as `Past date, completion not recorded`.
Never mark training Completed solely because its date has passed.
Show Cancelled entries with an explicit label and no reminder promise.
Keep undated historical records in a separate history list rather than assigning a fake date.

### Profile and deep links

Move the existing profile view to `/me/profile` through a shared staff layout.
Keep `/me` as the feed and preserve onboarding before rendering private portal content.
Retain existing profile actions and certificate uploads.
Support `/me/calendar?training=<assignmentId>` for email links.
After sign-in, restore only an allowlisted internal staff return path.
Reject external redirect targets and access to another nurse's assignment.
Show a neutral unavailable message for removed or unauthorized records.

## 5. Supervisor experience

Add a Messages section in the supervisor interface.
Provide recipient selection, a title, a plain-text body, a preview, and Send.
Display recipient names and count before submission.
Require at least one eligible recipient and reject duplicate IDs.
Set explicit limits, such as a 160-character title and a 5,000-character body.
Use normal text rendering and safe links, not unsanitized HTML.
Allow the supervisor to view sent messages, edit their content, and archive a message.
Archive hides the message from active nurse feeds while preserving its audit record.
Keep the original recipient list fixed after publication for this release.
An edit must not erase read history or imply that the edited text was read.
Store the last read message revision to distinguish unread edits.

Add a Messages tab or action on the supervisor's nurse profile for direct messaging.
Keep training assignment in the existing Trainings and Seminar attendance flows.
Show the effective start date and planned reminder dates when a supervisor assigns training.
Show a warning when the nurse has no valid saved email or the training has no date.
Save the assignment even when email delivery is unavailable.
Display delivery eligibility separately from assignment success.

## 6. Data model

Add these tables using the repository's next available additive migration.
Confirm the migration number at implementation time.

### `staffMessages`

Store `id`, `senderUserId`, `title`, `body`, `revision`, `createdAt`, `updatedAt`, and `archivedAt`.
Use server timestamps and server-derived sender identity.
Increment the revision when content changes.

### `staffMessageRecipients`

Store `messageId`, `nurseId`, `readAt`, and `lastReadRevision`.
Store revision-specific acknowledgment records with the server timestamp and nurse identity.
An acknowledgment is an explicit action, separate from reading the message.
Enforce uniqueness on `(messageId, nurseId)`.
Index recipient queries for the nurse feed and unread count.
Create the message and all recipient rows in one transaction.
Add submission idempotency so a retried Send request does not publish duplicate messages.
Define sender deletion and nurse archive behavior without deleting audit history accidentally.

### Training reminder state

Reuse `nurseTrainings.id` as the assignment identity.
Add schedule version metadata if the existing schema cannot distinguish reschedules and reinstated assignments.
Store durable reminder jobs with assignment ID, schedule version, threshold days, due date, state, attempt count, and timestamps.
Record provider acceptance, safe failure detail, retry time, and delivery recipient separately from assignment success.
Enforce uniqueness on `(assignmentId, scheduleVersion, thresholdDays)`.
For immediate notices, enforce uniqueness on assignment, notice kind, and event version.
Use the shared durable outbox described in section 13 for immediate notices and reminder dispatch.
Use states such as pending, claimed, sent, failed, skipped, and superseded with a recoverable claim expiry.
Extend existing email history types for training reminders without reclassifying license emails.
Retain mock, failed, and provider-accepted outcomes separately.

## 7. API contracts and authorization

Add `server/routers/staffFeed.ts` with supervisor procedures for create, listSent, update, and archive.
Add staff procedures for listMine, unreadCount, and markRead.
Add `acknowledge` with an expected message revision and recipient ownership validation.
Require `adminProcedure` for supervisor operations.
Require `staffProcedure` for nurse operations and derive the recipient from `ctx.nurseId`.
Never accept a nurse ID from the staff browser to decide whose feed to return.
Verify recipient ownership again when marking a message read.

Add `staffAccount.myTrainingCalendar` with a bounded date range and optional status filter.
Add `staffAccount.myTrainingDetail` with an assignment ID and server-side ownership check.
Add scoped response and evidence procedures as specified in section 13.
Return only fields needed for the nurse calendar.
Do not return other attendees, other nurses' emails, or supervisor-only notes.
Add an explicit staff-visible instructions field if current remarks mix private and public content.

Use the same date-resolution helper for the feed, calendar, supervisor preview, and reminder worker.
For event-linked assignments, use the event's current start date, end date, time, and venue.
For standalone assignments, use their scheduled date and available metadata.
For completed standalone history without a scheduled date, use the completion date with a clear label.
Do not silently fall back to unrelated event dates.

Clear staff-specific query caches on sign-out and account switching.
Keep private data out of persistent shared browser caches.
Preserve claim-session restrictions and old-email revocation from the accepted sign-in design.

## 8. Reminder rules

### Normal schedule

For each supervisor-assigned Scheduled record with an effective future start date, create three reminder milestones.
Calculate due dates as the Manila start date minus 14, 7, and 1 calendar days.
These are calendar-day reminders, not exact 336-hour, 168-hour, and 24-hour offsets from a start time.
Multi-day training uses its first date for reminders.
Display the full date range in the message.

Use the nurse's current saved email when the worker claims the job.
Revalidate assignment status, schedule version, recipient eligibility, and address before dispatch.
Require a valid saved email, but do not require the nurse to have completed a first Google login.
Skip archived or inactive staff according to existing staff eligibility rules.
Expose skipped reasons to the supervisor without marking them as successful deliveries.

### Late assignments and downtime

Send only the milestones that remain after an assignment is created.
An assignment created ten days before training receives the 7-day and 1-day reminders.
It also receives an immediate assignment notice.
Do not send a retroactive 14-day email for that new assignment.
If assignment occurs on a due date, combine its assignment notice and due reminder as specified in G7.
Do not send an overdue reminder after training starts.

For an existing queued job missed during downtime, send at most the most recent applicable overdue milestone per assignment.
Mark older overdue milestones superseded so the nurse does not receive a burst of old messages.
Label late reminders truthfully with the current start date and remaining days.
Do not label a late email `14 days before` when fewer days remain.
Run assignment-time enqueue processing through the same protected durable path, not an unawaited request callback.

### Changes and cancellations

Rescheduling supersedes unsent jobs for the old version and creates future milestones for the new version.
Update the calendar immediately from the canonical event or assignment date.
Completion, cancellation, removal, or reassignment invalidates pending jobs before they can send.
An already accepted email cannot be recalled.
Keep that fact visible in supervisor delivery history.
Send immediate cancellation and reschedule notices through the versioned outbox defined in G1.

Cover both standalone training assignments and seminar attendee assignments.
Do not create reminders for a nurse's self-submitted historical completion record.
Avoid duplicate assignments to the same occurrence where the existing data contract treats them as one attendance record.
Retire the old 48-hour seminar pass for this covered population so both systems do not send overlapping reminders.
Leave license-renewal reminders unchanged.

### Email contents

Include the nurse's name, training title, date range, time or missing-time label, venue, and staff-visible instructions.
Include one authenticated link to the nurse's training detail.
Use one recipient per email, with no shared recipient list.
Use an approved sender and production application URL.
Escape user-entered content in HTML templates.
Treat provider acceptance as sent, not proof of inbox delivery.

## 9. Worker integration and reliability

Extend the existing reminder infrastructure with one shared outbox worker.
The daily job creates due milestone jobs, while immediate changes enqueue notices in their mutation transaction.
Use an awaited bounded dispatch attempt plus a protected frequent queue drain for recovery, as specified in section 13.
Use atomic job claims and a recoverable lease to protect against concurrent manual and scheduled runs.
Use stable provider idempotency keys where the provider supports them.
Keep the same key when retrying an uncertain delivery outcome.
Do not claim exactly-once email from a database read followed by a network request.
Bound retries, retry delays, provider request duration, and per-run work.
Do not let mock delivery suppress a later real email.
Missing production credentials must produce a visible failure state.

The inspected Vercel API function has a 15-second budget.
Measure representative recipient volume before release.
Use supported function limits and durable batches if the work cannot fit.
Persist unfinished work and expose its backlog instead of silently dropping recipients.
Record processed, accepted, failed, skipped, superseded, and pending totals.
Report a failed or incomplete job honestly.

## 10. File map and build phases

### Phase 1: Schema and domain behavior

Update `drizzle/schema.ts`, the next migration, and `server/db.ts`.
Add focused helpers such as `server/staffFeed.ts` and `server/trainingReminders.ts`.
Implement message ownership, canonical training dates, schedule versions, and durable jobs.
Keep PostgreSQL and the existing local test adapter aligned where supported.
Do not use SQLite tests as proof of PostgreSQL concurrency behavior.

### Phase 2: Supervisor messages

Add `server/routers/staffFeed.ts` and register it in `server/routers.ts`.
Add `client/src/pages/StaffMessages.tsx` and its route in `client/src/App.tsx`.
Add supervisor navigation in `client/src/components/DashboardLayout.tsx`.
Add the direct-message entry point in `client/src/pages/NurseProfile.tsx`.

### Phase 3: Nurse portal

Add `client/src/components/StaffLayout.tsx`.
Add `client/src/pages/StaffFeed.tsx` and `client/src/pages/StaffTrainingCalendar.tsx`.
Integrate the existing `MyProfilePage.tsx` under `/me/profile`.
Extend `server/routers/staffAccount.ts` with scoped calendar reads.
Implement loading, empty, error, unread, and retry states on desktop and mobile.

### Phase 4: Assignments and email

Update supervisor assignment mutations in `server/routers/trainings.ts` and `server/routers/seminars.ts`.
Cover create, update, cancellation, removal, and event rescheduling.
Add training reminder templates in `server/email/templates.ts`.
Extend `server/email/service.ts`, `server/email/dispatcher.ts`, and `server/scheduled.ts`.
Update supervisor email status displays with the new job outcomes.
Generate `api/index.js` only through `pnpm run build:vercel-api`.

### Phase 5: Acceptance and release preparation

Run focused regressions, a disposable PostgreSQL concurrency suite, and the existing checks.
Use the real nurse and supervisor browser paths with controlled accounts.
Prepare migration order, production configuration, rollback, and a delivery evidence report.

## 11. Acceptance tests

- **T1:** Nurse A sees a supervisor message addressed to A. Nurse B cannot read it through UI or direct API.
- **T2:** A group message appears once for each selected recipient and never leaks the recipient list.
- **T3:** Read state is per nurse and revision. Editing content does not claim that the new text was read.
- **T4:** Retrying Send cannot publish the same submission twice.
- **T5:** Staff cannot publish supervisor messages or change their own assigned training dates through the new APIs.
- **T6:** Feed is the signed-in landing page after required onboarding. Profile actions still work.
- **T7:** The calendar shows only the signed-in nurse's upcoming, past, completed, and cancelled assignments.
- **T8:** A past Scheduled record remains unconfirmed, not automatically Completed.
- **T9:** Event-linked and standalone assignments resolve dates consistently in UI and email.
- **T10:** A clock-controlled test sends once at 14, 7, and 1 day before, with no send on adjacent normal days.
- **T11:** Repeated and concurrent job invocations do not duplicate provider requests for the same milestone.
- **T12:** A ten-day late assignment receives one immediate notice and only the remaining milestones.
- **T13:** Downtime recovery sends at most one overdue milestone and never sends after training starts.
- **T14:** Reschedule, cancellation, completion, removal, and reassignment invalidate stale pending jobs.
- **T15:** Missing email, archived staff, provider failure, timeout, and mock mode have accurate outcomes.
- **T16:** A saved email can receive reminders before first Google login. A replaced email is not used for new sends.
- **T17:** A nurse email link returns to the correct assigned training after sign-in and rejects an external redirect.
- **T18:** The old 48-hour seminar pass does not add extra reminders. Immediate notices and license emails remain functional.
- **T19:** Mobile calendar, keyboard message navigation, focus behavior, and inline errors work in a browser.
- **T20:** A bounded worker run retains remaining work and reports it when the function budget is reached.

Run date tests with an injected clock and explicit Asia/Manila dates.
Use synthetic recipients and a mocked provider for automated checks.
Confirm that meaningful regressions fail against the old code or a safe temporary mutation.
Never send staff email or alter production training records to prove a negative test.

## 12. Rollout and rollback

Apply additive migrations before enabling new routes and workers.
Backfill only eligible future assignments and future milestones at activation.
Do not send historical reminders in bulk.
Do not fabricate old supervisor messages.
Enable the portal first, then the reminder worker after configuration and controlled-recipient checks.
Record the activation date, baseline assignment count, and due-job count.

For rollback, disable new reminder dispatch first and preserve its job and delivery history.
Return `/me` to the existing profile route if the portal must be withdrawn.
Keep message records and read state intact for a later corrected release.
Do not restore the 48-hour sender while the new sender remains active.
Do not drop additive tables or erase sent records during application rollback.

Final report must include changed files, exact source state, migration evidence, test totals, browser proof, and unresolved checks.
Verify an authorized test email and a scheduled invocation before calling automation live.

## 13. Gap implementation requirements: G1 through G7

These requirements are part of the main implementation, not optional follow-up work.
All proposed timing targets below are acceptance targets, not measured production results.

### G1. Immediate assignment, reschedule, and cancellation notices

Create an in-app training activity entry and an outbox event in the same transaction as the supervisor's change.
Persist the assignment even if the email provider is unavailable.
The supervisor must see `Saved, email pending` rather than an inaccurate delivery confirmation.
Use separate notice kinds for assignment, reschedule, and cancellation.
Store the event version, actor, timestamp, and a minimal before/after snapshot needed to explain the change.
Do not include supervisor-only notes in the snapshot sent to staff.

For rescheduling, show the previous and new date, time, and venue where changed.
For cancellation, identify the affected occurrence and clearly state that attendance is no longer required.
Supersede stale unsent assignment and reschedule notices when a newer change makes them incorrect.
If a provider already accepted an earlier notice, preserve its record and send the correction.
Coalesce rapid unsent edits into the latest accurate notice without removing the underlying audit events.

Return assignment success after the transaction commits.
Attempt a bounded, awaited dispatch through the shared worker while request budget remains.
Never use an unawaited promise or browser timer as the delivery guarantee.
Recover pending jobs through a protected queue drain with a target interval of five minutes or less.
Check actual hosting support before selecting the queue drain mechanism.
If current hosting cannot meet that interval, identify the required infrastructure before release.
Do not quietly treat the next daily run as an immediate notice.

Acceptance target: the portal shows the committed change on its next refresh, with focus refresh and bounded polling while open.
Acceptance target: attempt immediate email dispatch within one minute under healthy service conditions.
Retries must not block the supervisor's next action.
Do not promise inbox arrival within that time.

Cancellation must preserve enough data for the recipient to understand which training was cancelled.
Replace destructive removal of a future assigned occurrence with an audited cancellation flow where necessary.
Keep historical administrative deletion separate from routine cancellation.

### G2. Explicit message acknowledgment and attendance response

Add an `Acknowledge` action to each supervisor message.
Record acknowledgment against the exact message revision using server identity and time.
Submitting an old revision returns a conflict and asks the nurse to read the updated message.
Show Read and Acknowledged separately in the supervisor view.
Content edits require acknowledgment of the new revision while retaining earlier acknowledgment history.

Add `Confirm attendance` and `Cannot attend` actions to active training details.
Store response states Pending, Confirmed, and Cannot attend separately from training status.
Require a reason between 1 and 1,000 characters for Cannot attend.
Limit the reason to the nurse and authorized supervisors.
A Cannot attend response creates an in-app supervisor follow-up item.
It does not cancel the assignment or remove the nurse automatically.
Allow response changes before the start, with an audit record.
After the start, require supervisor correction rather than rewriting the nurse's earlier response.

Bind confirmation to the current schedule version.
A change to the date, time, or venue resets the response to Pending for the new version.
Keep the old response in history and explain why confirmation is requested again.
Confirmed attendance does not stop the 14-day, 7-day, or 1-day reminders.
A Cannot attend response suspends routine milestones until a supervisor resolves the response.
Show the resulting pending follow-up clearly so silence is not mistaken for resolution.

### G3. Conflict warnings and resolution

Check a nurse's active assigned training intervals before saving a new or changed assignment.
Use the same Manila date and time resolver as the calendar and email worker.
Treat exact adjacency as nonoverlapping when both end and start times are known.
For missing times or date-only records, warn about a possible same-day overlap rather than claiming a confirmed conflict.
For multi-day training, compare the full occurrence range.
Do not infer work-shift conflicts because no verified shift schedule is part of this plan.

Show the conflicting training titles and dates to the supervisor.
Allow an explicit override with a required reason, because some schedule overlaps can be intentional.
Recheck conflicts inside the save transaction or use equivalent concurrency control.
Do not rely only on a client-side preview.
Store the override actor and reason for audit.
Show the nurse their own conflict warning and the Cannot attend action.
Do not expose another nurse's timetable.

The supervisor can resolve inability to attend by cancelling, rescheduling, reassigning, or retaining the assignment with a recorded response.
Retaining an assignment does not fabricate nurse confirmation.
Notify the nurse in-app of the resolution and request a new response when necessary.
Use the G1 notice path when the resolution changes the schedule or cancels the assignment.

### G4. Supervisor follow-up and progress view

Add a Training Follow-up view to existing Trainings or Seminar details, not a separate analytics system.
Show each assigned nurse's response, attendance outcome, evidence review, next reminder, and latest email outcome.
Provide filters for Pending response, Cannot attend, Missing email, Delivery failed, Completion awaiting review, and Missed.
Show message acknowledgment totals in the Messages view using the same recipient records as the feed.
Counts must use the same server predicates as their filtered lists.
Include cancelled assignments explicitly in history and exclude them from active follow-up totals.

Do not combine these states into one ambiguous `Done` status.
Provider acceptance does not imply message read, attendance confirmation, or training completion.
Provide direct actions to open the nurse, review evidence, resolve a conflict, and retry an eligible failed notice.
Require supervisor permissions for all aggregate queries and actions.
Use pagination, bounded filters, and indexed queries for larger rosters.

### G5. Attendance, evidence, and completion verification

Separate attendance outcome from certificate validity and training status.
Add attendance outcomes Not recorded, Attended, Missed, and Excused.
Only the supervisor can set or correct an attendance outcome.
Record actor, time, and correction reason.
Do not automatically mark a nurse Missed when a date passes.
Use `Past date, attendance not recorded` until a supervisor records the outcome.

Allow the nurse to upload a certificate or submit completion evidence for their own assignment.
Reuse current upload validation and private storage authorization.
Do not overwrite another nurse's document or permit arbitrary storage-key access.
Store evidence states None, Submitted, Verified, and Rejected, with submission and review history.
Require a reason for rejection and allow a new evidence revision.
Only a supervisor can verify evidence.
Never infer verification from the existence of an uploaded file.

Default workflow: the supervisor records attendance and approves the completion record.
If evidence is required for that assignment, approval also requires verified evidence.
If evidence is not required, the supervisor can approve attendance-based completion with an audit note.
Snapshot the evidence requirement on assignment so later catalog edits do not rewrite old obligations.
Completion approval sets the existing training status to Completed with its completion date.
Existing Expired behavior remains a validity outcome, not an attendance result.
Missed and Excused records must not count as completed compliance.
Update compliance and dashboard calculations only from the approved completion source.

Audit existing self-service `addTrainingRecord`, certificate upload, and supervisor attendance mutations for bypasses.
New nurse submissions must not directly grant verified completion for supervisor-assigned training.
Preserve legacy completed records during migration and label their verification provenance as Legacy where unknown.
Do not reset historical compliance or invent a reviewer for old records.
The current seminar attendance mutation defaults to Completed.
Split future assignment creation from historical attendance entry, or require an explicit operation intent with safe defaults.
A new future assignment must default to Scheduled and Pending response.

### G6. Delivery recovery and in-app reminders

Every scheduled milestone also creates one in-app reminder for the nurse, independent of email success.
Use a durable event identity so retries cannot duplicate the in-app item.
Generate milestone items using the same eligibility and schedule version checks as email.
Do not place an unavailable email address in a fake Sent state.

Display Missing email, Queued, Attempting, Provider accepted, Failed, Bounced, and Superseded only when supported by evidence.
Show Delivered only if an authenticated provider event confirms it.
Provider acceptance remains distinct from inbox delivery and reading.
Store the attempt recipient and current address separately so corrections do not rewrite history.
Use the existing authorized email-edit flow instead of creating another path that bypasses Google account linking.

Provide a supervisor `Retry failed delivery` action for eligible, current notices.
Keep the same idempotency key for an uncertain attempt to the same address.
After an address correction, create an audited new delivery attempt tied to the same logical event and current address.
Do not resend a successful unchanged milestone just because Retry was clicked again.
Prevent retry of stale reminders after cancellation, supersession, or training start.
Cancellation notices can remain eligible after the original start if they still describe the latest event accurately.

Use bounded retries for transient network errors and provider throttling.
Stop repeated retries for a known invalid address and expose a supervisor action.
Where provider callbacks are enabled, verify signatures and deduplicate events before updating delivery status.
If callbacks are unavailable, show that delivery confirmation is unavailable rather than assuming success.
Keep private provider payloads out of nurse-visible errors.
Show failed and pending totals in the supervisor follow-up view.

### G7. Today, tomorrow, and same-day milestone handling

An assignment for tomorrow or later today gets an immediate assignment notice.
Show the exact training date and time, with a `Today` or `Tomorrow` label when applicable.
For today's event with no specified time, send the assignment notice but do not invent remaining hours.
Do not queue historical 14-day or 7-day messages.

When assignment and a scheduled milestone become due together, send one combined notice for that assignment version.
It must contain the assignment information and the current reminder information.
Mark the milestone as fulfilled by that combined notice only when the provider accepts it.
Preserve the in-app event link to both purposes so audit counts remain accurate.
If the combined notice fails, retry it rather than creating two separate competing jobs.
An immediate notice sent on a different day does not suppress a later 14-day, 7-day, or 1-day reminder.

A reschedule into today or tomorrow uses the same immediate dispatch and coalescing rules.
If the training has already started, require the supervisor to choose late attendance entry or an explicit late assignment.
Do not create pre-training milestones for an already-started event.
Avoid sending a misleading `upcoming training` notice for a historical completion entry.

## 14. Gap data, API, and file changes

Extend the section 6 schema with these records or equivalent normalized structures:

- **S1:** `staffMessageAcknowledgments` with message, recipient, revision, timestamp, and a unique revision acknowledgment key.
- **S2:** Assignment response fields plus an append-only response history keyed by assignment and schedule version.
- **S3:** Attendance outcome, evidence requirement snapshot, evidence revisions, supervisor review, and legacy provenance.
- **S4:** A shared notification outbox with event kind, version, recipient, claim lease, next attempt, and provider identifiers.
- **S5:** Training activity records for in-app notices, milestone identity, and per-recipient read state.
- **S6:** Conflict overrides and supervisor response resolutions with actor, reason, and timestamp.

Preserve unique milestone jobs from section 6 and link their delivery to the shared outbox.
Do not create independent workers that can send the same milestone through separate paths.
Use schema constraints and transactions for uniqueness, recipient ownership, and valid state transitions.
Use an expected version on response, acknowledgment, review, and schedule mutations to reject stale updates.

Add these server operations:

- `staffFeed.acknowledge({ messageId, revision })`.
- `staffAccount.respondToTraining({ assignmentId, scheduleVersion, response, reason? })`.
- `staffAccount.submitTrainingEvidence({ assignmentId, expectedVersion, ...validatedEvidence })`.
- Supervisor `trainings.previewConflicts`, `trainings.resolveResponse`, `trainings.recordAttendance`, and `trainings.reviewEvidence`.
- Supervisor `trainings.followUp` with bounded filters and pagination.
- Supervisor `settings.retryTrainingDelivery` with event ownership, freshness, and duplicate checks.

Derive nurse and supervisor identities from server authentication for every action.
Keep staff responses separate from permission to modify assignment dates or verified completion.

Update the files listed in section 10, plus:

- `client/src/pages/Trainings.tsx` and existing Seminar detail components for follow-up and assignment actions.
- `client/src/pages/MyProfilePage.tsx` for evidence submission without self-verification.
- `client/src/pages/Settings.tsx` for delivery recovery and correct status labels.
- `server/routers/staffAccount.ts` for response and evidence permissions.
- `server/routers/trainings.ts` and `server/routers/seminars.ts` for transition guards and default operation intent.
- `server/trainingReminders.ts` and shared outbox helpers for immediate notices, milestone coalescing, and retries.
- `server/vercel.ts` and deployment configuration for the protected queue drain, if required by the chosen hosting path.

Inspect the actual Seminar detail filename before editing rather than creating a duplicate screen.

## 15. Integrated implementation order and acceptance

Extend the phases in section 10 in this order:

1. Define assignment, response, attendance, evidence, and delivery state transitions and additive migrations.
2. Implement transactional notices, durable outbox jobs, revision guards, and duplicate protection.
3. Implement supervisor assignment intent, conflict preview, overrides, and resolution actions.
4. Implement nurse acknowledgment, attendance response, and evidence submission.
5. Implement supervisor evidence review and follow-up filters with matching counts.
6. Implement immediate dispatch, recovery drain, scheduled reminders, and same-day coalescing.
7. Verify current and legacy flows, migrate disposable data, and run full browser acceptance.

Add these tests to section 11:

- **T21:** Assignment, reschedule, and cancellation each create one transactional in-app event and one logical email notice.
- **T22:** Provider outage leaves the assignment saved and its notice pending or failed, with no false Sent result.
- **T23:** Message read does not acknowledge it. Old-revision acknowledgment conflicts after an edit.
- **T24:** Nurse A cannot acknowledge, respond, or submit evidence for Nurse B through any API.
- **T25:** Confirmation records the schedule version. A material schedule change requires a new response.
- **T26:** Cannot attend creates supervisor follow-up, suspends routine milestones, and does not cancel the assignment automatically.
- **T27:** Exact overlaps warn, adjacent timed events do not, and missing times produce a possible-conflict warning.
- **T28:** Concurrent conflicting assignment saves recheck conflicts and require a recorded override where applicable.
- **T29:** Supervisor follow-up totals equal the corresponding filtered records, including unresolved delivery and response states.
- **T30:** Nurse evidence submission cannot mark training verified or grant approved completion.
- **T31:** Supervisor rejection requires a reason. Resubmission preserves previous evidence and review history.
- **T32:** Missed and Excused do not count toward compliance. A date passing never auto-records attendance.
- **T33:** Legacy completed records keep their existing completion value and display unknown review provenance honestly.
- **T34:** Future seminar assignments start Scheduled, while explicit historical attendance entry preserves its existing purpose.
- **T35:** Missing email leaves the portal notice visible. Address correction can safely retry an eligible notice.
- **T36:** Duplicate retry or provider callback does not duplicate delivery or overwrite a newer state incorrectly.
- **T37:** Today and tomorrow assignments attempt immediate delivery without waiting for the daily schedule.
- **T38:** A due-day assignment sends one combined notice. Acceptance fulfills its milestone, and failure leaves it retryable.
- **T39:** A next-day scheduled reminder is not suppressed by yesterday's immediate assignment notice.
- **T40:** Cancellation wins over stale queued reminders and preserves an understandable cancellation detail for the nurse.
- **T41:** Healthy-service immediate dispatch and queue recovery meet the measured targets under representative workload.
- **T42:** Stale version mutations reject safely without overwriting another supervisor's changes.

Use an injected clock, fake provider, disposable PostgreSQL, and controlled browser accounts for these checks.
Run existing typecheck, test, application build, and Vercel bundle commands after the integrated changes.
Record failed-before and passed-after evidence for meaningful regressions.
Do not count skipped race, provider, or browser checks as passed.

## 16. Gap rollout and rollback additions

Do not send immediate assignment notices for migration backfill unless a supervisor explicitly initiates them later.
Backfill legacy response as Pending or Unknown according to available evidence, never Confirmed by assumption.
Preserve historical completion and certificate data before enforcing new review gates on new submissions.
Enable portal response and review controls before activating their automatic notices.
Validate queue drain support and a controlled recipient before enabling immediate delivery.
Keep general message acknowledgment available even if email dispatch is temporarily disabled.

For rollback, disable new outbox dispatch before reverting affected mutations or UI.
Preserve outbox attempts, message acknowledgments, evidence revisions, and attendance audit history.
Do not revert to a path that lets staff self-verify supervisor-assigned completion.
Do not replay every pending job blindly after recovery.
Revalidate current recipient, event version, assignment status, and due date first.

The final implementation report must mark G1 through G7 individually and include their browser and server evidence.
