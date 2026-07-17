"""
FastAPI backend for the Trend Tape stock analyzer.

This is a port of ALL the analyses spread across main.py / main1.py / main2.py /
main3.py / main4.py, wrapped as a single JSON API so the Next.js frontend can
call it instead of doing the fetch + math in a Node serverless function:

  - compute_trend_summary()        -> streak detection (main.py / main1-2.py)
  - positive/negative streak stats -> series_stats()   (main1.py .describe())
  - "strong rise" follow-through    -> strongRiseStats / reversalProbabilityPct
  - analyze_after_rise()           -> postRiseCurves    (main.py / main2.py)
  - analyze_sell_vs_wait()         -> sellVsWait        (main.py / main3.py)
  - analyze_rebuy_after_5()        -> rebuyAfterRise    (main.py / main4.py)

On top of the numbers, it also builds a beginner-friendly interpretation of
every chart/stat, in English and French. If an ANTHROPIC_API_KEY is set, the
wording is generated in real time by calling the Anthropic API for a more
natural, tailored explanation; otherwise it falls back to solid rule-based
templates so the app works fully offline / without a key.

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Then GET http://localhost:8000/api/analyze?ticker=AAPL&days=1095&threshold=10
"""

import json
import math
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import requests
import yfinance as yf
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()
except ImportError:  # pragma: no cover - optional convenience dependency
    pass

app = FastAPI(title="Trend Tape API")

# Wide open by default so the frontend can call this from any deploy URL.
# Tighten this to your actual frontend origin(s) once you have one.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Create a shared requests Session with custom headers to prevent yfinance blocking
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
})

# ==========================
# Optional AI-generated interpretations (Anthropic API)
# ==========================
# If ANTHROPIC_API_KEY isn't set, or the call fails for any reason, the app
# silently falls back to the rule-based interpretations below — the feature
# is a real-time enhancement, never a hard dependency.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")

try:
    import anthropic  # type: ignore

    _anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None
except Exception:  # pragma: no cover - library not installed / import error
    anthropic = None  # type: ignore
    _anthropic_client = None


# ==========================
# Core algorithm (ported from main.py)
# ==========================

def compute_trend_summary(df: pd.DataFrame, column: str = "Variation %") -> pd.DataFrame:
    rows = []

    values = df[column].fillna(0).tolist()
    dates = df.index.tolist()

    i = 0
    while i < len(values):
        total = values[i]
        days = 1
        sign = values[i] >= 0

        j = i + 1
        while j < len(values):
            if (values[j] >= 0) == sign:
                total += values[j]
                days += 1
                j += 1
            else:
                break

        rows.append(
            {
                "Date": dates[i],
                "Close": df.iloc[i]["Close"],
                "Variation %": values[i],
                "Trend Total %": total,
                "Trend Days": days,
            }
        )

        i = j

    return pd.DataFrame(rows).set_index("Date")


# ==========================
# Tactical / momentum analyses (ported from main.py, main2/3/4.py)
# ==========================

def analyze_after_rise(hist: pd.DataFrame, summary: pd.DataFrame, threshold: float = 10.0, days_after: int = 10) -> pd.DataFrame:
    """Average day-by-day performance in the `days_after` sessions following
    the END of a streak whose total move was >= threshold. (main.py / main2.py)
    """
    results = []
    strong = summary[summary["Trend Total %"] >= threshold]

    for date in strong.index:
        position = hist.index.get_loc(date)
        trend_end = position + int(strong.loc[date, "Trend Days"])
        future = hist.iloc[trend_end: trend_end + days_after]

        if len(future) == days_after:
            start_price = hist.iloc[trend_end - 1]["Close"]
            curve = []
            for _, row in future.iterrows():
                variation = ((row["Close"] - start_price) / start_price) * 100
                curve.append(variation)
            results.append(curve)

    return pd.DataFrame(results)


def analyze_sell_vs_wait(summary: pd.DataFrame, threshold_sell: float = 5.0, target: float = 10.0) -> pd.DataFrame:
    """Of the streaks that reached at least +threshold_sell%, how many went
    on to reach +target% within that same streak? (main.py / main3.py)
    """
    results = []
    for date, row in summary.iterrows():
        trend = row["Trend Total %"]
        if trend >= threshold_sell:
            results.append({
                "Date": date,
                "Maximum reached": trend,
                "Target reached": trend >= target,
            })
    return pd.DataFrame(results)


