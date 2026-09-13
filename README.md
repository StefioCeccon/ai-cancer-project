# Open Cancer AI Project

**Open-source, self-hostable tools for people living with cancer — and for the builders who want to help.**

As life expectancy grows longer for many cancer diagnoses, being able to understand, follow, and organise your own medical data becomes essential. Open Cancer AI Project gives patients and caregivers a place to gather reports, track blood markers and imaging over time, and explore AI insight from specialist agents and imaging models — on your machine, with your keys, under your control.

This is a **community project**. The live demo is the discovery hook; self-hosting is the default for privacy. We need clinicians, patients, designers, and engineers to shape what comes next.

> **Not medical advice.** AI output is analytical support, not a diagnosis. Always work with qualified clinicians. See [Medical Disclaimer](#medical-disclaimer).

---

## Why this exists

- **Patient-owned data** — your labs, imaging, and reports in one place you control
- **Self-host first** — run locally or on your own infra; privacy is the product
- **Open by default** — inspect the prompts, the agents, the DICOM pipeline
- **Built in public** — roadmap and issues are how we decide what to build

---

## Try it / join in

| | |
|---|---|
| **Live demo** | Coming soon (Vercel) — sign up, explore sample data, try AI with a shared key or your own |
| **Self-host** | Follow [Setup Guide](#setup-guide) below |
| **Contribute** | See [Contributing](#contributing) — issues, PRs, and domain expertise all welcome |
| **Discuss** | Open a [GitHub Discussion](../../discussions) or issue — patient voices and clinician feedback especially valued |

---

## Features

| Module | What it does |
|--------|-------------|
| **Patients** | Profiles with diagnosis context, multi-tenant (each account owns its data) |
| **CT / Imaging** | Upload DICOM (`.dcm` / `.zip`), interactive viewer, optional local Sybil risk analysis |
| **Blood Tests** | PDF/CSV or manual entry; cancer markers over time with trend charts |
| **Medical Reports** | Visit notes, pathology, radiology; PDF text extraction |
| **MDT consultation** | Multi-disciplinary specialist agents discuss the case, then an oncologist synthesises |
| **AI Analysis** | Progression, biomarkers, imaging, risk, next steps — Gemini, GPT-4, Claude, or Mistral |
| **Your API keys** | Bring your own keys in Settings (encrypted at rest); env keys work for self-host/demo |
| **Multilingual** | English · Italian · Spanish · French · German |

---

## Contributing

We want this to be useful for **the community**, not a closed product. You do not need to be an ML engineer to help.

**High-impact ways to contribute**
- Report bugs and rough edges from a patient or clinician perspective
- Improve copy, accessibility, and i18n (especially medical wording)
- Add tests, docs, and setup polish for new self-hosters
- Wire or harden agents (literature, trials, specialty prompts)
- Imaging / DICOM UX and local ML packaging
- Security and privacy review (auth, tenancy, uploads)

**How to start**
1. Browse [open issues](../../issues) — look for `good first issue` or `help wanted`
2. Open an issue before large changes so we can align
3. Fork → branch → PR with a short description of *why*
4. Keep PRs focused; one concern per PR when possible

A fuller `CONTRIBUTING.md` is planned. Until then, issues and PRs are the right channel.

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| [nvm](https://github.com/nvm-sh/nvm) | any | `nvm --version` |
| Node.js | 20.x (via nvm) | `node --version` |
| [pnpm](https://pnpm.io/installation) | 9.x | `pnpm --version` |
| Python | 3.10+ | `python3 --version` |

> **Python is only needed for the local ML service** (Sybil CT analysis). The Next.js app runs without it. Sybil needs **Python 3.10** (`brew install python@3.10`).

```bash
npm install -g pnpm   # if needed
```

**Database** — [Neon](https://neon.tech) (recommended) or local PostgreSQL.

**AI** — at least one key for analysis: [Gemini](https://ai.google.dev/) · [OpenAI](https://platform.openai.com/api-keys) · [Anthropic](https://console.anthropic.com/) · [Mistral](https://console.mistral.ai/)

**Auth** — [Clerk](https://clerk.com) keys for sign-in (see `.env.example`).

---

## Setup Guide

### 1. Node version

```bash
cd open-cancer-ai-project
nvm use          # Node 20 from .nvmrc
# or: nvm install 20 && nvm use 20
```

### 2. Clone and install

```bash
git clone https://github.com/<your-org>/open-cancer-ai-project.git
cd open-cancer-ai-project
nvm use
pnpm install
```

### 3. Database

**Neon:** create a project → copy the connection string → use as `DATABASE_URL`.

**Local:**
```bash
brew install postgresql@15 && brew services start postgresql@15
createdb cancer_monitor   # or any name you prefer
# DATABASE_URL=postgresql://localhost/cancer_monitor
```

### 4. Environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

Fill in at least `DATABASE_URL`, Clerk keys, and one AI key. See comments in `.env.example` for R2, encryption secret, and demo mode.

### 5. Migrations

```bash
pnpm db:migrate
# optional: pnpm db:studio
```

### 6. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. ML service (optional — Sybil)

Runs **on your machine** only; DICOM stays local.

```bash
cd apps/ml-service
./setup.sh    # once
./start.sh    # keep running beside pnpm dev
```

Sybil and TotalSegmentator use separate venvs (`./setup-segmentation.sh` for anatomy). See scripts in `apps/ml-service/` if you need repairs.

---

## Using the App

1. **Sign in** (Clerk) → create or select a patient  
2. Upload **blood tests**, **reports**, and **imaging**  
3. Optionally link radiology reports to studies  
4. Run **Sybil** on a CT (local ML service) and/or **AI / MDT** analysis  
5. Add your own provider keys under **Settings** when self-hosting or on the public instance  

---

## Project Structure

```
open-cancer-ai-project/
├── apps/
│   ├── web/              # Next.js app (UI + API + Drizzle)
│   └── ml-service/       # Local FastAPI + Sybil / segmentation
├── packages/
│   └── shared/           # Shared types & constants
├── .nvmrc
├── pnpm-workspace.yaml
└── README.md
```

---

## Deployment

1. Push to GitHub  
2. [Vercel](https://vercel.com) → import → **Root Directory:** `apps/web`  
3. Set env vars from `.env.example` (Neon `DATABASE_URL`, Clerk, R2 if used, `API_KEY_ENCRYPTION_SECRET`, optional shared `GEMINI_API_KEY`)  
4. Run `pnpm db:migrate` against the production database once  

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App | Next.js 15, TypeScript, Tailwind CSS v4 |
| Auth | Clerk |
| Database | PostgreSQL + Drizzle ORM (Neon-friendly) |
| AI | Gemini · OpenAI · Anthropic · Mistral |
| Imaging | cornerstone3D; Sybil (MIT/MGH) via local FastAPI |
| i18n | next-intl |
| Monorepo | pnpm workspaces |

---

## Medical Disclaimer

This software is a data aggregation and AI-assisted analysis tool. It is **not** a medical device and does **not** provide diagnosis or treatment. AI-generated outputs are observations for discussion with qualified professionals only. Do not use this tool as a substitute for professional medical advice, diagnosis, or treatment.

---

## License

See the repository license file (to be confirmed / added). Until then, assume all rights reserved by contributors unless stated otherwise — open an issue if you need clarity for reuse.
