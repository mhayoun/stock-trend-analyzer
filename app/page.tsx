"use client";

import { useState } from "react";
import { AnalysisResult } from "@/lib/trend";
import { Lang, t } from "@/lib/i18n";
import TrendTape from "@/components/TrendTape";
import PriceChart from "@/components/PriceChart";
import TrendBarChart from "@/components/TrendBarChart";
import HistogramChart from "@/components/HistogramChart";
import StatCard from "@/components/StatCard";
import SummaryTable from "@/components/SummaryTable";
import PostRiseCurveChart from "@/components/PostRiseCurveChart";
import SellVsWaitCard from "@/components/SellVsWaitCard";
import RebuyCard from "@/components/RebuyCard";
import InterpretationBox from "@/components/InterpretationBox";
import LanguageToggle from "@/components/LanguageToggle";

const PRESETS = [
  { label: "90d", days: 90 },
  { label: "6mo", days: 182 },
  { label: "1y", days: 365 },
  { label: "3y", days: 1095 },
  { label: "5y", days: 1825 },
];

export default function Home() {
  const [lang, setLang] = useState<Lang>("en");
  const s = t(lang);

  const [ticker, setTicker] = useState("MBLY");
  const [days, setDays] = useState(1095);
  const [threshold, setThreshold] = useState(10);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sellThreshold, setSellThreshold] = useState(5);
  const [sellTarget, setSellTarget] = useState(10);
  const [rebuyThreshold, setRebuyThreshold] = useState(5);
  const [rebuyDays, setRebuyDays] = useState(20);
  const [aiEnabled, setAiEnabled] = useState(true);

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
      const params = new URLSearchParams({
        ticker: ticker.trim(),
        days: String(days),
        threshold: String(threshold),
        sellThreshold: String(sellThreshold),
        sellTarget: String(sellTarget),
        rebuyThreshold: String(rebuyThreshold),
        rebuyDays: String(rebuyDays),
        ai: String(aiEnabled),
      });
      const res = await fetch(`${apiBase}/api/analyze?${params.toString()}`);
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

  const interp = (key: string) => (result ? result.interpretations[key]?.[lang] ?? "" : "");

  return (
    <main className="min-h-screen bg-ink pb-24">
      {/* Header / command bar */}
      <header className="border-b border-line bg-panel/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber">{s.eyebrow}</p>
              <h1 className="font-display text-2xl font-semibold text-fg sm:text-3xl">{s.title}</h1>
            </div>
            <LanguageToggle lang={lang} onChange={setLang} />
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted">{s.tagline}</p>

          <form onSubmit={runAnalysis} className="mt-5 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="ticker" className="text-[11px] uppercase tracking-wider text-muted">
                {s.tickerLabel}
              </label>
              <input
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder={s.tickerPlaceholder}
                className="w-32 rounded-md border border-line bg-panel2 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-amber"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="days" className="text-[11px] uppercase tracking-wider text-muted">
                {s.daysLabel}
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
                {s.thresholdLabel}
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
              {loading ? s.runningButton : s.runButton}
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

            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="ml-auto rounded-md border border-line px-3 py-2 font-mono text-xs text-muted transition hover:border-muted hover:text-fg"
            >
              {s.advancedToggle} {showAdvanced ? "▲" : "▼"}
            </button>
          </form>

          {showAdvanced && (
            <div className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-line bg-panel2/40 p-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wider text-muted">{s.sellThresholdLabel}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={sellThreshold}
                    onChange={(e) => setSellThreshold(parseFloat(e.target.value || "0"))}
                    className="w-20 rounded-md border border-line bg-panel px-3 py-2 font-mono text-sm text-fg outline-none focus:border-amber"
                  />
                  <span className="text-sm text-muted">%</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wider text-muted">{s.sellTargetLabel}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={sellTarget}
                    onChange={(e) => setSellTarget(parseFloat(e.target.value || "0"))}
                    className="w-20 rounded-md border border-line bg-panel px-3 py-2 font-mono text-sm text-fg outline-none focus:border-amber"
                  />
                  <span className="text-sm text-muted">%</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wider text-muted">{s.rebuyThresholdLabel}</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    value={rebuyThreshold}
                    onChange={(e) => setRebuyThreshold(parseFloat(e.target.value || "0"))}
                    className="w-20 rounded-md border border-line bg-panel px-3 py-2 font-mono text-sm text-fg outline-none focus:border-amber"
                  />
                  <span className="text-sm text-muted">%</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] uppercase tracking-wider text-muted">{s.rebuyDaysLabel}</label>
                <input
                  type="number"
                  min={1}
                  max={250}
                  value={rebuyDays}
                  onChange={(e) => setRebuyDays(parseInt(e.target.value || "0", 10))}
                  className="w-20 rounded-md border border-line bg-panel px-3 py-2 font-mono text-sm text-fg outline-none focus:border-amber"
                />
              </div>

              <label className="ml-auto flex max-w-xs items-start gap-2">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                  className="mt-0.5 accent-amber"
                />
                <span>
                  <span className="block text-xs font-medium text-fg">{s.aiToggleLabel}</span>
                  <span className="block text-[11px] leading-snug text-muted">{s.aiToggleSub}</span>
                </span>
              </label>
            </div>
          )}

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
            <p className="font-mono text-sm">{s.emptyState}</p>
          </div>
        )}

        {loading && (
          <div className="mt-16 text-center text-muted">
            <p className="font-mono text-sm">{s.loadingState}</p>
          </div>
        )}

        {result && !loading && (
          <div className="mt-6 flex flex-col gap-6">
            <TrendTape summary={result.summary} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label={s.statAvgPositive}
                value={fmtPct(result.positiveStats.mean)}
                tone="rise"
                sub={`${result.positiveStats.count} ${s.statStreaksSuffix} · ${fmtNum(result.overallPositiveAvgDuration, 1, "d")} ${s.statAvgSuffix}`}
              />
              <StatCard
                label={s.statAvgNegative}
                value={fmtPct(result.negativeStats.mean)}
                tone="fall"
                sub={`${result.negativeStats.count} ${s.statStreaksSuffix} · ${fmtNum(result.overallNegativeAvgDuration, 1, "d")} ${s.statAvgSuffix}`}
              />
              <StatCard
                label={`${s.statRunsAtLeast} +${result.threshold}%`}
                value={String(result.strongRiseStats.count)}
                tone="amber"
                sub={
                  result.strongRiseStats.count > 0
                    ? `${s.statAvgSuffix} ${fmtNum(result.strongRiseStats.avgDuration, 1, "d")}, ${fmtPct(result.strongRiseStats.avgRise)}`
                    : s.statNoneInWindow
                }
              />
              <StatCard
                label={s.statReversalOdds}
                value={result.reversalProbabilityPct === null ? "—" : `${result.reversalProbabilityPct.toFixed(1)}%`}
                tone="neutral"
                sub={s.statNextSessionNegative}
              />
            </div>

            <InterpretationBox text={interp("overview")} lang={lang} source={result.interpretationSource} />

            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="font-display text-sm font-semibold text-fg">
                {s.sectionPrice} — {result.ticker}
              </h2>
              <PriceChart data={result.priceSeries} />
            </section>

            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="font-display text-sm font-semibold text-fg">{s.sectionTrendStrength}</h2>
              <p className="text-xs text-muted">{s.sectionTrendStrengthSub}</p>
              <TrendBarChart data={result.summary} />
              <InterpretationBox text={interp("strongRise")} lang={lang} source={result.interpretationSource} />
            </section>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <section className="rounded-lg border border-line bg-panel p-4">
                <h2 className="font-display text-sm font-semibold text-rise">{s.sectionPositiveDist}</h2>
                <HistogramChart values={result.summary.filter((r) => r.trendTotal > 0).map((r) => r.trendTotal)} color="#37C77A" />
              </section>
              <section className="rounded-lg border border-line bg-panel p-4">
                <h2 className="font-display text-sm font-semibold text-fall">{s.sectionNegativeDist}</h2>
                <HistogramChart values={result.summary.filter((r) => r.trendTotal < 0).map((r) => r.trendTotal)} color="#FF5C5C" />
              </section>
            </div>

            {/* --- Post-rise performance curves (main.py / main2.py) --- */}
            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="font-display text-sm font-semibold text-fg">{s.sectionPostRise}</h2>
              <p className="text-xs text-muted">{s.sectionPostRiseSub}</p>
              <PostRiseCurveChart curves={result.postRiseCurves} lang={lang} />
              <InterpretationBox text={interp("postRise")} lang={lang} source={result.interpretationSource} />
            </section>

            {/* --- Sell-vs-wait (main.py / main3.py) --- */}
            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="font-display text-sm font-semibold text-fg">{s.sectionSellVsWait}</h2>
              <p className="text-xs text-muted">{s.sectionSellVsWaitSub}</p>
              <div className="mt-3">
                <SellVsWaitCard stats={result.sellVsWait} lang={lang} />
              </div>
              <InterpretationBox text={interp("sellVsWait")} lang={lang} source={result.interpretationSource} />
            </section>

            {/* --- Rebuy after rise (main.py / main4.py) --- */}
            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="font-display text-sm font-semibold text-fg">{s.sectionRebuy}</h2>
              <p className="text-xs text-muted">{s.sectionRebuySub}</p>
              <div className="mt-3">
                <RebuyCard stats={result.rebuyAfterRise} lang={lang} />
              </div>
              <InterpretationBox text={interp("rebuy")} lang={lang} source={result.interpretationSource} />
            </section>

            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="font-display text-sm font-semibold text-fg">{s.sectionAllStreaks}</h2>
              <p className="mb-3 text-xs text-muted">
                {s.sectionAllStreaksSub} {result.summary.length} {s.sectionAllStreaksSuffix}
              </p>
              <SummaryTable rows={result.summary} lang={lang} />
            </section>

            <p className="text-center font-mono text-[11px] text-muted">{s.notFinancialAdvice}</p>
          </div>
        )}
      </div>
    </main>
  );
}
