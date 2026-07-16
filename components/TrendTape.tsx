"use client";

import { TrendRow } from "@/lib/trend";
import { useMemo, useState } from "react";

// Signature visual: each same-direction streak becomes one bar.
// Bar WIDTH encodes how many days the streak ran; bar HEIGHT encodes how
// far it moved. Read left-to-right in calendar order, it reads like a
// seismograph of the stock's momentum.
export default function TrendTape({ summary }: { summary: TrendRow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const chrono = useMemo(() => [...summary].reverse(), [summary]);

  const maxMove = Math.max(1, ...chrono.map((r) => Math.abs(r.trendTotal)));
  const totalDays = Math.max(1, chrono.reduce((a, r) => a + r.trendDays, 0));

  const H = 140;
  const baseline = H / 2;
  const pxPerDay = Math.max(3, Math.min(14, 1400 / totalDays));
  const svgWidth = Math.max(1000, totalDays * pxPerDay);

  let cursor = 0;
  const bars = chrono.map((r, idx) => {
    const w = Math.max(1.5, r.trendDays * pxPerDay - 1);
    const x = cursor;
    cursor += r.trendDays * pxPerDay;
    const h = (Math.abs(r.trendTotal) / maxMove) * (baseline - 8);
    const isRise = r.trendTotal >= 0;
    const y = isRise ? baseline - h : baseline;
    return { x, w, h, y, isRise, r, idx };
  });

  const active = hover !== null ? bars[hover] : null;

  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-display text-sm font-semibold tracking-wide text-fg">Trend tape</p>
          <p className="text-xs text-muted">Every same-direction streak, oldest → newest. Width = days, height = total move.</p>
        </div>
        <div className="hidden sm:block text-right font-mono text-xs text-muted tabular">
          {active ? (
            <>
              <span className={active.isRise ? "text-rise" : "text-fall"}>
                {active.r.trendTotal > 0 ? "+" : ""}
                {active.r.trendTotal.toFixed(2)}%
              </span>{" "}
              over {active.r.trendDays}d, starting {active.r.date}
            </>
          ) : (
            "hover a bar for details"
          )}
        </div>
      </div>
      <div className="overflow-x-auto px-2 py-3">
        <svg
          width={svgWidth}
          height={H}
          viewBox={`0 0 ${svgWidth} ${H}`}
          className="block"
          role="img"
          aria-label="Strip of bars showing each rise and fall streak in the price history"
        >
          <line x1={0} y1={baseline} x2={svgWidth} y2={baseline} stroke="#232833" strokeWidth={1} />
          {bars.map((b) => (
            <rect
              key={b.idx}
              x={b.x}
              y={b.y}
              width={b.w}
              height={Math.max(1, b.h)}
              fill={b.isRise ? "#37C77A" : "#FF5C5C"}
              opacity={hover === null || hover === b.idx ? 0.95 : 0.35}
              onMouseEnter={() => setHover(b.idx)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
