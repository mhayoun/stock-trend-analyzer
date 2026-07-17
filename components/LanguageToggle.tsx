import { Lang, LANGS } from "@/lib/i18n";

export default function LanguageToggle({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (lang: Lang) => void;
}) {
  return (
    <div className="inline-flex rounded-full border border-line p-0.5">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => onChange(l.code)}
          aria-pressed={lang === l.code}
          className={`rounded-full px-2.5 py-1 font-mono text-[11px] tracking-wide transition ${
            lang === l.code ? "bg-amber text-ink" : "text-muted hover:text-fg"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
