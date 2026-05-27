import { useI18n } from "@/i18n/provider";
import type { Locale } from "@/i18n";
import { cn } from "@/lib/utils";

const OPTIONS: { code: Locale; label: string }[] = [
  { code: "nb", label: "NO" },
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
];

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
        "inline-flex items-center rounded-full border p-0.5 text-[11px] font-semibold uppercase tracking-wider",
        isLight
          ? "border-white/20 bg-white/5 backdrop-blur"
          : "border-border bg-surface-2/60",
        className,
      )}
    >
      {OPTIONS.map((o) => {
        const active = o.code === locale;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => setLocale(o.code)}
            aria-pressed={active}
            className={cn(
              "px-2.5 py-1 rounded-full transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : isLight
                  ? "text-white/75 hover:text-white"
                  : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
