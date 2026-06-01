import { X } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { LOCALE_META } from "@/i18n";

export function LanguageBanner() {
  const { geoSuggested, setLocale, dismissGeoSuggestion, t } = useI18n();
  if (!geoSuggested) return null;
  const meta = LOCALE_META[geoSuggested];

  return (
    <div className="fixed inset-x-0 top-[68px] z-40 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto inline-flex items-center gap-3 rounded-full border border-black/10 bg-white/95 backdrop-blur px-4 py-2 shadow-md text-sm text-[#1a1a1a]">
        <span className="text-base" aria-hidden>{meta.flag}</span>
        <button
          type="button"
          onClick={() => setLocale(geoSuggested)}
          className="hover:text-primary transition-colors"
        >
          {t.banner.suggest(meta.long)}
        </button>
        <button
          type="button"
          onClick={dismissGeoSuggestion}
          aria-label={t.banner.dismiss}
          className="grid place-items-center h-6 w-6 rounded-full hover:bg-black/5 text-[#1a1a1a]/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
