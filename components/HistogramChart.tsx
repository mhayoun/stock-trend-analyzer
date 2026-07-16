"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { histogramBins } from "@/lib/trend";

export default function HistogramChart({
  values,
  color,
}: {
  values: number[];
  color: string;
}) {
  const bins = histogramBins(values, 20);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={bins} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232833" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#7A8290", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={{ stroke: "#232833" }}
          interval={2}
        />
        <YAxis
          tick={{ fill: "#7A8290", fontSize: 10, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "#161A22",
            border: "1px solid #232833",
            borderRadius: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
          labelFormatter={(l) => `~${l}%`}
          formatter={(v: number) => [v, "occurrences"]}
        />
        <Bar dataKey="count" fill={color} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
