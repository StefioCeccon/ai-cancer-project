# Demo recording checklist (Phase 7)

Record a short **demo GIF** (or MP4) from the [live demo](https://www.aicancerproject.com) with seeded sample data. This is the scroll-stopping asset for the README and launch posts — not a long talkie video.

## Goal (from LAUNCH_PLAN)

Show: **patient data → MDT page → specialists populating → Oncologist synthesis**.

Target length: **15–30 seconds**. Keep file size reasonable (~5–8 MB for GIF if possible).

## Tools

Pick one:

- [Kap](https://getkap.co/) (macOS) — export GIF
- CleanShot X / Screen Studio — export GIF or short MP4
- OBS → trim → [gifski](https://gif.ski/) or similar

Tips: 1280×720 or 1080p cropped to the app chrome; 10–15 fps is enough for GIF; hide bookmarks bar; use a clean browser profile.

## Shot list

1. **Open the demo** — signed in, sample patient selected in the header.
2. **Data glimpse (2–4s)** — dashboard or timelines showing reports / markers (one quick scroll).
3. **Go to MDT Consultation** — open `/mdt` (or nav item).
4. **Start consultation** — kick off the run; show the live timeline filling.
5. **Specialists** — linger while specialist cards / reports appear.
6. **Oncologist synthesis** — end on the chair’s summary (final recommendation).
7. Stop recording. Do not include real PHI — use only seeded demo data.

## Shipped GIFs (in repo)

| File | Content |
|------|---------|
| `docs/media/mdt-analysis.gif` | MDT consultation → specialists → synthesis |
| `docs/media/main-sections.gif` | Main app sections walkthrough |
| `docs/media/ai-analysis.gif` | AI analysis on patient data |

Embedded under **Demo** in `README.md`. Optional still screenshots can still be added later.

## Also still open in Phase 7

- [ ] Add GitHub topics: `oncology`, `medical-ai`, `dicom`, `nextjs`, `self-hosted`, `cancer`, `llm`, `healthcare`
- [ ] Optional stills: `patients.png`, `blood-chart.png`, `imaging-viewer.png`