def analyze_rebuy_after_5(hist: pd.DataFrame, summary: pd.DataFrame, threshold: float = 5.0, days_after: int = 20) -> pd.DataFrame:
    """After a streak reaches at least +threshold%, how far does the price
    pull back over the following `days_after` sessions, and how many days
    does that pullback take to bottom out? (main.py / main4.py)
    """
    results = []
    for date, row in summary.iterrows():
        if row["Trend Total %"] >= threshold:
            position = hist.index.get_loc(date)
            sell_price = hist.iloc[position]["Close"]
            future = hist.iloc[position + 1: position + 1 + days_after]

            if len(future) > 0:
                min_price = future["Close"].min()
                min_date = future["Close"].idxmin()
                drop = ((min_price - sell_price) / sell_price) * 100
                days_wait = future.index.get_loc(min_date) + 1

                results.append({
                    "Sell date": date,
                    "Sell price": float(sell_price),
                    "Best rebuy date": min_date,
                    "Rebuy price": float(min_price),
                    "Drop %": drop,
                    "Waiting days": days_wait,
                })
    return pd.DataFrame(results)


def series_stats(values: pd.Series) -> dict:
    n = len(values)
    if n == 0:
        return {"count": 0, "mean": None, "std": None, "min": None, "max": None}
    return {
        "count": int(n),
        "mean": float(values.mean()),
        "std": float(values.std()) if n > 1 else 0.0,
        "min": float(values.min()),
        "max": float(values.max()),
    }


def clean(v):
    """Replace NaN/inf with None so it serializes to valid JSON."""
    if v is None:
        return None
    if isinstance(v, (int, float)) and (math.isnan(v) or math.isinf(v)):
        return None
    return v


# ==========================
# Beginner-friendly interpretations (rule-based, always available)
# ==========================

def _fmt_pct(v: Optional[float], digits: int = 1) -> str:
    if v is None:
        return "n/a"
    sign = "+" if v > 0 else ""
    return f"{sign}{v:.{digits}f}%"


