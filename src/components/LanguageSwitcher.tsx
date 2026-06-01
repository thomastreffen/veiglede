import { useI18n } from "@/i18n/provider";
import { LOCALE_META, SUPPORTED_LOCALES, type Locale } from "@/i18n";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Renders compact pill row; "light" tone for dark photo backgrounds. */
  tone?: "light" | "dark";
}

export function LanguageSwitcher({ className, tone = "dark" }: Props) {
  const { locale, setLocale, t } = useI18n();
  const isLight = tone === "light";
  return (
    <div
      role="group"
      aria-label={t.language.label}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border p-0.5 text-[11px] font-semibold uppercase tracking-wider flex-wrap",
        isLight
          ? "border-white/20 bg-white/5 backdrop-blur"
          : "border-border bg-surface-2/60",
        className,
      )}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const meta = LOCALE_META[code];
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code)}
            aria-pressed={active}
            title={meta.long}
            className={cn(
              "px-2 py-1 rounded-full transition-colors inline-flex items-center gap-1",
              active
                ? "bg-primary text-primary-foreground"
                : isLight
                  ? "text-white/75 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span aria-hidden>{meta.flag}</span>
            <span className="hidden sm:inline">{meta.short}</span>
          </button>
        );
      })}
    </div>
  );
}
