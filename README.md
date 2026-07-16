# Trend Tape — Stock Trend Analyzer

A web version of the `main.py` trend-streak analysis: pick a ticker and a
number of trading days, and it groups the daily closes into consecutive
same-direction streaks, then shows their distribution, strong run-up
follow-through, and next-day reversal odds.

**Two services:**

- **`/backend`** — a FastAPI app that ports `main.py` almost line-for-line
  (`compute_trend_summary`, the streak stats, the "strong rise" analysis,
  the reversal check) and serves it as JSON, using `yfinance` — same data
  library your script already used.
- **frontend (repo root)** — a Next.js app that calls the backend and
  renders the results (trend tape, price chart, streak-strength chart,
  distribution histograms, full streak table).

They're separate because `yfinance` + `pandas` don't fit comfortably in a
Vercel serverless function, and running your own small Python service also
sidesteps the aggressive bot-blocking that Yahoo/Stooq apply to plain
unauthenticated fetches from cloud IPs — your `main.py` presumably already
works from wherever you run it, so this reuses that same working path.

## How it maps to `main.py`

| main.py | This app |
|---|---|
| `yf.Ticker(...).history(...)` | `backend/main.py` → `analyze()`, same call |
| `compute_trend_summary()` | `backend/main.py` → `compute_trend_summary()` (near-verbatim port) |
| positive/negative trend `.describe()` | `series_stats()` → stat cards + histograms on the page |
| "after +10% rise" analysis | the "strong-rise threshold" input + stat card |
| reversal probability loop | same loop, ported directly, in `analyze()` |
| `plt.hist(...)` charts | `HistogramChart` (recharts, client-side) |
| price / trend-strength charts | `PriceChart`, `TrendBarChart` |
| printed summary table | `SummaryTable` |

## Run locally

**1. Backend**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Check it directly: `http://localhost:8000/api/analyze?ticker=AAPL&days=365&threshold=10`

**2. Frontend**

```bash
npm install
cp .env.local.example .env.local   # already points at http://localhost:8000
npm run dev
```

Open http://localhost:3000, enter a ticker, days, and threshold, and run.

## Deploy

**Backend** — anywhere that runs a long-lived Python process (Vercel's
serverless functions aren't a great fit for `yfinance`/`pandas`):

- **Render**: New → Web Service → point at this repo, root directory
  `backend`, build command `pip install -r requirements.txt`, start command
  `uvicorn main:app --host 0.0.0.0 --port $PORT` (or just use the included
  `Procfile`). Free tier works fine for personal use.
- **Railway** / **Fly.io**: same idea — Python 3.11+, install
  `requirements.txt`, run the same start command.
- **Your own server**: `uvicorn main:app --host 0.0.0.0 --port 8000` behind
  nginx/Caddy, or `gunicorn -k uvicorn.workers.UvicornWorker main:app`.

**Frontend** — Vercel, as originally planned:

1. Push the repo, import it in Vercel (root directory = repo root, *not*
   `backend`).
2. Set an environment variable `NEXT_PUBLIC_API_URL` to your deployed
   backend's URL (e.g. `https://your-backend.onrender.com`).
3. Deploy — it's a static Next.js app that calls the backend directly from
   the browser.

## Notes

- **CORS** is wide open (`allow_origins=["*"]`) in `backend/main.py` for
  simplicity. Once you have a fixed frontend URL, narrow it to that origin.
- **Days window**: bounded to 10–3650 trading days in `backend/main.py`.
- **Strong-rise threshold**: defaults to 10% (same as `main.py`), editable per-run.
- **Design tokens** (colors/fonts) live in `tailwind.config.ts` and
  `app/globals.css` if you want to reskin it.
- If `yfinance` itself starts failing for you (Yahoo changes shape
  occasionally), that's isolated to `backend/main.py` — the frontend just
  consumes whatever JSON shape `AnalysisResult` in `lib/trend.ts` describes,
  so you can swap in another data source there without touching the UI.
