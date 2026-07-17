import { Lang, t } from "@/lib/i18n";

export default function InterpretationBox({
  text,
  lang,
  source,
}: {
  text: string;
  lang: Lang;
  source: "ai" | "rules";
}) {
  const s = t(lang);
  return (
    <div className="mt-3 rounded-md border border-line bg-panel2/60 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 inline-flex shrink-0 items-center rounded-full border border-amber/40 bg-amber/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amber"
          title={source === "ai" ? s.sourceBadgeAi : s.sourceBadgeRules}
        >
          {source === "ai" ? s.sourceBadgeAi : s.sourceBadgeRules}
        </span>
        <p className="text-xs leading-relaxed text-muted">{text}</p>
      </div>
    </div>
  );
}
