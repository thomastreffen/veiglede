import { useEffect, useId, useRef, useState } from "react";
import { searchPlaces, manualPlace, resolveGooglePlace, type ResolvedPlace, type PlaceSource, type SearchOptions } from "@/lib/places/geocoder";
import { useI18n } from "@/i18n/provider";

import { cn } from "@/lib/utils";
import { MapPin, Loader2, X } from "lucide-react";

interface Props {
  value: string;
  onTextChange: (text: string) => void;
  selected: ResolvedPlace | null;
  onSelect: (place: ResolvedPlace | null) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  searchOptions?: SearchOptions;
  /** Custom label for the "use typed text as-is" fallback button. */
  useAnywayLabel?: string;
}

interface SearchState {
  loading: boolean;
  results: ResolvedPlace[];
  provider: PlaceSource;
  failed: boolean;
}

const INITIAL: SearchState = { loading: false, results: [], provider: "demo", failed: false };

function typeBadge(t: ResolvedPlace["type"], lang: string): string {
  if (lang === "nb") {
    if (t === "city") return "By";
    if (t === "address") return "Adresse";
    if (t === "region") return "Region";
    if (t === "poi") return "Sted";
    return "Sted";
  }
  if (lang === "de") {
    if (t === "city") return "Stadt";
    if (t === "address") return "Adresse";
    if (t === "region") return "Region";
    if (t === "poi") return "Ort";
    return "Ort";
  }
  if (t === "city") return "City";
  if (t === "address") return "Address";
  if (t === "region") return "Region";
  if (t === "poi") return "Place";
  return "Place";
}

export function PlaceAutocomplete({
  value, onTextChange, selected, onSelect, placeholder, className, ariaLabel, searchOptions, useAnywayLabel,
}: Props) {
  const { t, locale } = useI18n();
  const tt = t.placeSearch;
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<SearchState>(INITIAL);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  // Suppress the search effect for one tick after a programmatic selection
  // — otherwise picking a suggestion immediately re-queries the API.
  const skipNextSearch = useRef(false);

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 2) {
      setState(INITIAL);
      setActiveIdx(-1);
      ctrlRef.current?.abort();
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const handle = setTimeout(() => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      searchPlaces(q, ctrl.signal, searchOptions).then((r) => {
        if (ctrl.signal.aborted) return;
        setState({ loading: false, results: r.results, provider: r.provider, failed: r.failed });
        setActiveIdx(r.results.length > 0 ? 0 : -1);
      }).catch(() => { /* swallow */ });
    }, 300);
    return () => clearTimeout(handle);
  }, [value, searchOptions?.category, searchOptions?.queryPrefix, searchOptions?.proximity?.lng, searchOptions?.proximity?.lat]);

  // Click-outside closes dropdown.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pick = async (p: ResolvedPlace) => {
    skipNextSearch.current = true;
    onTextChange(p.name);
    setOpen(false);
    setActiveIdx(-1);
    // Google autocomplete suggestions need a Place Details call for lat/lng.
    if (p.needsDetails) {
      onSelect(p); // optimistic
      const resolved = await resolveGooglePlace(p);
      if (resolved) {
        onTextChange(resolved.name);
        onSelect(resolved);
      }
    } else {
      onSelect(p);
    }
  };

  const useAnyway = () => {
    const m = manualPlace(value);
    onSelect(m); // may be null
    setOpen(false);
  };

  const clear = () => {
    skipNextSearch.current = true;
    onTextChange("");
    onSelect(null);
    setState(INITIAL);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (!open) setOpen(true);
      e.preventDefault();
      setActiveIdx((i) => Math.min(state.results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (open && activeIdx >= 0 && state.results[activeIdx]) {
        e.preventDefault();
        pick(state.results[activeIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showDropdown = open && value.trim().length >= 2;
  const noResults = !state.loading && state.results.length === 0;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => { onTextChange(e.target.value); onSelect(null); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? tt.placeholder}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showDropdown}
          aria-activedescendant={activeIdx >= 0 ? `${listId}-${activeIdx}` : undefined}
          role="combobox"
          autoComplete="off"
          className="w-full bg-surface border border-border rounded-xl pl-9 pr-9 py-3.5 text-base outline-none focus:border-primary"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {selected && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {selected.label}
          </span>
        </p>
      )}

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-border bg-surface shadow-xl"
        >
          {state.loading && (
            <div className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {tt.searching}
            </div>
          )}
          {!state.loading && state.results.map((p, i) => (
            <button
              type="button"
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              className={cn(
                "w-full text-left px-3 py-2.5 flex items-start gap-3 border-b border-border/60 last:border-b-0",
                i === activeIdx ? "bg-primary/10" : "hover:bg-surface-2",
              )}
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                {p.secondary && <p className="text-[11px] text-muted-foreground truncate">{p.secondary}</p>}
              </div>
              <span className="text-[10px] uppercase tracking-wider rounded-full border border-border px-2 py-0.5 text-muted-foreground shrink-0">
                {typeBadge(p.type, locale)}
              </span>
            </button>
          ))}
          {noResults && (
            <div className="px-3 py-3 space-y-2">
              <p className="text-sm text-muted-foreground">{tt.noResults}</p>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); useAnyway(); }}
                className="text-xs font-semibold text-primary hover:underline text-left"
              >
                {useAnywayLabel ? `${useAnywayLabel}: ${value.trim()}` : tt.useAnyway}
              </button>
            </div>
          )}
          {!state.loading && state.failed && state.results.length > 0 && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground border-t border-border/60">
              {tt.usingLocal}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
