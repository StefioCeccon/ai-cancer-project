# Product Backlog — Bugs & Features

Living list of bugs to fix and features to add. Separate from `LAUNCH_PLAN.md` (go-to-market / open-source phases).

**How to use**
- Add new items under Features or Bugs with status, priority, and short notes.
- Move done items to **Completed** (keep a one-line note + date).
- Status: `todo` · `in progress` · `blocked` · `done`
- Priority: `P0` (urgent) · `P1` (high) · `P2` (nice-to-have)

---

## Features

### F1 — Persist chat across page navigation
- **Status:** todo
- **Priority:** P1
- **Area:** `apps/web/src/components/chat/ChatSidebar.tsx`

**Problem**
Chat lives in local React state (`messages`, `isOpen`, input, selected model). Navigating between pages remounts or resets that state, so the conversation (and open/closed sidebar) is lost.

**Desired behaviour**
- Conversation history survives route changes within a session.
- Optionally restore open/closed sidebar and last-selected model.
- Clearing chat (existing reset control) should still wipe the persisted session.

**Notes / approach ideas**
- Lift chat state into a client context (or Zustand/store) mounted above the page tree in `AppShell` / locale layout so it survives client navigations.
- Persist to `sessionStorage` (per tab, clears on close) keyed by patient id if we want reload survival without DB work.
- Later: optional server-side history per patient if we want cross-device continuity.

**Acceptance**
- [ ] Send messages on one page, navigate to another, reopen chat → same thread visible
- [ ] Patient switch clears or isolates threads appropriately
- [ ] Reset still starts a fresh conversation

---

### F2 — Public homepage for logged-out users
- **Status:** todo
- **Priority:** P1
- **Area:** `apps/web/src/app/[locale]/page.tsx`, middleware, marketing UI

**Problem**
`/[locale]` always `redirect`s to `/{locale}/dashboard`. Unauthenticated visitors hit Clerk protection instead of a useful landing page. Middleware already treats `/` and `/:locale` as public, but the page never renders marketing content.

**Desired behaviour**
- Logged-out users see a homepage (product intro, value prop, CTAs to sign in / sign up).
- Logged-in users keep going straight to the dashboard (or equivalent app home).
- Aligns with launch story in `LAUNCH_PLAN.md` (demo discovery, open-source positioning).

**Notes / approach ideas**
- Split root page: check auth server-side; redirect signed-in users to dashboard; render landing for others.
- Keep CTAs pointing at existing `/:locale/sign-in` and `/:locale/sign-up`.
- Content should match branding (“Cancer AI Project”) and mission from the launch plan; avoid looking like a generic dashboard.

**Acceptance**
- [ ] Signed-out visit to `/` or `/{locale}` shows homepage (no forced sign-in wall first)
- [ ] Sign in / sign up CTAs work
- [ ] Signed-in visit still lands on dashboard
- [ ] Mobile + desktop layouts readable

---

## Bugs

_None filed yet._

<!-- Template
### B# — Short title
- **Status:** todo
- **Priority:** P0 | P1 | P2
- **Area:** path or feature
- **Steps to reproduce:** …
- **Expected:** …
- **Actual:** …
-->

---

## Ideas (unprioritized)

_Park rough ideas here before promoting to Features/Bugs._

---

## Completed

_None yet._
