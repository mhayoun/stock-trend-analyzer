// Shared types for the analysis result returned by the FastAPI backend
// (backend/main.py), plus a small client-side helper for histogram
// binning used by the distribution charts.

export interface TrendRow {
  date: string;
  close: number;
  variation: number;
  trendTotal: number;
  trendDays: number;
}

export interface Stats {
  count: number;
  mean: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
}

export interface PostRiseCurve {
  thresholdPct: number;
  count: number;
  avgCurve: number[]; // day 1..N average % drift, [] if count === 0
}

export interface SellVsWaitStats {
  thresholdPct: number;
  targetPct: number;
  count: number;
  pctReachingTarget: number | null;
  avgMaxReached: number | null;
}

export interface RebuyStats {
  thresholdPct: number;
  daysAfter: number;
  count: number;
  avgDropPct: number | null;
  avgWaitingDays: number | null;
}

export interface Interpretation {
  en: string;
  fr: string;
}

export interface AnalysisResult {
  ticker: string;
  days: number;
  threshold: number;
  priceSeries: { date: string; close: number }[];
  summary: TrendRow[]; // descending (newest first)
  positiveStats: Stats;
  negativeStats: Stats;
  strongRises: TrendRow[];
  strongRiseStats: { avgDuration: number | null; avgRise: number | null; count: number };
  reversalProbabilityPct: number | null;
  overallPositiveAvgDuration: number | null;
  overallNegativeAvgDuration: number | null;
  postRiseCurves: Record<string, PostRiseCurve>; // keys "5" | "10" | "15"
  sellVsWait: SellVsWaitStats;
  rebuyAfterRise: RebuyStats;
  interpretations: Record<string, Interpretation>; // overview, strongRise, postRise, sellVsWait, rebuy
  interpretationSource: "ai" | "rules";
}

// Simple histogram binning for the distribution charts.
export function histogramBins(values: number[], binCount = 20) {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ label: min.toFixed(1), count: values.length, x0: min, x1: max }];
  }
  const width = (max - min) / binCount;
  const bins = Array.from({ length: binCount }, (_, i) => ({
    x0: min + i * width,
    x1: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count += 1;
  }
  return bins.map((b) => ({
    label: `${b.x0.toFixed(1)}`,
    count: b.count,
    x0: b.x0,
    x1: b.x1,
  }));
}
