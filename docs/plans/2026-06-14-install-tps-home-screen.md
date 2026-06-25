# Install TPS Home Screen Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a platform-aware button that installs the TPS PWA when the browser permits it and provides correct iOS/manual instructions otherwise.

**Architecture:** A small pure helper classifies install state from platform and display mode. A client component captures `beforeinstallprompt`, invokes it only from a user click, reacts to `appinstalled`, and renders the appropriate action beside device notification settings.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Web App Manifest, Node test runner.

---

### Task 1: Add install-state helper and tests

**Files:**
- Create: `lib/pwa-install.ts`
- Create: `tests/pwa-install.test.ts`

**Steps:**
1. Write tests for installed, prompt-ready, iOS manual and generic manual states.
2. Run `node --experimental-strip-types --test tests/pwa-install.test.ts` and verify it fails.
3. Implement the minimal pure helper.
4. Run the test and verify it passes.

### Task 2: Add the install button

**Files:**
- Create: `components/notifications/InstallTpsApp.tsx`
- Modify: `components/notifications/DevicePushSetting.tsx`

**Steps:**
1. Capture and prevent the default `beforeinstallprompt` event.
2. Detect standalone mode and iOS.
3. Invoke the browser prompt from the install button.
4. Render iOS and generic manual instructions when direct installation is unavailable.
5. Render the installed state after `appinstalled`.

### Task 3: Verify

**Files:**
- Test: `tests/pwa-install.test.ts`
- Test: `components/notifications/InstallTpsApp.tsx`

**Steps:**
1. Run unit tests.
2. Run `npx tsc --noEmit`.
3. Run targeted ESLint.
4. Open `/user/thong-bao?settings=device` at Android and iPhone viewport sizes.
5. Confirm there is no horizontal overflow and the correct install action is visible.

