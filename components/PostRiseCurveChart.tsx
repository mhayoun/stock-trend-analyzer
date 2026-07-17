"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { PostRiseCurve } from "@/lib/trend";
import { Lang, t } from "@/lib/i18n";

const COLORS: Record<string, string> = {
  "5": "#7AA2F7",
  "10": "#F0A84B",
  "15": "#FF5C5C",
};

export default function PostRiseCurveChart({
  curves,
  lang,
}: {
  curves: Record<string, PostRiseCurve>;
  lang: Lang;
}) {
  const s = t(lang);
  const thresholds = Object.keys(curves).sort((a, b) => Number(a) - Number(b));
  const maxLen = Math.max(0, ...thresholds.map((k) => curves[k].avgCurve.length));

  const data = Array.from({ length: maxLen }, (_, i) => {
    const row: Record<string, number | null> = { day: i + 1 };
    for (const k of thresholds) {
      const c = curves[k].avgCurve;
      row[`th${k}`] = i < c.length ? c[i] : null;
    }
    return row;
  });

  if (maxLen === 0) {
    return <p className="mt-2 text-xs text-muted">Not enough qualifying streaks in this window to plot a curve.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232833" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fill: "#7A8290", fontSize: 11, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={{ stroke: "#232833" }}
          label={{ value: s.dayAfterAxis, position: "insideBottom", offset: -2, fill: "#7A8290", fontSize: 10 }}
        />
        <YAxis
          tick={{ fill: "#7A8290", fontSize: 11, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={false}
          width={56}
          unit="%"
          label={{ value: s.avgDriftAxis, angle: -90, position: "insideLeft", fill: "#7A8290", fontSize: 10 }}
        />
        <ReferenceLine y={0} stroke="#7A8290" strokeDasharray="4 4" />
        <Tooltip
          contentStyle={{
            background: "#161A22",
            border: "1px solid #232833",
            borderRadius: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
          labelFormatter={(d) => `J+${d}`}
          formatter={(v: number, name: string) => [v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`, `+${name.replace("th", "")}%`]}
        />
        <Legend
          formatter={(name: string) => `+${name.replace("th", "")}% (n=${curves[name.replace("th", "")]?.count ?? 0})`}
          wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#7A8290" }}
        />
        {thresholds.map((k) =>
          curves[k].avgCurve.length > 0 ? (
            <Line
              key={k}
              type="monotone"
              dataKey={`th${k}`}
              name={`th${k}`}
              stroke={COLORS[k] ?? "#7A8290"}
              strokeWidth={1.75}
              dot={{ r: 2.5 }}
              connectNulls
            />
          ) : null
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
