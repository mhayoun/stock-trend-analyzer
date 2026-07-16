import { TrendRow } from "@/lib/trend";

export default function SummaryTable({ rows }: { rows: TrendRow[] }) {
  return (
    <div className="max-h-[480px] overflow-y-auto rounded-lg border border-line">
      <table className="w-full border-collapse font-mono text-xs tabular">
        <thead className="sticky top-0 bg-panel2">
          <tr className="text-left text-muted">
            <th className="border-b border-line px-3 py-2 font-medium">Date</th>
            <th className="border-b border-line px-3 py-2 font-medium">Close</th>
            <th className="border-b border-line px-3 py-2 font-medium">Variation %</th>
            <th className="border-b border-line px-3 py-2 font-medium">Trend total %</th>
            <th className="border-b border-line px-3 py-2 font-medium">Trend days</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date} className="odd:bg-panel even:bg-panel2/40 hover:bg-line/40">
              <td className="px-3 py-1.5 text-muted">{r.date}</td>
              <td className="px-3 py-1.5">${r.close.toFixed(2)}</td>
              <td className={`px-3 py-1.5 ${r.variation >= 0 ? "text-rise" : "text-fall"}`}>
                {r.variation > 0 ? "+" : ""}
                {r.variation.toFixed(2)}
              </td>
              <td className={`px-3 py-1.5 ${r.trendTotal >= 0 ? "text-rise" : "text-fall"}`}>
                {r.trendTotal > 0 ? "+" : ""}
                {r.trendTotal.toFixed(2)}
              </td>
              <td className="px-3 py-1.5">{r.trendDays}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
