# Teacher Session Restore Implementation Plan

**Goal:** Restore a remembered teacher session without unnecessary datasource waits while still forcing teachers missing from the `teachers` table through `/checkdatasource`.

**Architecture:** `/api/auth/me` is the single source of truth for the current session and returns `teacherSync` with `foundInDatabase` and `dbUnavailable`. Client routing consumes that result consistently. `/checkdatasource` checks PostgreSQL first and only calls Google Sheets for a genuinely missing teacher.

**Tech Stack:** Next.js App Router, React, TypeScript, PostgreSQL, Node test runner.

---

### Task 1: Lock Routing Behavior

**Files:**
- Create: `lib/teacher-session-routing.ts`
- Test: `tests/teacher-session-routing.test.ts`

1. Add failing tests for found, missing, unavailable, admin-manager, and admin-teacher cases.
2. Run the Node test runner and confirm the module/behavior is missing.
3. Implement the routing helper.
4. Run tests and confirm all cases pass.

### Task 2: Return Teacher State During Session Restore

**Files:**
- Modify: `app/api/auth/me/route.ts`
- Modify: `lib/auth-context.tsx`

1. Query teacher existence only for a teacher session.
2. Distinguish a missing row from database unavailability.
3. Persist `teacherSync` in the in-memory and cached user object.

### Task 3: Use One Routing Decision

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/page.tsx`
- Modify: `components/AppLayout.tsx`

1. Replace duplicate landing rules with the tested helper.
2. Stop the root page from repeating the teacher database check already completed by `/api/auth/me`.
3. Keep periodic revocation checks, but do not use the old localStorage marker as the source of truth.

### Task 4: Make Datasource DB-First

**Files:**
- Modify: `app/checkdatasource/page.tsx`

1. Query `/api/teachers/info` first.
2. Redirect immediately when the teacher exists.
3. Start score import without blocking navigation.
4. Query Google Sheets only when PostgreSQL confirms the teacher is missing.

### Task 5: Verify

1. Run the routing regression tests.
2. Run TypeScript and ESLint.
3. Run the production build.
4. Test restored sessions for a known teacher and a missing teacher.
