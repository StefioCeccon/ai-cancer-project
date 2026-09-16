# AI Cancer Project

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Try%20it-0B6E4F?style=for-the-badge)](https://open-cancer-ai-project-web.vercel.app)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](../../issues)

**Help patients and carers keep cancer data in one place — import it easily, interpret it with AI agents, and bring it ready to show specialists.**

If you’re living with cancer — or caring for someone who is — the paperwork piles up: blood tests, letters, CDs of **CT and X-ray** scans. I couldn’t find a **non-commercial** tool that even let me **open and navigate** those scans properly, let alone help interpret them or keep labs and imaging together over time. Top hospitals run **MDT (multi-disciplinary team)** meetings where specialists sit down and discuss the patient; most families never get that room.

**AI Cancer Project** is built around one flow:

1. **Import** — photo or PDF of labs/reports on the go; upload DICOM imaging  
2. **Keep track** — everything in one timeline you control  
3. **Interpret** — AI agents (MDT-style) and imaging models help make sense of it  
4. **Show up prepared** — walk into clinic with history, trends, and notes in one place  

Self-host for privacy, or try the [live demo](https://open-cancer-ai-project-web.vercel.app). Community project — patients, carers, clinicians, and builders welcome.

> **Not medical advice.** AI output is analytical support, not a diagnosis. Always work with qualified clinicians. See [Medical Disclaimer](#medical-disclaimer).

---

## Try it

| | |
|---|---|
| **Live demo** | [open-cancer-ai-project-web.vercel.app](https://open-cancer-ai-project-web.vercel.app) — sign up, explore seeded sample data, run AI / MDT with a server key or your own |
| **Docker self-host** | [Self-host with Docker](#self-host-with-docker) — one compose stack |
| **Manual self-host** | [Setup Guide](#setup-guide) |
| **Contribute** | [Contributing](#contributing) |

```bash
git clone https://github.com/StefioCeccon/ai-cancer-project.git
cd ai-cancer-project
```

---

## Features

Mapped to that flow — **import → track → interpret → show specialists**.

| | |
|---|---|
| **Import on the go** | Phone photo or PDF of **blood tests** and **reports** → AI extracts markers, dates, and text. No retyping hospital printouts. |
| **One place for everything** | Labs, therapies, symptoms, letters, and imaging on **one patient timeline** — ready to review before an appointment or share on screen with a clinician. |
| **CT / X-ray you can actually open** | Full DICOM viewer (scroll, navigate studies). Built because non-commercial options to *read* scans — not just archive a zip — were essentially missing. |
| **Imaging AI + Sybil** | Vision models on studies / flagged slices; optional local **Sybil** (MIT/MGH) for 1–6 year lung-cancer risk and attention maps. Self-host keeps pixels on your machine. |
| **MDT agent panel** | Like a hospital MDT: specialist agents review in parallel, **debate over multiple rounds**, oncologist synthesises — then you can ask follow-ups. Insight to discuss *with* your care team, not instead of them. |
| **Longitudinal AI analysis** | Progression, biomarkers, imaging, treatment response, risk, next steps — Gemini, OpenAI, Anthropic, or Mistral (your keys or the demo’s). |
| **Private by design** | Self-host or demo sandbox. Encrypted bring-your-own API keys. Sharing with family / carers / doctors is on the roadmap. |
| **Multilingual** | English · Italian · Spanish · French · German. |

> Still **not a diagnosis**. Agents and models are decision-support for discussion with clinicians.

**Planned (help wanted)**

- **Verify Docker Compose** — smoke-test `docker compose up` and report results ([CONTRIBUTING](CONTRIBUTING.md))
- **Shared patients** — invite family, carer, or clinician (owner / viewer / collaborator)
- **Responsive UI + mobile app** — better phones/tablets first; path toward a native or Expo app (shared `packages/shared` is already monorepo-ready)
- Screenshots + demo GIF in the README
- Broader providers (e.g. Ollama offline) and more locales

---

## Why this exists

- **Patients and carers** need one home for messy real-world medical files  
- **Import should be easy** — camera and PDF, not manual spreadsheets  
- **Imaging shouldn’t be a black box** — navigate CT/X-ray without a commercial viewer license  
- **Interpretation with AI agents** — MDT-shaped discussion you can run yourself, then take to specialists  
- **Self-host / noncommercial** — privacy first; source available under PolyForm Noncommercial  
- **Built in public** — issues and PRs welcome

---

## Contributing

You do not need to be an ML engineer to help. See **[CONTRIBUTING.md](CONTRIBUTING.md)** for setup and good first issues (including Docker smoke-testing).

**High-impact ways to contribute**
- Smoke-test Docker self-host and file issues with logs
- **Responsive layout / mobile app** (Expo path via `packages/shared`)
- Patient / carer / clinician UX feedback and medical wording
- Accessibility and i18n
- Agents (literature, trials, specialty prompts)
- Imaging / DICOM UX
- Security and tenancy — including **shared-patient** design

**How to start**
1. Browse [open issues](../../issues)  
2. Open an issue before large changes  
3. Fork → branch → focused PR  

---

## Self-host with Docker

Requires [Docker](https://docs.docker.com/get-docker/) and a [Clerk](https://clerk.com) application (free tier is fine).

```bash
cp .env.docker.example .env.docker
# Edit .env.docker — set Clerk keys + at least one AI key (e.g. GEMINI_API_KEY)

docker compose --env-file .env.docker up --build
```

Open [http://localhost:3000](http://localhost:3000).

| Service | Port | Notes |
|---------|------|--------|
| `web` | 3000 | Next.js app |
| `postgres` | 5432 | App database |
| `migrate` | — | Applies Drizzle migrations once, then exits |
| `ml` | 8001 | Optional Sybil service — large image |

Optional ML profile:

```bash
docker compose --env-file .env.docker --profile ml up --build
```

Uploads persist in a Docker volume. For production self-host, put a reverse proxy (Caddy/nginx) in front and use your own domain in Clerk.

> **Help wanted:** this stack is ready to try but not yet fully smoke-tested end-to-end by the maintainer. If you run it successfully (or hit a wall), please [open an issue](../../issues) — see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Prerequisites (manual setup)

| Tool | Version | Check |
|------|---------|-------|
| [nvm](https://github.com/nvm-sh/nvm) | any | `nvm --version` |
| Node.js | 20.x | `node --version` |
| [pnpm](https://pnpm.io/installation) | 9.x | `pnpm --version` |
| Python | 3.10+ | only for Sybil ML service |

**Database** — Docker Postgres, [Neon](https://neon.tech), or local PostgreSQL.  
**AI** — at least one of: [Gemini](https://ai.google.dev/) · [OpenAI](https://platform.openai.com/api-keys) · [Anthropic](https://console.anthropic.com/) · [Mistral](https://console.mistral.ai/)  
**Auth** — [Clerk](https://clerk.com) keys (see `apps/web/.env.example`).

---

## Setup Guide

### 1. Node version

```bash
cd ai-cancer-project
nvm use          # Node 20 from .nvmrc
```

### 2. Clone and install

```bash
git clone https://github.com/StefioCeccon/ai-cancer-project.git
cd ai-cancer-project
nvm use
pnpm install
```

### 3. Database

**Neon:** create a project → copy the connection string → `DATABASE_URL`.

**Local:**
```bash
brew install postgresql@15 && brew services start postgresql@15
createdb cancer_monitor
# DATABASE_URL=postgresql://localhost/cancer_monitor
```

### 4. Environment

```bash
cp apps/web/.env.example apps/web/.env.local
```

Fill in `DATABASE_URL`, Clerk keys, and one AI key.

### 5. Migrations

```bash
pnpm db:migrate
```

### 6. Run the app

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. ML service (optional — Sybil)

```bash
cd apps/ml-service
./setup.sh    # once
./start.sh    # keep running beside pnpm dev
```

---

## Using the App

1. **Sign in** → create or select a patient  
2. Upload **blood tests**, **reports**, and **imaging**  
3. Optionally link radiology reports to studies  
4. Run **AI analysis** or **MDT**; optionally **Sybil** if the ML service is up  
5. Add your own provider keys under **Settings**  

On the [live demo](https://open-cancer-ai-project-web.vercel.app), a sample NSCLC patient (including a public NLST chest CT) is seeded automatically.

---

## Project Structure

```
ai-cancer-project/
├── apps/
│   ├── web/              # Next.js app (UI + API + Drizzle)
│   └── ml-service/       # Local FastAPI + Sybil / segmentation
├── packages/
│   └── shared/           # Shared types & constants
├── docker-compose.yml
├── .env.docker.example
├── LICENSE
└── README.md
```

---

## Deployment (Vercel)

The public demo runs on Vercel + Neon + Cloudflare R2 + Clerk.

1. Import the GitHub repo → **Root Directory:** `apps/web`  
2. Set env vars from `apps/web/.env.example`  
3. Run `pnpm db:migrate` against the production database once  
4. Add the Vercel origin to the R2 bucket CORS policy  

Live: https://open-cancer-ai-project-web.vercel.app

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App | Next.js 15, TypeScript, Tailwind CSS v4 |
| Auth | Clerk |
| Database | PostgreSQL + Drizzle ORM |
| AI | Gemini · OpenAI · Anthropic · Mistral |
| Imaging | cornerstone3D; Sybil (MIT/MGH) via local FastAPI |
| i18n | next-intl |
| Monorepo | pnpm workspaces |
| Self-host | Docker Compose |

---

## Medical Disclaimer

This software is a data aggregation and AI-assisted analysis tool. It is **not** a medical device and does **not** provide diagnosis or treatment. AI-generated outputs are observations for discussion with qualified professionals only. Do not use this tool as a substitute for professional medical advice, diagnosis, or treatment.

---

## License

[PolyForm Noncommercial License 1.0.0](LICENSE) — you may use, modify, and share this software for **noncommercial** purposes (personal use, research, education, charities, government, etc.). **Commercial use is not allowed** under this license.

See the [full license text](LICENSE) and [PolyForm Noncommercial](https://polyformproject.org/licenses/noncommercial/1.0.0) for details. Contributions are welcome under the same terms. If you need a commercial license, open an issue.
