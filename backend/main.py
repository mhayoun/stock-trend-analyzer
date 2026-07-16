"""
FastAPI backend for the Trend Tape stock analyzer.

This is a direct port of the analysis in main.py (compute_trend_summary and
everything downstream: positive/negative streak stats, the "strong rise"
follow-through check, and the next-day reversal probability), wrapped as a
JSON API so the Next.js frontend can call it instead of doing the fetch +
math in a Node serverless function.

Run locally:
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8000

Then GET http://localhost:8000/api/analyze?ticker=AAPL&days=1095&threshold=10
"""

import math
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import numpy as np
import pandas as pd
import requests
import yfinance as yf
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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


@app.get("/api/analyze", response_model=AnalysisResult)
def analyze(
    ticker: str = Query(..., min_length=1),
    days: int = Query(1095, ge=10, le=3650),
    threshold: float = Query(10.0, gt=0),
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

    return {
        "ticker": ticker,
        "days": days,
        "threshold": threshold,
        "priceSeries": price_series,
        "summary": [row_to_dict(idx, row) for idx, row in summary.iterrows()],
        "positiveStats": series_stats(positive["Trend Total %"]),
        "negativeStats": series_stats(negative["Trend Total %"]),
        "strongRises": [row_to_dict(idx, row) for idx, row in strong_rises.iterrows()],
        "strongRiseStats": {
            "avgDuration": clean(avg_duration),
            "avgRise": clean(avg_rise),
            "count": int(len(strong_rises)),
        },
        "reversalProbabilityPct": clean(reversal_probability),
        "overallPositiveAvgDuration": clean(overall_positive_avg_duration),
        "overallNegativeAvgDuration": clean(overall_negative_avg_duration),
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}
