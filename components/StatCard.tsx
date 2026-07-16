export default function StatCard({
  label,
  value,
  tone = "neutral",
  sub,
}: {
  label: string;
  value: string;
  tone?: "rise" | "fall" | "neutral" | "amber";
  sub?: string;
}) {
  const toneClass =
    tone === "rise" ? "text-rise" : tone === "fall" ? "text-fall" : tone === "amber" ? "text-amber" : "text-fg";
  return (
    <div className="rounded-lg border border-line bg-panel px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`font-mono text-xl font-semibold tabular ${toneClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
