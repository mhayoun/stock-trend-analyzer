import { RebuyStats } from "@/lib/trend";
import { Lang, t } from "@/lib/i18n";

const fmtPct = (v: number | null, digits = 1) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`);
const fmtNum = (v: number | null, digits = 1) => (v === null ? "—" : v.toFixed(digits));

export default function RebuyCard({ stats, lang }: { stats: RebuyStats; lang: Lang }) {
  const s = t(lang);
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-md border border-line bg-panel2/60 px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-wider text-muted">{s.cases}</p>
        <p className="font-mono text-lg font-semibold text-fg tabular">{stats.count}</p>
      </div>
      <div className="rounded-md border border-line bg-panel2/60 px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-wider text-muted">{s.avgPullback}</p>
        <p className="font-mono text-lg font-semibold text-fall tabular">{fmtPct(stats.avgDropPct)}</p>
      </div>
      <div className="rounded-md border border-line bg-panel2/60 px-3 py-2.5">
        <p className="text-[11px] uppercase tracking-wider text-muted">{s.avgDaysToBottom}</p>
        <p className="font-mono text-lg font-semibold text-amber tabular">{fmtNum(stats.avgWaitingDays)}d</p>
      </div>
    </div>
  );
}
