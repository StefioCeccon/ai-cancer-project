# Cancer Monitor

Multimodal oncology data platform — load, visualise, and AI-analyse cancer patient data across CT imaging, blood tests, and medical reports.

---

## Table of Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Setup Guide](#setup-guide)
   - [1. Node version](#1-node-version)
   - [2. Clone and install](#2-clone-and-install)
   - [3. Database](#3-database)
   - [4. AI API keys](#4-ai-api-keys)
   - [5. Environment file](#5-environment-file)
   - [6. Run migrations](#6-run-migrations)
   - [7. Start the app](#7-start-the-app)
4. [Using the App](#using-the-app)
5. [Project Structure](#project-structure)
6. [Deployment (Vercel)](#deployment-vercel)
7. [Tech Stack](#tech-stack)
8. [Medical Disclaimer](#medical-disclaimer)

---

## Features

| Module | What it does |
|--------|-------------|
| **Patients** | Create and manage patient profiles with diagnosis info |
| **CT / Imaging** | Upload DICOM files (.dcm or .zip), browse studies with interactive viewer |
| **Blood Tests** | Ingest lab results (PDF/CSV or manual entry), track cancer markers over time with trend charts |
| **Medical Reports** | Upload visit notes, pathology and radiology reports; auto-extracts text from PDFs |
| **AI Analysis** | Run multi-model oncology analysis (progression, biomarkers, imaging, risk assessment, next steps) using Gemini, GPT-4, Claude, or Mistral |
| **AI Strategy** | Before each analysis, AI reads the patient profile and recommends which ML models to run, which areas to focus on, and which analysis tier to use |
| **ML Imaging (Sybil)** | Run Sybil (MIT/MGH) locally on CT scans — predicts 1–6 year lung cancer risk, identifies high-attention slices. Runs entirely on your machine, no data sent externally |
| **Report ↔ Exam Linking** | Link radiology reports to their imaging study so ML analysis and AI prompts can cross-reference both |
| **Multilingual** | English · Italian · Spanish · French · German |

---

## Prerequisites

Before starting, make sure you have the following installed:

| Tool | Version | Check |
|------|---------|-------|
| [nvm](https://github.com/nvm-sh/nvm) | any | `nvm --version` |
| Node.js | 20.x (via nvm) | `node --version` |
| [pnpm](https://pnpm.io/installation) | 9.x | `pnpm --version` |
| Python | 3.10+ | `python3 --version` |

> **Python is only needed for the local ML service** (Sybil CT analysis). The Next.js app runs without it. Sybil requires **Python 3.10 specifically** (it caps at `<3.11`). Install it with `brew install python@3.10` — this sits alongside any other Python version you have and won't affect your system default.

To install pnpm if you don't have it:
```bash
npm install -g pnpm
```

You will also need **one of the following** for the database:

- **[Neon](https://neon.tech)** (recommended, free tier available) — cloud PostgreSQL, no local install needed
- **Local PostgreSQL** — `brew install postgresql` on macOS

And **at least one AI API key** (Gemini is recommended, free tier available):

- [Google Gemini](https://ai.google.dev/) — `GEMINI_API_KEY`
- [OpenAI](https://platform.openai.com/api-keys) — `OPENAI_API_KEY`
- [Anthropic](https://console.anthropic.com/) — `ANTHROPIC_API_KEY`
- [Mistral](https://console.mistral.ai/) — `MISTRAL_API_KEY`

---

## Setup Guide

### 1. Node version

This project requires Node 20. The `.nvmrc` file at the root pins it automatically.

```bash
cd cancer-monitor
nvm use          # switches to Node 20.x as specified in .nvmrc
```

If Node 20 is not installed yet:
```bash
nvm install 20
nvm use 20
```

> **Other repos are not affected.** The `.nvmrc` file only applies to this directory. Your global default node version stays unchanged.

**Optional — auto-switch on `cd`:** Add this to your `~/.zshrc` so the node version switches automatically whenever you enter this folder:

```bash
autoload -U add-zsh-hook
load-nvmrc() {
  local nvmrc_path
  nvmrc_path="$(nvm_find_nvmrc)"
  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version
    nvmrc_node_version=$(nvm version "$(cat "${nvmrc_path}")")
    if [ "$nvmrc_node_version" != "$(nvm version)" ]; then
      nvm use
    fi
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
```

---

### 2. Clone and install

```bash
git clone <your-repo-url> cancer-monitor
cd cancer-monitor

nvm use                  # ensure Node 20
pnpm install             # installs all workspace dependencies
```

---

### 3. Database

#### Option A — Neon (cloud, recommended)

1. Go to [neon.tech](https://neon.tech) and create a free account
2. Create a new project (any name, e.g. `cancer-monitor`)
3. On the project dashboard, click **Connection Details**
4. Copy the **Connection string** — it looks like:
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. This becomes your `DATABASE_URL` (see step 5)

#### Option B — Local PostgreSQL

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Create the database
createdb cancer_monitor

# Your DATABASE_URL will be:
# postgresql://localhost/cancer_monitor
```

---

### 4. AI API keys

Get at least one API key. Gemini has a generous free tier and is the default provider.

**Google Gemini (recommended)**
1. Go to [ai.google.dev](https://ai.google.dev)
2. Click **Get API key** → Create API key in a new project
3. Copy the key — this is your `GEMINI_API_KEY`

**OpenAI (optional)**
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new secret key
3. This is your `OPENAI_API_KEY`

**Anthropic (optional)**
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. API Keys → Create Key
3. This is your `ANTHROPIC_API_KEY`

---

### 5. Environment file

Copy the example env file and fill in your values:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Then open `apps/web/.env.local` and fill it in:

```env
# Required — your PostgreSQL connection string (from step 3)
DATABASE_URL=postgresql://user:password@host/dbname

# At least one AI provider (from step 4)
GEMINI_API_KEY=your-gemini-key-here

# Optional additional providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
MISTRAL_API_KEY=
```

> The app will start without AI keys, but the Analysis section will not work. All other sections (patients, imaging, blood tests, reports) work without any AI key.

---

### 6. Run migrations

This creates all the database tables:

```bash
pnpm db:generate     # generates migration files from the schema
pnpm db:migrate      # applies migrations to your database
```

You should see output confirming that tables were created. If you see a connection error, double-check your `DATABASE_URL` in `.env.local`.

To visually inspect your database at any time:
```bash
pnpm db:studio       # opens Drizzle Studio at http://localhost:4983
```

---

### 7. Start the app

```bash
pnpm dev
```

The app will be available at **[http://localhost:3000](http://localhost:3000)**.

---

### 8. ML inference service (optional — for Sybil CT analysis)

The ML service runs **entirely on your machine** in an isolated Python virtual environment. No DICOM data is ever sent to an external server.

#### First-time setup (run once)

```bash
cd apps/ml-service
./setup.sh
```

This creates a `.venv/` folder inside `apps/ml-service/` and installs PyTorch (CPU build) and Sybil into it. Your system Python and any global packages are **not affected**.

On first run it will also download the Sybil model weights (~2 GB) from the official MIT/MGH release. This only happens once — the weights are cached by PyTorch.

> **Expected time:** `setup.sh` takes 3–5 minutes depending on download speed.

#### Starting the service

Open a separate terminal tab and keep it running alongside `pnpm dev`:

```bash
cd apps/ml-service
./start.sh
```

You should see:

```
Starting ML service on http://localhost:8001
Loading Sybil model weights...
Sybil loaded in 28.4s
INFO: Uvicorn running on http://0.0.0.0:8001
```

Once it's up, open any CT study in the app — you'll see a **"Run Sybil Analysis"** panel in the sidebar. The first analysis on your Intel i9 Mac takes roughly **5–12 minutes** depending on the number of slices. You can keep using the rest of the app while it runs.

#### What it produces

- **1–6 year lung cancer risk scores** (percentages) from the Sybil ensemble model
- **High-attention slice numbers** — the top 15% of slices by model attention weight, which will be highlighted in the DICOM viewer (Phase 6)
- Results are stored in the database and shown immediately without re-running

#### Stopping the service

Press `Ctrl+C` in the terminal running `./start.sh`. The Next.js app continues to work normally without the ML service — the Sybil panel shows a "service not running" message with the start command.

#### Venv location

```
apps/ml-service/
  .venv/                  ← Sybil + FastAPI (run ./setup.sh)
  .venv-segmentation/     ← TotalSegmentator only (run ./setup-segmentation.sh)
  setup.sh                ← one-time Sybil install
  setup-segmentation.sh   ← optional anatomy segmentation (separate venv)
  start.sh                ← daily start command
  main.py                 ← FastAPI app
  sybil_runner.py         ← Sybil model wrapper
```

Sybil and TotalSegmentator need **incompatible** Python package versions (numpy 1.24 / pydicom 2.x vs numpy 2.x / pydicom 3.x). They live in separate venvs; the ML service runs segmentation in a subprocess using `.venv-segmentation/bin/python`.

If you previously ran `pip install -r requirements-segmentation.txt` inside `.venv` and Sybil broke:

```bash
cd apps/ml-service
./repair-sybil-deps.sh
./setup-segmentation.sh   # installs TotalSegmentator in the right place
```

If segmentation fails with NumPy / `torch.from_numpy` errors:

```bash
cd apps/ml-service
./repair-segmentation-deps.sh
```

#### Optional: anatomy segmentation (TotalSegmentator)

```bash
cd apps/ml-service
./setup-segmentation.sh
```

This creates `.venv-segmentation/` (~2 GB model weights on first use). CPU: expect **10–30 minutes per CT series**. Restart `./start.sh` after install.

It will automatically redirect to `/en/dashboard`. To use Italian, navigate to `/it/dashboard` or use the language switcher in the top-right corner.

---

## Using the App

### First steps

1. **Add a patient** — go to Patients → Add Patient. Fill in name, date of birth, cancer type and stage.
2. **Upload blood tests** — go to Blood Tests, select the patient, click Add Test. You can paste text, upload a PDF, or enter markers manually. Use the quick-add buttons for common cancer markers (CEA, CA 19-9, PSA, etc.).
3. **Upload medical reports** — go to Reports, select the patient, click the + button. Drop in a PDF or paste the report text. The app will auto-extract the text.
4. **Upload imaging** — go to Imaging → Upload Study. Select the patient, choose modality (CT/MRI/PET/etc.), then drag in your DICOM files or a ZIP archive.
5. **Link reports to exams** — open any imaging study and use the "Linked Reports" panel in the sidebar to attach the corresponding radiology report. This gives the AI cross-referencing context.
6. **Run ML analysis** — open a CT study, start the ML service (`./start.sh` in a separate terminal), then click "Run Sybil Analysis" in the sidebar. Takes 5–12 min; results stay on your machine.
7. **Run AI analysis** — go to Analysis, select the patient. The app automatically suggests an analysis strategy based on the patient's profile (cancer type, stage, available data). Review the strategy card, optionally click "Apply Strategy", then run. Results include a summary, identified cancer signs, progression trend, recommended next steps, and risk factors.

### Analysis types

| Type | What the AI does |
|------|-----------------|
| **Comprehensive** | Full assessment across all data |
| **Cancer Progression** | Trend over time — improving / stable / worsening |
| **Biomarker Trend** | Focuses on blood marker changes |
| **Imaging Findings** | Summarises imaging data and cross-references radiology reports |
| **ML Imaging** | Interprets ML model output (Sybil scores, high-attention slices) and correlates with the radiology report |
| **Treatment Response** | Evaluates response to current treatment |
| **Risk Assessment** | Overall risk factors |
| **Next Steps** | Prioritised list of recommended clinical actions |

### Language

Use the language dropdown in the top-right header to switch between English, Italian, Spanish, French, and German. AI analysis results are also returned in the selected language.

### Settings

Go to Settings to see which AI providers are currently configured and which models are available for each.

---

## Project Structure

```
cancer-monitor/
├── .nvmrc                           # pins Node 20 for this project
├── pnpm-workspace.yaml
├── IMAGING_ANALYSIS_PLAN.md         # living plan for ML imaging pipeline
├── apps/
│   ├── web/                         # Next.js 15 app
│   │   ├── .env.example             # copy to .env.local
│   │   ├── drizzle.config.ts
│   │   └── src/
│   │       ├── app/
│   │       │   ├── [locale]/        # all pages (i18n-prefixed)
│   │       │   │   ├── dashboard/
│   │       │   │   ├── patients/
│   │       │   │   ├── imaging/     # list, detail ([id]/), upload
│   │       │   │   ├── blood-tests/
│   │       │   │   ├── reports/
│   │       │   │   ├── analysis/
│   │       │   │   └── settings/
│   │       │   └── api/             # REST route handlers
│   │       │       ├── patients/
│   │       │       ├── imaging/
│   │       │       │   └── [id]/
│   │       │       │       ├── ml-analyze/  # Sybil bridge → ML service
│   │       │       │       └── ai-analyze/  # LLM on flagged slices (Phase 5)
│   │       │       ├── blood-tests/
│   │       │       ├── reports/
│   │       │       ├── analysis/
│   │       │       │   └── strategy/  # AI strategy recommender
│   │       │       └── upload/
│   │       ├── components/
│   │       │   ├── ui/              # Button, Card, Badge, StatCard
│   │       │   ├── layout/          # Sidebar, Header, AppShell
│   │       │   ├── imaging/         # DicomViewer, UploadDicom, LinkReportPanel, MlAnalysisPanel
│   │       │   ├── blood-tests/     # MarkerTable, MarkerChart, UploadBloodTest
│   │       │   ├── reports/         # UploadReport
│   │       │   └── analysis/        # AnalysisPanel, StrategyCard (results + strategy UI)
│   │       ├── lib/
│   │       │   ├── ai/              # provider-agnostic LLM layer
│   │       │   │   ├── providers/   # gemini.ts, openai.ts, anthropic.ts
│   │       │   │   ├── registry.ts  # register / discover providers
│   │       │   │   └── prompts.ts   # oncology prompt builder (modality-aware)
│   │       │   ├── ml/              # ML service client
│   │       │   │   └── client.ts    # fetch wrapper for local ML service
│   │       │   ├── db/              # Drizzle client + schema
│   │       │   └── utils/
│   │       ├── i18n/                # next-intl routing + request config
│   │       └── messages/            # en.json, it.json, es.json, fr.json, de.json
│   └── ml-service/                  # Python FastAPI ML inference service
│       ├── .venv/                   # isolated venv — does NOT affect system Python
│       ├── setup.sh                 # one-time: create venv + install deps
│       ├── start.sh                 # daily: activate venv + start uvicorn
│       ├── main.py                  # FastAPI app (POST /analyze/sybil, GET /health)
│       └── sybil_runner.py          # Sybil model wrapper + attention extraction
└── packages/
    └── shared/                      # shared with future Expo mobile app
        └── src/
            ├── types/               # Patient, BloodTest, Report, Analysis...
            ├── utils/               # date helpers, marker classifiers
            └── constants/           # cancer types, AI model list, locales
```

---

## Deployment (Vercel)

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import the repo
3. Set the **Root Directory** to `apps/web`
4. Add environment variables in the Vercel dashboard (same as your `.env.local`)
5. Deploy

For the database, use [Neon](https://neon.tech) — it has a Vercel integration that sets `DATABASE_URL` automatically.

---

## Adding a New AI Provider

Create a new file in `apps/web/src/lib/ai/providers/myprovider.ts`:

```ts
import type { AIProvider_Interface, AIRequestOptions, AIResponse } from "../types";

export class MyProvider implements AIProvider_Interface {
  name = "myprovider" as const;

  isConfigured() {
    return !!process.env.MY_API_KEY;
  }

  async chat(options: AIRequestOptions): Promise<AIResponse> {
    // call your provider's API here
    return { content: "...", provider: "myprovider", model: options.model };
  }
}
```

Then register it in `apps/web/src/lib/ai/registry.ts` and add the model to `AI_MODELS` in `packages/shared/src/constants/index.ts`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| DB Hosting | Neon (serverless Postgres) |
| AI providers | Gemini · OpenAI · Anthropic · Mistral |
| ML model | Sybil (MIT/MGH) — lung cancer CT risk prediction |
| ML runtime | PyTorch (CPU), FastAPI, uvicorn — runs locally |
| Styling | Tailwind CSS v4 |
| DICOM viewer | cornerstone3D |
| Charts | Recharts |
| i18n | next-intl |
| Monorepo | pnpm workspaces |
| Node version | 20.x (via `.nvmrc`) |
| Future mobile | Expo React Native (shared `packages/shared`) |

---

## Medical Disclaimer

This platform is a data aggregation and AI-assisted analysis tool intended to support healthcare professionals. AI-generated outputs are analytical observations, not medical diagnoses. Always consult qualified medical professionals for clinical decisions. Do not use this tool as a substitute for professional medical advice, diagnosis, or treatment.