def rule_based_interpretations(snap: dict) -> Dict[str, Dict[str, str]]:
    ticker = snap["ticker"]
    pos = snap["positiveStats"]
    neg = snap["negativeStats"]
    strong = snap["strongRiseStats"]
    threshold = snap["threshold"]
    reversal = snap["reversalProbabilityPct"]
    post_rise = snap["postRiseCurves"]
    sell_vs_wait = snap["sellVsWait"]
    rebuy = snap["rebuyAfterRise"]

    out: Dict[str, Dict[str, str]] = {}

    # --- Overview: positive vs negative streaks ---
    out["overview"] = {
        "en": (
            f"{ticker} has had {pos['count']} winning streaks (days moving up in a row) and "
            f"{neg['count']} losing streaks over this period. On average, a winning streak added "
            f"{_fmt_pct(pos['mean'])} before it ended, and a losing streak lost {_fmt_pct(neg['mean'])}. "
            "This just tells you the typical size of an up-move or down-move before the direction flips — "
            "it isn't a prediction of what happens next."
        ),
        "fr": (
            f"{ticker} a connu {pos['count']} séries haussières (jours consécutifs de hausse) et "
            f"{neg['count']} séries baissières sur cette période. En moyenne, une série haussière ajoutait "
            f"{_fmt_pct(pos['mean'])} avant de s'arrêter, et une série baissière perdait {_fmt_pct(neg['mean'])}. "
            "Cela indique simplement l'ampleur habituelle d'un mouvement avant qu'il ne s'inverse — "
            "ce n'est pas une prédiction de ce qui va se passer ensuite."
        ),
    }

    # --- Strong rise + reversal ---
    if strong["count"] > 0:
        out["strongRise"] = {
            "en": (
                f"There were {strong['count']} streaks of at least {_fmt_pct(threshold, 0)}, lasting "
                f"{strong['avgDuration']:.1f} days on average and totaling {_fmt_pct(strong['avgRise'])}. "
                f"After a streak like that, the very next trading day was negative {reversal:.0f}% of the time "
                "in this history. A high number here is sometimes read as 'stretched and due for a pause,' but "
                f"it's a historical frequency for {ticker} specifically, not a rule that applies to every stock "
                "or every future move."
            ),
            "fr": (
                f"On compte {strong['count']} séries d'au moins {_fmt_pct(threshold, 0)}, durant en moyenne "
                f"{strong['avgDuration']:.1f} jours pour un total de {_fmt_pct(strong['avgRise'])}. "
                f"Après une telle série, le jour de bourse suivant a été négatif {reversal:.0f}% du temps "
                "dans cet historique. Un chiffre élevé est parfois interprété comme 'le titre est tendu et "
                f"pourrait souffler', mais c'est une fréquence historique propre à {ticker}, pas une règle "
                "valable pour toutes les actions ou pour l'avenir."
            ),
        }
    else:
        out["strongRise"] = {
            "en": (
                f"No streak in this window reached the {_fmt_pct(threshold, 0)} threshold, so there's nothing "
                "to measure a next-day reversal against yet. Try a lower threshold or a longer time window."
            ),
            "fr": (
                f"Aucune série sur cette période n'a atteint le seuil de {_fmt_pct(threshold, 0)}, il n'y a donc "
                "rien à mesurer pour l'instant côté retournement du lendemain. Essayez un seuil plus bas ou une "
                "période plus longue."
            ),
        }

    # --- Post-rise performance curves ---
    curve_bits_en, curve_bits_fr = [], []
    for th_key in sorted(post_rise.keys(), key=lambda k: float(k)):
        c = post_rise[th_key]
        if c["count"] > 0 and c["avgCurve"]:
            d10 = c["avgCurve"][-1]
            curve_bits_en.append(f"after +{th_key}% (n={c['count']}), the average drift 10 days later was {_fmt_pct(d10)}")
            curve_bits_fr.append(f"après +{th_key}% (n={c['count']}), la dérive moyenne 10 jours plus tard était de {_fmt_pct(d10)}")
    out["postRise"] = {
        "en": (
            "This chart follows the price for 10 trading days after a strong run-up ends, to see whether "
            "momentum tends to continue, stall, or reverse. " + ("; ".join(curve_bits_en) + "." if curve_bits_en else
            "There weren't enough qualifying streaks with a full 10-day follow-up window in this history.")
        ),
        "fr": (
            "Ce graphique suit le cours pendant 10 séances après la fin d'une forte hausse, pour voir si "
            "l'élan a tendance à se poursuivre, stagner ou s'inverser. " + ("; ".join(curve_bits_fr) + "." if curve_bits_fr else
            "Il n'y a pas eu assez de séries qualifiées avec une fenêtre complète de 10 jours dans cet historique.")
        ),
    }

    # --- Sell vs wait ---
    if sell_vs_wait["count"] > 0:
        out["sellVsWait"] = {
            "en": (
                f"Out of {sell_vs_wait['count']} times {ticker} moved at least {_fmt_pct(sell_vs_wait['thresholdPct'], 0)}, "
                f"it went on to double that into a {_fmt_pct(sell_vs_wait['targetPct'], 0)} move "
                f"{sell_vs_wait['pctReachingTarget']:.0f}% of the time, with an average peak of "
                f"{_fmt_pct(sell_vs_wait['avgMaxReached'])}. This is a simple 'sell early vs. hold for more' "
                "comparison based on what actually happened historically — it doesn't account for taxes, fees, "
                "or how you'd feel holding through the swings."
            ),
            "fr": (
                f"Sur {sell_vs_wait['count']} fois où {ticker} a progressé d'au moins {_fmt_pct(sell_vs_wait['thresholdPct'], 0)}, "
                f"le mouvement a doublé jusqu'à {_fmt_pct(sell_vs_wait['targetPct'], 0)} dans "
                f"{sell_vs_wait['pctReachingTarget']:.0f}% des cas, avec un sommet moyen de "
                f"{_fmt_pct(sell_vs_wait['avgMaxReached'])}. C'est une comparaison simple 'vendre tôt vs. attendre "
                "plus' basée sur ce qui s'est réellement passé — cela ne tient pas compte des impôts, des frais, "
                "ni du ressenti émotionnel de traverser les creux."
            ),
        }
    else:
        out["sellVsWait"] = {
            "en": "No streak reached the sell threshold in this window, so there's no sell-vs-wait comparison to show.",
            "fr": "Aucune série n'a atteint le seuil de vente sur cette période, il n'y a donc pas de comparaison à afficher.",
        }

    # --- Rebuy after rise ---
    if rebuy["count"] > 0:
        out["rebuy"] = {
            "en": (
                f"After the {rebuy['count']} times {ticker} rose at least {_fmt_pct(rebuy['thresholdPct'], 0)}, the price "
                f"pulled back by an average of {_fmt_pct(rebuy['avgDropPct'])} within the next {rebuy['daysAfter']} days, "
                f"typically bottoming out around day {rebuy['avgWaitingDays']:.1f}. Some traders use this to gauge "
                "whether 'buying the dip' after strength has historically offered a better entry — again, this is "
                "a backward-looking pattern, not a guarantee of a future pullback."
            ),
            "fr": (
                f"Après les {rebuy['count']} fois où {ticker} a monté d'au moins {_fmt_pct(rebuy['thresholdPct'], 0)}, le cours "
                f"a reculé en moyenne de {_fmt_pct(rebuy['avgDropPct'])} dans les {rebuy['daysAfter']} jours suivants, "
                f"touchant généralement son point bas vers le jour {rebuy['avgWaitingDays']:.1f}. Certains s'en servent "
                "pour juger si 'racheter le creux' après une hausse a historiquement offert un meilleur point d'entrée — "
                "encore une fois, c'est un constat rétrospectif, pas une garantie pour l'avenir."
            ),
        }
    else:
        out["rebuy"] = {
            "en": "No streak reached the rebuy threshold in this window, so there's no pullback pattern to show.",
            "fr": "Aucune série n'a atteint le seuil de rachat sur cette période, il n'y a donc pas de repli à afficher.",
        }

    return out


