# Exam Notification Scheduling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver registration and exam notifications at the agreed times without Vercel Cron.

**Architecture:** Poll-driven dispatcher invoked from the authenticated unread-count API, backed by a transactional Postgres cursor, advisory lock, and per-recipient dedupe keys.

**Tech Stack:** Next.js 16 route handlers, TypeScript, node:test, PostgreSQL/Supabase.

---

### Task 1: Timing And Dedupe Domain

**Files:**
- Create: `lib/exam-notification-schedule.ts`
- Test: `lib/exam-notification-schedule.test.ts`

1. Write failing tests for the 12:00 opening hour, 10-minute exam offset, and stable dedupe keys.
2. Run the focused node test and confirm it fails because the module is absent.
3. Implement constants and dedupe-key helpers.
4. Run the focused test and confirm it passes.

### Task 2: Database Support

**Files:**
- Modify: `lib/migrations.ts`
- Modify: `scripts/run-all-migrations.js`

1. Add nullable `notifications.dedupe_key`.
2. Add a partial unique index on normalized recipient email and dedupe key.
3. Add `notification_dispatch_state` with one cursor row for exam notifications.
4. Mirror the migration in the manual migration runner.

### Task 3: Due Notification Dispatcher

**Files:**
- Create: `lib/exam-notification-dispatcher.ts`

1. Add local throttling and a Postgres advisory transaction lock.
2. Read the last successful processing cursor.
3. Insert due registration-opening notifications for all active recipients.
4. Insert due registration-closing notifications for all active recipients.
5. Insert 10-minute exam reminders only for matching registered teachers.
6. Advance the cursor in the same transaction.

### Task 4: API Integration And Immediate Send Removal

**Files:**
- Modify: `app/api/notifications/unread-count/route.ts`
- Modify: `app/api/event-schedules/route.ts`
- Modify: `app/api/chuyensau-chonde-thang/route.ts`

1. Invoke the dispatcher before returning unread count.
2. Remove registration/exam mass sends from schedule creation and scheduling.
3. Remove monthly exam-set mass sends that bypass the agreed timing.
4. Keep advanced-training and personal registration notifications unchanged.

### Task 5: Verification

1. Run focused node tests.
2. Run ESLint for changed files.
3. Run `tsc --noEmit`.
4. Validate dispatcher SQL in a rolled-back Supabase transaction.
5. Run `npm run build`.
