# Staff Portal Failure Investigation Report

This document records the investigation and resolution of the staff portal failures.
The investigation follows phases F1 through F5.

## F1: Capture Actual Failure

The production staff portal failed on three primary views.
These views are Profile, Calendar, and Feed.
We reproduced each failure by querying the production API endpoints with an active staff session.

The endpoints returned internal server errors.
The endpoint `staffAccount.myProfile` failed with PostgreSQL error code 42703.
The database reported that column `scheduleVersion` does not exist in table `nursetrack.nurseTrainings`.
The endpoint `staffAccount.myTrainingCalendar` failed with the same column error.
The endpoint `staffFeed.myFeed` failed with PostgreSQL error code 42P01.
The database reported that relation `nursetrack.staffMessageRecipients` does not exist.
The endpoint `staffFeed.unreadCount` and endpoint `staffFeed.myActivity` failed with the same relation error.

## F2: Check Shared Backend

We inspected the production database connection and schema.
The application connects to Supabase pooler on host `aws-0-ap-southeast-2.pooler.supabase.com`.
The active application schema is `nursetrack`.
Connection limits and session lookups were normal.

We compared the database tables against the migration files.
Commit `a333ef2` introduced migration `drizzle/0006_nurse_feed_calendar_reminders.sql`.
The migration defines five new tables and seventeen new columns.
The database had not received migration 0006.
The five missing tables were `staffMessages`, `staffMessageRecipients`, `staffMessageAcknowledgments`, `trainingOutbox`, and `trainingActivity`.
The seventeen missing columns belonged to table `nursetrack.nurseTrainings`.
These missing columns included `scheduleVersion`, `staffResponse`, and `attendanceOutcome`.

## F3: Fix Confirmed Cause Only

We preserved all existing records before schema changes.
We exported all 819 rows of table `nursetrack.nurseTrainings` into a timestamped backup file.
The backup file contains 480128 bytes.
No unrelated code changes occurred.

We applied migration 0006 directly to schema `nursetrack`.
The migration created the five required tables.
The migration added the seventeen required columns to table `nursetrack.nurseTrainings`.
We verified that all 819 pre-existing training records remained intact after migration.
We verified that all new columns default cleanly without data corruption.

## F4: Prove All Staff Flows

We tested the authenticated staff flows against the updated database.
We used a claim session for nurse ID 334.
The PRC license identifier authenticated and issued a valid session cookie.

We verified the five required flow criteria:

1. Profile loads the correct staff record.
Query `staffAccount.myProfile` returned nurse ID 334 with name Christie Manguray.
2. Calendar shows actual assignments.
Query `staffAccount.myTrainingCalendar` returned 6 scheduled training assignments.
3. Feed loads messages and activity.
We inserted a test message for nurse 334 from supervisor account ID 1.
Query `staffFeed.myFeed` returned the message.
Query `staffFeed.unreadCount` returned count 1.
4. Cross-staff isolation remains secure.
We authenticated nurse ID 335.
Query `staffFeed.myFeed` for nurse 335 returned count 0.
Nurse 335 could not view messages addressed to nurse 334.
5. Other staff records remain inaccessible.
Requests without valid credentials return authorization rejections.
After verification, we removed the temporary test message.

## F5: Deploy, Verify, Measure

The production deployment at `https://nodandnatracker.vercel.app` now serves all endpoints successfully.
All endpoints respond with HTTP 200.
We measured live response timings across five endpoints:

- Endpoint `staffAccount.startClaim` returned HTTP 200 in 282 milliseconds.
- Endpoint `staffAccount.myProfile` returned HTTP 200 in 295 milliseconds.
- Endpoint `staffAccount.myTrainingCalendar` returned HTTP 200 in 310 milliseconds.
- Endpoint `staffFeed.myFeed` returned HTTP 200 in 284 milliseconds.
- Endpoint `staffFeed.unreadCount` returned HTTP 200 in 278 milliseconds.
- Endpoint `staffFeed.myActivity` returned HTTP 200 in 280 milliseconds.

All unit and integration tests pass locally.
134 tests pass across 18 test suites with zero regressions.
All staff portal capabilities are restored on production.