def ai_interpretations(snap: dict) -> Optional[Dict[str, Dict[str, str]]]:
    """Ask the Anthropic API to phrase the same numbers in a warmer,
    beginner-friendly voice, in both English and French, grounded strictly
    in the provided stats. Returns None (caller falls back to rule-based
    text) if no API key is configured or anything goes wrong.
    """
    if _anthropic_client is None:
        return None

    sections = ["overview", "strongRise", "postRise", "sellVsWait", "rebuy"]
    prompt = f"""You are a patient financial-literacy educator writing for a complete beginner
investor who has never looked at a stock chart before. You will be given a JSON
snapshot of a purely historical, backward-looking streak analysis for one stock.

Write a short (2-4 sentence) plain-language interpretation for each of these
sections: {sections}. Rules:
- Use ONLY the numbers given below; never invent figures.
- Plain, warm, jargon-free language a novice can follow.
- Make clear this describes the past, not a prediction, and is not financial advice.
- Provide both an "en" (English) and "fr" (French) version of every section.
- Respond with ONLY a raw JSON object shaped like:
  {{"overview": {{"en": "...", "fr": "..."}}, "strongRise": {{"en": "...", "fr": "..."}}, "postRise": {{"en": "...", "fr": "..."}}, "sellVsWait": {{"en": "...", "fr": "..."}}, "rebuy": {{"en": "...", "fr": "..."}}}}
  No markdown fences, no preamble, no commentary outside the JSON.

Stats snapshot:
{json.dumps(snap, default=str)}
"""

    try:
        response = _anthropic_client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=1400,
            messages=[{"role": "user", "content": prompt}],
        )
        text_parts = [block.text for block in response.content if getattr(block, "type", None) == "text"]
        raw = "".join(text_parts).strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        parsed = json.loads(raw)
        # Basic shape check so a malformed AI response never crashes the endpoint.
        if all(isinstance(parsed.get(s), dict) and "en" in parsed[s] and "fr" in parsed[s] for s in sections):
            return parsed
        return None
    except Exception:
        return None


def build_snapshot(
    ticker: str,
    threshold: float,
    positive_stats: dict,
    negative_stats: dict,
    strong_rise_stats: dict,
    reversal_probability: Optional[float],
    post_rise_curves: dict,
    sell_vs_wait: dict,
    rebuy_after_rise: dict,
) -> dict:
    return {
        "ticker": ticker,
        "threshold": threshold,
        "positiveStats": positive_stats,
        "negativeStats": negative_stats,
        "strongRiseStats": strong_rise_stats,
        "reversalProbabilityPct": reversal_probability,
        "postRiseCurves": post_rise_curves,
        "sellVsWait": sell_vs_wait,
        "rebuyAfterRise": rebuy_after_rise,
    }


# ==========================
# API
# ==========================

class TrendRow(BaseModel):
    date: str
    close: float
    variation: float
    trendTotal: float
    trendDays: int


class Stats(BaseModel):
    count: int
    mean: Optional[float]
    std: Optional[float]
    min: Optional[float]
    max: Optional[float]


