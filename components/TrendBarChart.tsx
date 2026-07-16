"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { TrendRow } from "@/lib/trend";

export default function TrendBarChart({ data }: { data: TrendRow[] }) {
  const chrono = [...data].reverse();
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chrono} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#232833" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#7A8290", fontSize: 11, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={{ stroke: "#232833" }}
          minTickGap={60}
        />
        <YAxis
          tick={{ fill: "#7A8290", fontSize: 11, fontFamily: "var(--font-mono)" }}
          tickLine={false}
          axisLine={false}
          width={48}
          unit="%"
        />
        <Tooltip
          contentStyle={{
            background: "#161A22",
            border: "1px solid #232833",
            borderRadius: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
          labelStyle={{ color: "#7A8290" }}
          formatter={(v: number, _n, item: any) => [
            `${v > 0 ? "+" : ""}${v.toFixed(2)}% over ${item.payload.trendDays}d`,
            "Trend total",
          ]}
        />
        <Bar dataKey="trendTotal" radius={[2, 2, 0, 0]}>
          {chrono.map((r, i) => (
            <Cell key={i} fill={r.trendTotal >= 0 ? "#37C77A" : "#FF5C5C"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
