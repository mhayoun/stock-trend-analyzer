"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function PriceChart({ data }: { data: { date: string; close: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
          domain={["auto", "auto"]}
          width={56}
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
          formatter={(v: number) => [`$${v.toFixed(2)}`, "Close"]}
        />
        <Line type="monotone" dataKey="close" stroke="#F0A84B" strokeWidth={1.75} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