class StrongRiseStats(BaseModel):
    avgDuration: Optional[float]
    avgRise: Optional[float]
    count: int


class PricePoint(BaseModel):
    date: str
    close: float


class PostRiseCurve(BaseModel):
    thresholdPct: float
    count: int
    avgCurve: List[float]  # day 1..N average % drift, empty if count == 0


class SellVsWaitStats(BaseModel):
    thresholdPct: float
    targetPct: float
    count: int
    pctReachingTarget: Optional[float]
    avgMaxReached: Optional[float]


class RebuyStats(BaseModel):
    thresholdPct: float
    daysAfter: int
    count: int
    avgDropPct: Optional[float]
    avgWaitingDays: Optional[float]


class Interpretation(BaseModel):
    en: str
    fr: str


class AnalysisResult(BaseModel):
    ticker: str
    days: int
    threshold: float
    priceSeries: List[PricePoint]
    summary: List[TrendRow]
    positiveStats: Stats
    negativeStats: Stats
    strongRises: List[TrendRow]
    strongRiseStats: StrongRiseStats
    reversalProbabilityPct: Optional[float]
    overallPositiveAvgDuration: Optional[float]
    overallNegativeAvgDuration: Optional[float]
    postRiseCurves: Dict[str, PostRiseCurve]
    sellVsWait: SellVsWaitStats
    rebuyAfterRise: RebuyStats
    interpretations: Dict[str, Interpretation]
    interpretationSource: str  # "ai" | "rules"


