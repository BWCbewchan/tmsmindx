# Exam Notification Scheduling Design

## Goal

Replace immediate mass notifications when an exam schedule is created with
time-based in-app notifications:

- Registration opens: all active users at 12:00 on the registration start date.
- Registration closes: all active users when the registration window ends.
- Exam starts soon: only registered teachers, 10 minutes before their exam.

## Constraints

- Do not use Vercel Cron.
- Do not send duplicate notifications when several users poll at the same time.
- Preserve existing personal notifications such as registration confirmation.
- Use Vietnam wall-clock time stored in `event_schedules`.

## Architecture

The existing unread-count endpoint is polled while authenticated users are
active. It will invoke a lightweight dispatcher before returning the count.
The dispatcher is throttled per process and globally serialized with a
Postgres advisory lock.

A database state row records the last successfully processed instant. Due
events are selected between that instant and the current time. Notification
rows receive a deterministic `dedupe_key`, protected by a partial unique
index on `(recipient_email, dedupe_key)`.

The dispatcher performs notification inserts and advances its cursor in one
transaction. A failed transaction therefore cannot skip a notification
window.

## Recipient Rules

- Registration opening and closing use the union of active `app_users` and
  active teacher emails from `teachers`.
- Exam reminders use `chuyen_sau_results.id_su_kien` to match the exact exam
  event. The recipient email comes from `dia_chi_email`, with a teacher-table
  fallback by teacher code.
- Cancelled schedules are ignored. Cancelled teacher registrations are already
  deleted by the existing registration flow.

## Delivery Semantics

This is an in-app notification system, not an operating-system push service.
The notification is generated when at least one authenticated user is active.
If nobody is active at the exact registration boundary, the next active poll
delivers the opening or closing notification. Exam reminders are only useful
before the exam starts, so overdue exam reminders are not sent after start.

## Verification

- Unit tests cover notification timing constants and deterministic dedupe keys.
- SQL is tested against the current Supabase schema with transaction rollback.
- TypeScript, ESLint, migration syntax, and production build must pass.
