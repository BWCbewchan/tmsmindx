# Exam Feedback Rating Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add optional post-exam ratings and two-category feedback, plus an admin statistics and processing tab for exam-set quality.

**Architecture:** Store one review per `chuyen_sau_results` row in a dedicated review table, with a normalized child table for selected questions. Expose ownership-protected mentor APIs and admin-only reporting/status APIs, then reuse a shared feedback form on the result screen and completed-assignment list.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, PostgreSQL via `pg`, Tailwind CSS, existing auth and UI helpers.

---

### Task 1: Add validation helpers and tests

**Files:**
- Create: `lib/exam-feedback.ts`
- Create: `tests/exam-feedback.test.ts`

**Step 1: Write failing tests**

Cover:

- Rating accepts `null` and integers 1-5.
- Rating rejects 0, 6 and decimals.
- A review requires rating or at least one non-empty comment.
- Question IDs are deduplicated positive integers.
- Status transitions allow same status, `new -> in_progress`, `in_progress -> done`, and reject skips/backtracking.

**Step 2: Run tests and verify failure**

Run the repository-compatible Node test command for `tests/exam-feedback.test.ts`.

Expected: FAIL because `lib/exam-feedback.ts` does not exist.

**Step 3: Implement minimal helpers**

Export:

- `normalizeExamFeedbackInput`
- `normalizeQuestionIds`
- `isValidExamFeedbackStatusTransition`
- shared status and input types

**Step 4: Run tests and verify pass**

Expected: all exam feedback unit tests pass.

### Task 2: Add database migration

**Files:**
- Modify: `lib/migrations.ts`
- Modify: `scripts/run-all-migrations.js`
- Modify: `schema_chuyên sâu.dbml`

**Step 1: Add migration V98**

Create:

- `exam_feedback_reviews`
- `exam_feedback_review_questions`
- indexes for result, set, subject, status, created time and question lookup
- updated-at trigger

Use `ON DELETE CASCADE` from result to review, and `ON DELETE SET NULL` for set/question references while retaining snapshots.

**Step 2: Register V98 in the standalone migration runner**

Add the same idempotent SQL entry to `scripts/run-all-migrations.js`.

**Step 3: Update DBML**

Document both tables and their relationships.

### Task 3: Build mentor feedback API

**Files:**
- Create: `app/api/exam-feedback/route.ts`

**Step 1: Implement GET**

- Require authenticated session.
- Require `result_id`.
- Enforce ownership with `rejectIfChuyenSauResultNotOwned`.
- Resolve the exact set used by the result.
- Return existing review plus selectable questions ordered by set position.

**Step 2: Implement POST**

- Require same-origin mutation and authenticated session.
- Normalize and validate input with `lib/exam-feedback.ts`.
- Confirm result is completed and belongs to the session user.
- Confirm selected questions belong to the resolved set.
- Insert review and question links in one transaction.
- Return `409` if a review already exists.

**Step 3: Implement PUT**

- Apply the same validation and ownership checks.
- Lock the review row.
- Reject edits unless status is `new`.
- Update the review and replace selected question links transactionally.

### Task 4: Build admin statistics API

**Files:**
- Create: `app/api/exam-feedback/admin/route.ts`

**Step 1: Implement admin authorization**

Use existing admin/super-admin auth gates for reads and mutations.

**Step 2: Implement filtered GET**

Support:

- `month`
- `subject_code`
- `set_id`
- `status`
- `feedback_type`
- `query`
- `page`
- `page_size`

Return:

- summary counts
- average rating
- rating distribution
- filter options
- paginated rows with selected question snapshots

**Step 3: Implement PATCH**

- Validate status transition using the shared helper.
- Update status, handler and handled time.
- Return the updated review.

### Task 5: Build reusable mentor form

**Files:**
- Create: `components/assignments/ExamFeedbackForm.tsx`

**Step 1: Implement loading existing data**

Accept `resultId` and optional initial questions. Fetch current review and questions when needed.

**Step 2: Implement form controls**

- Accessible 1-5 star rating.
- Separate system and subject textareas.
- Multi-select question list shown with subject feedback.
- Clear disabled/read-only state for handled reviews.

**Step 3: Implement create/update submission**

- POST for new review.
- PUT for editable review.
- Preserve input on failure.
- Emit success callback with updated review.

### Task 6: Integrate mentor result and assignment list

**Files:**
- Modify: `app/user/assignments/exam/[id]/page.tsx`
- Modify: `app/api/exam-assignments/route.ts`
- Modify: `app/user/assignments/page.tsx`

**Step 1: Add form to the completion screen**

Place `ExamFeedbackForm` below score details and above the back link. Keep the back action available so feedback remains optional.

**Step 2: Include feedback summary in assignment API**

Join the review by `chuyen_sau_results.id` and expose:

- `feedback_id`
- `feedback_rating`
- `feedback_status`

**Step 3: Add list entry point**

For completed exams:

- Show “Đánh giá bộ đề” when absent.
- Show “Chỉnh sửa đánh giá” for `new`.
- Show the processing status when editing is locked.
- Open the shared form in the existing modal component.

### Task 7: Build admin statistics tab

**Files:**
- Create: `components/admin/exam-feedback/ExamFeedbackStatsPanel.tsx`
- Modify: `app/admin/page4/thu-vien-de/page.tsx`

**Step 1: Add page-level tabs**

Add “Thư viện bộ đề” and “Thống kê đánh giá”. Preserve the current library UI unchanged in its tab.

**Step 2: Add KPI and distribution UI**

Render total reviews, average rating, feedback category counts, pending count and 1-5 star distribution.

**Step 3: Add filters and details table**

Implement the API filters, pagination, empty/loading/error states and expandable feedback/question details.

**Step 4: Add status actions**

Allow only the next valid action and refresh summary/list after success.

### Task 8: Verify end to end

**Files:**
- Review all files modified above.

**Step 1: Run focused unit tests**

Expected: exam feedback helper tests pass.

**Step 2: Run lint on touched source files**

Expected: no new lint errors.

**Step 3: Run TypeScript/build verification**

Run `npm run build`.

Expected: exit code 0.

**Step 4: Inspect UI locally**

Open the known local app in the in-app browser and verify:

- post-submit form
- optional skip path
- list edit/locked states
- admin statistics tab
- mobile layout

**Step 5: Review the final diff**

Confirm only intended feature files and documentation changed.