@app.get("/api/analyze", response_model=AnalysisResult)
def analyze(
    ticker: str = Query(..., min_length=1),
    days: int = Query(1095, ge=10, le=3650),
    threshold: float = Query(10.0, gt=0),
    sellThreshold: float = Query(5.0, gt=0),
    sellTarget: float = Query(10.0, gt=0),
    rebuyThreshold: float = Query(5.0, gt=0),
    rebuyDays: int = Query(20, ge=1, le=250),
    ai: bool = Query(True, description="Try an AI-generated interpretation before falling back to rule-based text."),
):
    ticker = ticker.strip().upper()

    # Pad the requested window so weekends/holidays don't shrink the
    # number of trading days we end up with. Use modern UTC timezone syntax.
    start = datetime.now(timezone.utc) - timedelta(days=math.ceil(days * 1.6) + 5)

    try:
        # Pass the configured session directly to Ticker to bypass scraping blocks
        ticker_obj = yf.Ticker(ticker, session=session)
        raw = ticker_obj.history(start=start, interval="1d")
    except Exception as exc:  # yfinance raises a mix of exception types
        raise HTTPException(status_code=502, detail=f"Failed to fetch data for \"{ticker}\": {exc}")

    if raw is None or raw.empty:
        raise HTTPException(status_code=422, detail=f"No data returned for \"{ticker}\". Check the ticker symbol.")

    hist = raw.copy()
    hist["Variation %"] = hist["Close"].pct_change() * 100
    hist = hist.dropna(subset=["Variation %"])

    if len(hist) < 2:
        raise HTTPException(status_code=422, detail=f"Not enough trading data for \"{ticker}\" in that window.")

    # Trim to the requested number of most recent trading days.
    hist = hist.iloc[-days:]

    # Newest date first, same as main.py.
    hist = hist.sort_index(ascending=False)

    summary = compute_trend_summary(hist)

    positive = summary[summary["Trend Total %"] > 0]
    negative = summary[summary["Trend Total %"] < 0]

    strong_rises = summary[summary["Trend Total %"] >= threshold]

    avg_duration = float(strong_rises["Trend Days"].mean()) if len(strong_rises) > 0 else None
    avg_rise = float(strong_rises["Trend Total %"].mean()) if len(strong_rises) > 0 else None

    # Reversal check: for each strong-rise start date, look at the adjacent
    # row in the descending-sorted series — identical indexing to main.py.
    reversals = 0
    for date in strong_rises.index:
        position = hist.index.get_loc(date)
        if position + 1 < len(hist):
            next_day_variation = hist.iloc[position + 1]["Variation %"]
            if next_day_variation < 0:
                reversals += 1

    reversal_probability = (reversals / len(strong_rises) * 100) if len(strong_rises) > 0 else None

    overall_positive_avg_duration = float(positive["Trend Days"].mean()) if len(positive) > 0 else None
    overall_negative_avg_duration = float(negative["Trend Days"].mean()) if len(negative) > 0 else None

    # --- Post-rise performance curves at +5% / +10% / +15% (main.py / main2.py) ---
    post_rise_curves: Dict[str, dict] = {}
    for th in (5.0, 10.0, 15.0):
        curve_df = analyze_after_rise(hist, summary, threshold=th, days_after=10)
        avg_curve = [clean(float(x)) for x in curve_df.mean().tolist()] if len(curve_df) > 0 else []
        post_rise_curves[str(int(th))] = {
            "thresholdPct": th,
            "count": int(len(curve_df)),
            "avgCurve": avg_curve,
        }

    # --- Sell vs wait: does +5% go on to double into +10%? (main.py / main3.py) ---
    sell_vs_wait_df = analyze_sell_vs_wait(summary, threshold_sell=sellThreshold, target=sellTarget)
    sell_vs_wait = {
        "thresholdPct": sellThreshold,
        "targetPct": sellTarget,
        "count": int(len(sell_vs_wait_df)),
        "pctReachingTarget": clean(float(sell_vs_wait_df["Target reached"].mean() * 100)) if len(sell_vs_wait_df) > 0 else None,
        "avgMaxReached": clean(float(sell_vs_wait_df["Maximum reached"].mean())) if len(sell_vs_wait_df) > 0 else None,
    }

    # --- Rebuy after a rise: pullback depth + timing (main.py / main4.py) ---
    rebuy_df = analyze_rebuy_after_5(hist, summary, threshold=rebuyThreshold, days_after=rebuyDays)
    rebuy_after_rise = {
        "thresholdPct": rebuyThreshold,
        "daysAfter": rebuyDays,
        "count": int(len(rebuy_df)),
        "avgDropPct": clean(float(rebuy_df["Drop %"].mean())) if len(rebuy_df) > 0 else None,
        "avgWaitingDays": clean(float(rebuy_df["Waiting days"].mean())) if len(rebuy_df) > 0 else None,
    }

    def row_to_dict(idx, row) -> dict:
        return {
            "date": idx.strftime("%Y-%m-%d"),
            "close": clean(float(row["Close"])),
            "variation": clean(float(row["Variation %"])),
            "trendTotal": clean(float(row["Trend Total %"])),
            "trendDays": int(row["Trend Days"]),
        }

    price_series = [
        {"date": idx.strftime("%Y-%m-%d"), "close": clean(float(close))}
        for idx, close in hist.sort_index(ascending=True)["Close"].items()
    ]

    positive_stats = series_stats(positive["Trend Total %"])
    negative_stats = series_stats(negative["Trend Total %"])
    strong_rise_stats = {
        "avgDuration": clean(avg_duration),
        "avgRise": clean(avg_rise),
        "count": int(len(strong_rises)),
    }

    snapshot = build_snapshot(
        ticker=ticker,
        threshold=threshold,
        positive_stats=positive_stats,
        negative_stats=negative_stats,
        strong_rise_stats=strong_rise_stats,
        reversal_probability=clean(reversal_probability),
        post_rise_curves=post_rise_curves,
        sell_vs_wait=sell_vs_wait,
        rebuy_after_rise=rebuy_after_rise,
    )

    interpretations = None
    interpretation_source = "rules"
    if ai:
        interpretations = ai_interpretations(snapshot)
        if interpretations is not None:
            interpretation_source = "ai"
    if interpretations is None:
        interpretations = rule_based_interpretations(snapshot)
        interpretation_source = "rules"

    return {
        "ticker": ticker,
        "days": days,
        "threshold": threshold,
        "priceSeries": price_series,
        "summary": [row_to_dict(idx, row) for idx, row in summary.iterrows()],
        "positiveStats": positive_stats,
        "negativeStats": negative_stats,
        "strongRises": [row_to_dict(idx, row) for idx, row in strong_rises.iterrows()],
        "strongRiseStats": strong_rise_stats,
        "reversalProbabilityPct": clean(reversal_probability),
        "overallPositiveAvgDuration": clean(overall_positive_avg_duration),
        "overallNegativeAvgDuration": clean(overall_negative_avg_duration),
        "postRiseCurves": post_rise_curves,
        "sellVsWait": sell_vs_wait,
        "rebuyAfterRise": rebuy_after_rise,
        "interpretations": interpretations,
        "interpretationSource": interpretation_source,
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "aiConfigured": _anthropic_client is not None}
