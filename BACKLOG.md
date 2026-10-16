# Product Backlog — Bugs & Features

Living list of bugs to fix and features to add. Separate from `LAUNCH_PLAN.md` (go-to-market / open-source phases).

**How to use**
- Add new items under Features or Bugs with status, priority, and short notes.
- Move done items to **Completed** (keep a one-line note + date).
- Status: `todo` · `in progress` · `blocked` · `done`
- Priority: `P0` (urgent) · `P1` (high) · `P2` (nice-to-have)

---

## Features

_None open._

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

### Phase 7 leftovers
- GitHub topics still to add on the repo settings page (`oncology`, `medical-ai`, `dicom`, …)
- Optional still screenshots (GIFs already in README)

---

## Completed

### F1 — Persist chat across page navigation
- **Done:** 2026-10-16
- `ChatProvider` + `sessionStorage` keyed by patient; survives navigation/reload in-tab; patient switch isolates threads; clear resets.

### F2 — Public homepage for logged-out users
- **Done:** 2026-10-16
- Signed-out `/[locale]` renders marketing landing; signed-in users redirect to dashboard; sign-out returns to locale home.
