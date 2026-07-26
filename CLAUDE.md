# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Trend Tape — a stock streak analyzer with two independently-deployed services:

- **Frontend** (repo root) — Next.js 14 App Router app. Single page (`app/page.tsx`) that calls the
  backend, renders charts/tables via `components/*`, and shows a beginner-friendly,
  EN/FR-switchable interpretation next to every chart.
- **`backend/`** — a standalone FastAPI app (`backend/main.py`, one file) that fetches price history,
  runs the streak/trend analysis, and returns one JSON payload matching `AnalysisResult` in
  `lib/trend.ts`.

They are split — and deployed separately — because `yfinance`/`pandas` don't fit Vercel's serverless
functions well, and running a real backend process also sidesteps aggressive bot-blocking that
Yahoo/Stooq apply to cloud IPs.

## Commands

**Frontend** (repo root):
```bash
npm install
npm run dev       # http://localhost:3000
npm run build
npm run lint
```

**Backend** (`backend/`):
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env             # optional keys, see below
uvicorn main:app --reload --port 8000
```
Sanity check: `http://localhost:8000/api/analyze?ticker=AAPL&days=365&threshold=10`

There is no test suite in this repo. `next.config.js` sets `eslint: { ignoreDuringBuilds: true }`,
so `npm run build` will not fail on lint errors — run `npm run lint` separately to catch them.

## Environment variables

- Frontend: `NEXT_PUBLIC_API_URL` (`.env.local`) — URL of the FastAPI backend; defaults to
  `http://localhost:8000` if unset.
- Backend (`.env` in `backend/`):
  - `TWELVEDATA_API_KEY` — primary price data source (see fallback chain below). Free tier at
    twelvedata.com.
  - `ANTHROPIC_API_KEY` / `ANTHROPIC_MODEL` — optional; enables AI-phrased interpretations. Backend
    works fully without it (falls back to rule-based templates). Defaults to
    `claude-sonnet-4-5-20250929` if the key is set but the model isn't.

## Architecture

### Data flow
`app/page.tsx` fetches `GET {NEXT_PUBLIC_API_URL}/api/analyze?ticker=...&days=...&threshold=...`
(plus sellThreshold/sellTarget/rebuyThreshold/rebuyDays/rebuyDropPct/rebuyFixedDays/ai — see the
`analyze()` query params in `backend/main.py`) and renders the single `AnalysisResult` JSON blob
via the components in `components/`. `lib/trend.ts` is the contract between the two services: it
defines every field of `AnalysisResult` and is the first place to look when the shape of the
backend response changes. If a data source itself breaks, that's isolated to
`fetch_price_history`/`fetch_from_*` in `backend/main.py` — the frontend doesn't care which source
was used, only the JSON shape.

### Price data fallback chain
`fetch_price_history()` in `backend/main.py` tries, in order: **Twelve Data** →
**Stooq** → **yfinance**, returning the first non-empty result along with which source
was used (`data_source`) and accumulated failure reasons (surfaced in the 422 error detail if all
three fail). Twelve Data needs `TWELVEDATA_API_KEY`; without it the chain effectively starts at
Stooq. This ordering exists because Yahoo/Stooq block many cloud/serverless IPs.

### Chronological direction bug (important, already fixed — don't reintroduce)
History arrives newest-first. `compute_trend_summary()` (streak grouping) is scan-direction-agnostic
and operates on the newest-first frame. But everything that means "what happens *after* a streak"
(`analyze_after_rise`, the next-day reversal check, `analyze_rebuy_after_5`, `simulate_strategies`)
**must** run against `hist_asc`, the chronologically-ascending copy built in `analyze()` — walking
forward in a newest-first frame walks backward in calendar time. If you touch any "after this
streak, what happened next" logic, verify it's using `hist_asc`, not `hist`.

### Backend request pipeline (`backend/main.py`, `analyze()`)
Single endpoint `GET /api/analyze` does, in order: fetch price history → compute `Variation %` →
build `hist_asc` (ascending) and `hist` (descending, for streak grouping) → `compute_trend_summary()`
→ split into positive/negative streaks and strong rises (>= `threshold`) → reversal-probability loop
→ `analyze_after_rise()` at 5/10/15% thresholds → `analyze_sell_vs_wait()` → `analyze_rebuy_after_5()`
→ `simulate_strategies()` (3-way backtest: buy & hold vs. sell-and-rebuy-on-drop vs.
sell-and-rebuy-after-N-days) → `build_snapshot()` → interpretations (AI or rule-based) → assemble
`AnalysisResult`.

### Interpretations (EN/FR)
`build_snapshot()` distills the numeric results into a plain dict; `rule_based_interpretations()`
turns that into bilingual, template-based text for six sections (overview, strongRise, postRise,
sellVsWait, rebuy, strategy). If `ANTHROPIC_API_KEY` is set, `ai_interpretations()` is tried first
(same section structure, numbers-grounded, phrased more naturally) and falls back to the rule-based
path silently on any failure — this fallback must stay unconditional, the app should never hard-fail
because the AI call failed. The response's `interpretationSource: "ai" | "rules"` field tells the
frontend (and the small UI badge) which path was actually used. The `ai` query param lets the
frontend opt out per-request from the "Advanced settings" panel.

### Deployment
`vercel.json` defines two Vercel services from one repo: `frontend` (root `.`, Next.js) and
`backend` (root `backend`, entrypoint `main:app`), with `/api/*` rewritten to the backend service and
everything else to the frontend. The backend can alternatively be deployed anywhere that runs a
long-lived Python process (Render/Railway/Fly/own server via the included `Procfile`) — Vercel's
serverless functions are a poor fit for `yfinance`/`pandas`.