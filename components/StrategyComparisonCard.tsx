import { StrategyComparison, StrategyResult } from "@/lib/trend";
import { Lang, t } from "@/lib/i18n";

const fmtPct = (v: number, digits = 1) => `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;

function StrategyPanel({
  label,
  result,
  best,
  lang,
}: {
  label: string;
  result: StrategyResult;
  best: boolean;
  lang: Lang;
}) {
  const s = t(lang);
  const tone = result.returnPct >= 0 ? "text-rise" : "text-fall";
  return (
    <div
      className={`rounded-md border px-3 py-3 ${
        best ? "border-amber/60 bg-amber/5" : "border-line bg-panel2/60"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-fg">{label}</p>
        {best && (
          <span className="shrink-0 rounded-full border border-amber/40 bg-amber/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber">
            {s.strategyBestBadge}
          </span>
        )}
      </div>
      <p className={`mt-2 font-mono text-xl font-semibold tabular ${tone}`}>{fmtPct(result.returnPct)}</p>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>{s.strategyShares}</span>
        <span className="font-mono tabular text-fg">{result.sharesEquivalent.toFixed(3)}</span>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted">
        <span>{s.strategyTrades}</span>
        <span className="font-mono tabular text-fg">{result.trades}</span>
      </div>
    </div>
  );
}

export default function StrategyComparisonCard({
  data,
  lang,
}: {
  data: StrategyComparison;
  lang: Lang;
}) {
  const s = t(lang);
  const sell = data.sellThresholdPct.toFixed(0);
  const drop = data.rebuyDropPct.toFixed(0);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StrategyPanel
        label={s.strategyBuyHold}
        result={data.buyAndHold}
        best={data.bestStrategy === "buyAndHold"}
        lang={lang}
      />
      <StrategyPanel
        label={s.strategySellRebuyDrop.replace("{sell}", sell).replace("{drop}", drop)}
        result={data.sellRebuyOnDrop}
        best={data.bestStrategy === "sellRebuyOnDrop"}
        lang={lang}
      />
      <StrategyPanel
        label={s.strategySellRebuyFixed.replace("{sell}", sell).replace("{days}", String(data.rebuyFixedDays))}
        result={data.sellRebuyFixedDays}
        best={data.bestStrategy === "sellRebuyFixedDays"}
        lang={lang}
      />
    </div>
  );
}
