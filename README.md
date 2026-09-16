# Open Cancer AI Project

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Try%20it-0B6E4F?style=for-the-badge)](https://open-cancer-ai-project-web.vercel.app)
[![License: PolyForm Noncommercial](https://img.shields.io/badge/License-PolyForm%20Noncommercial-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](../../issues)

**Self-hostable tools for people living with cancer — and for the builders who want to help.**

As life expectancy grows longer for many cancer diagnoses, being able to understand, follow, and organise your own medical data becomes essential. Open Cancer AI Project gives patients and caregivers a place to gather reports, track blood markers and imaging over time, and explore AI insight from specialist agents and imaging models — on your machine, with your keys, under your control.

This is a **community project**. The [live demo](https://open-cancer-ai-project-web.vercel.app) is the discovery hook; self-hosting is the default for privacy. We need clinicians, patients, designers, and engineers to shape what comes next.

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
git clone https://github.com/StefioCeccon/open-cancer-ai-project.git
cd open-cancer-ai-project
```

---

## Features

What works today:

| Area | Details |
|------|---------|
| **Patients** | Profiles with diagnosis context; each signed-in account owns its own data |
| **Imaging** | DICOM upload (`.dcm` / `.zip`), interactive cornerstone3D viewer, R2 or local storage |
| **Blood tests** | PDF/CSV or manual entry; marker trends (CEA, CA 19-9, CBC, …) |
| **Reports** | Visit notes, pathology, radiology; PDF text extraction |
| **MDT consultation** | Multi-specialist AI panel discusses the case; oncologist synthesises |
| **AI analysis** | Progression, biomarkers, imaging, risk, next steps — Gemini, OpenAI, Anthropic, Mistral |
| **Bring your own keys** | Settings → encrypt API keys at rest; env keys for self-host / demo |
| **Auth** | Clerk sign-in / sign-up |
| **i18n** | English · Italian · Spanish · French · German |
| **Local ML (optional)** | Sybil lung-cancer risk on CT via `apps/ml-service` (self-host / Docker profile) |

**Planned (help wanted)**

- **Shared patients** — invite a family member, carer, or clinician to the same patient record (roles: owner / viewer / collaborator)
- Screenshots + demo GIF in the README
- Broader provider support (e.g. Ollama for fully offline LLMs)
- More locales and clinical copy review

---

## Why this exists

- **Patient-owned data** — labs, imaging, and reports in one place you control  
- **Self-host first** — privacy is the product  
- **Source available** — inspect the prompts, the agents, the DICOM pipeline (noncommercial license)  
- **Built in public** — issues and PRs decide what ships next  

---

## Contributing

You do not need to be an ML engineer to help.

**High-impact ways to contribute**
- Patient / clinician UX feedback and medical wording
- Accessibility and i18n
- Tests, docs, Docker polish
- Agents (literature, trials, specialty prompts)
- Imaging / DICOM UX
- Security and tenancy review — including **shared-patient** design

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
cd open-cancer-ai-project
nvm use          # Node 20 from .nvmrc
```

### 2. Clone and install

```bash
git clone https://github.com/StefioCeccon/open-cancer-ai-project.git
cd open-cancer-ai-project
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
open-cancer-ai-project/
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
