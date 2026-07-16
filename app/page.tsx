"use client";

import { useState } from "react";
import { AnalysisResult } from "@/lib/trend";
import TrendTape from "@/components/TrendTape";
import PriceChart from "@/components/PriceChart";
import TrendBarChart from "@/components/TrendBarChart";
import HistogramChart from "@/components/HistogramChart";
import StatCard from "@/components/StatCard";
import SummaryTable from "@/components/SummaryTable";

const PRESETS = [
  { label: "90d", days: 90 },
  { label: "6mo", days: 182 },
  { label: "1y", days: 365 },
  { label: "3y", days: 1095 },
  { label: "5y", days: 1825 },
];

export default function Home() {
  const [ticker, setTicker] = useState("MBLY");
  const [days, setDays] = useState(1095);
  const [threshold, setThreshold] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  async function runAnalysis(e?: React.FormEvent) {
    e?.preventDefault();
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(
        `${apiBase}/api/analyze?ticker=${encodeURIComponent(ticker.trim())}&days=${days}&threshold=${threshold}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Something went wrong.");
      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const fmtPct = (v: number | null, digits = 2) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`);
  const fmtNum = (v: number | null, digits = 2, suffix = "") =>
    v === null ? "—" : `${v.toFixed(digits)}${suffix}`;

  return (
    <main className="min-h-screen bg-ink pb-24">
      {/* Header / command bar */}
      <header className="border-b border-line bg-panel/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber">Streak analysis</p>
          <h1 className="font-display text-2xl font-semibold text-fg sm:text-3xl">Trend Tape</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Groups a stock&apos;s daily closes into consecutive same-direction streaks, then shows how those
            streaks distribute — and what tends to follow a strong run-up.
          </p>

          <form onSubmit={runAnalysis} className="mt-5 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="ticker" className="text-[11px] uppercase tracking-wider text-muted">
                Ticker
              </label>
              <input
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
                className="w-32 rounded-md border border-line bg-panel2 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-amber"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="days" className="text-[11px] uppercase tracking-wider text-muted">
                Trading days
              </label>
              <input
                id="days"
                type="number"
                min={10}
                max={3650}
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value || "0", 10))}
                className="w-28 rounded-md border border-line bg-panel2 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-amber"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="threshold" className="text-[11px] uppercase tracking-wider text-muted">
                Strong-rise threshold
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="threshold"
                  type="number"
                  min={1}
                  step={0.5}
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value || "0"))}
                  className="w-20 rounded-md border border-line bg-panel2 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-amber"
                />
                <span className="text-sm text-muted">%</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-amber px-5 py-2 font-display text-sm font-semibold text-ink transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? "Running…" : "Run analysis"}
            </button>

            <div className="flex flex-wrap gap-1.5 pb-0.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDays(p.days)}
                  className={`rounded-full border px-3 py-1 font-mono text-xs transition ${
                    days === p.days
                      ? "border-amber text-amber"
                      : "border-line text-muted hover:border-muted hover:text-fg"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </form>

          {error && (
            <p className="mt-3 rounded-md border border-fall/40 bg-fall/10 px-3 py-2 font-mono text-xs text-fall">
              {error}
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {!result && !loading && !error && (
          <div className="mt-16 text-center text-muted">
            <p className="font-mono text-sm">Enter a ticker and run the analysis to see the tape.</p>
          </div>
        )}

        {loading && (
          <div className="mt-16 text-center text-muted">
            <p className="font-mono text-sm">Fetching history and computing streaks…</p>
          </div>
        )}

        {result && !loading && (
          <div className="mt-6 flex flex-col gap-6">
            <TrendTape summary={result.summary} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Avg positive streak"
                value={fmtPct(result.positiveStats.mean)}
                tone="rise"
                sub={`${result.positiveStats.count} streaks · ${fmtNum(result.overallPositiveAvgDuration, 1, "d")} avg`}
              />
              <StatCard
                label="Avg negative streak"
                value={fmtPct(result.negativeStats.mean)}
                tone="fall"
                sub={`${result.negativeStats.count} streaks · ${fmtNum(result.overallNegativeAvgDuration, 1, "d")} avg`}
              />
              <StatCard
                label={`Runs ≥ +${result.threshold}%`}
                value={String(result.strongRiseStats.count)}
                tone="amber"
                sub={
                  result.strongRiseStats.count > 0
                    ? `avg ${fmtNum(result.strongRiseStats.avgDuration, 1, "d")}, ${fmtPct(result.strongRiseStats.avgRise)}`
                    : "none in this window"
                }
              />
              <StatCard
                label="Reversal odds after"
                value={result.reversalProbabilityPct === null ? "—" : `${result.reversalProbabilityPct.toFixed(1)}%`}
                tone="neutral"
                sub="next session negative"
              />
            </div>

            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="font-display text-sm font-semibold text-fg">Price — {result.ticker}</h2>
              <PriceChart data={result.priceSeries} />
            </section>

            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="font-display text-sm font-semibold text-fg">Trend strength by streak</h2>
              <p className="text-xs text-muted">Total % move of each streak, plotted on its start date.</p>
              <TrendBarChart data={result.summary} />
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <section className="rounded-lg border border-line bg-panel p-4">
                <h2 className="font-display text-sm font-semibold text-rise">Positive streak distribution</h2>
                <HistogramChart values={result.summary.filter((r) => r.trendTotal > 0).map((r) => r.trendTotal)} color="#37C77A" />
              </section>
              <section className="rounded-lg border border-line bg-panel p-4">
                <h2 className="font-display text-sm font-semibold text-fall">Negative streak distribution</h2>
                <HistogramChart values={result.summary.filter((r) => r.trendTotal < 0).map((r) => r.trendTotal)} color="#FF5C5C" />
              </section>
            </div>

            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="font-display text-sm font-semibold text-fg">All streaks</h2>
              <p className="mb-3 text-xs text-muted">Newest first — {result.summary.length} streaks total.</p>
              <SummaryTable rows={result.summary} />
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
