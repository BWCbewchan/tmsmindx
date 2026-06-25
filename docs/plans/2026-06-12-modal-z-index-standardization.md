# Modal Z-Index Standardization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure every modal, dialog, drawer, and blocking popup renders above the feedback mascot and other floating widgets.

**Architecture:** Define one semantic z-index scale in `app/z-index.css`, then replace page-specific numeric modal layers with those semantic classes. Keep navigation and passive HUD elements below modal layers, while loading, toast, and critical blocking overlays remain above normal modals.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS v4, global CSS utilities.

---

### Task 1: Define the shared layer scale

**Files:**
- Modify: `app/z-index.css`

**Steps:**
1. Add explicit classes for mascot, modal backdrop, modal content, raised modal, popup, loading, toast, and critical overlays.
2. Keep sidebar and navigation layers below modal layers.
3. Preserve compatibility aliases used by existing components.

### Task 2: Update shared overlay components

**Files:**
- Modify: `components/Modal.tsx`
- Modify: `components/ui/modal.tsx`
- Modify: `components/ui/dialog.tsx`
- Modify: `components/ui/popover.tsx`
- Modify: `components/ui/loading-overlay.tsx`
- Modify: `components/feedback/UserFeedbackWidget.tsx`

**Steps:**
1. Replace numeric z-index utilities with semantic layer classes.
2. Keep nested image previews above their parent modal.
3. Place the mascot on the dedicated mascot layer.

### Task 3: Normalize page-specific modals and floating HUDs

**Files:**
- Modify: modal and drawer implementations found under `app/` and `components/`.

**Steps:**
1. Replace modal containers using `z-40`, `z-50`, `z-60`, `z-[70]`, `z-1001`, `z-1100`, or `z-9999`.
2. Preserve sidebar overlays as navigation layers.
3. Move passive import/upload HUDs below modal layers.
4. Use raised modal layers for nested dialogs.

### Task 4: Verify

**Steps:**
1. Search for modal containers still using page-specific numeric z-index values.
2. Run `npx tsc --noEmit`.
3. Run ESLint on modified TypeScript files.
4. Open `/user/hoat-dong-hang-thang`, trigger available dialogs, and verify the mascot stays behind each overlay.
