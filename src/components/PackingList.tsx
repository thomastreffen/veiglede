import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Sparkles, Plus, X, Backpack, Check, Loader2 } from "lucide-react";
import {
  tripsApi, type Trip, type PackingItem, type PackingCategory, vehicleMeta, styleMeta, stopMeta,
} from "@/lib/trips-store";
import {
  PACKING_CATEGORIES, categoryMeta, PACKING_TEMPLATES, templateForVehicle, type PackingTemplate,
} from "@/lib/packing-templates";
import { suggestPackingList, type SuggestedPackingItem } from "@/lib/packing.functions";

interface Props {
  trip: Trip;
  stopTypes: string[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

function seasonFromDate(iso?: string): string {
  if (!iso) return "sommer";
  const m = new Date(iso).getMonth() + 1;
  if (m >= 3 && m <= 5) return "vår";
  if (m >= 6 && m <= 8) return "sommer";
  if (m >= 9 && m <= 11) return "høst";
  return "vinter";
}

function durationDays(trip: Trip): number {
  if (trip.startDate && trip.endDate) {
    const ms = new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime();
    const d = Math.max(1, Math.round(ms / 86400000) + 1);
    if (Number.isFinite(d)) return d;
  }
  // Fallback from driving time string like "5t 30min" → at least 1 day
  return 2;
}

export function PackingList({ trip, stopTypes }: Props) {
  const [open, setOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiItems, setAiItems] = useState<SuggestedPackingItem[] | null>(null);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const askAi = useServerFn(suggestPackingList);

  const items = trip.packingList ?? [];
  const total = items.length;
  const done = items.filter((i) => i.checked).length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  const grouped = useMemo(() => {
    const map = new Map<PackingCategory, PackingItem[]>();
    PACKING_CATEGORIES.forEach((c) => map.set(c.value, []));
    items.forEach((it) => {
      const cat: PackingCategory = it.category ?? "annet";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    });
    return map;
  }, [items]);

  const persist = (next: PackingItem[]) => {
    tripsApi.updateTrip(trip.id, { packingList: next });
  };

  const addItem = (label: string, category: PackingCategory) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (items.some((i) => i.label.toLowerCase() === trimmed.toLowerCase() && (i.category ?? "annet") === category)) {
      toast.info("Allerede på lista.");
      return;
    }
    persist([...items, { id: uid(), label: trimmed, checked: false, category }]);
  };

  const toggle = (id: string) => {
    persist(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  };

  const remove = (id: string) => {
    persist(items.filter((i) => i.id !== id));
  };

  const applyTemplate = (tpl: PackingTemplate) => {
    const existing = new Set(items.map((i) => i.label.toLowerCase()));
    const additions: PackingItem[] = tpl.items
      .filter((i) => !existing.has(i.label.toLowerCase()))
      .map((i) => ({ id: uid(), label: i.label, checked: false, category: i.category }));
    if (additions.length === 0) {
      toast.info("Alle elementer fra malen er allerede lagt til.");
      return;
    }
    persist([...items, ...additions]);
    toast.success(`La til ${additions.length} elementer fra ${tpl.label}.`);
  };

  const fetchAi = async () => {
    setAiLoading(true);
    setAiOpen(true);
    try {
      const res = await askAi({
        data: {
          vehicle: vehicleMeta(trip.vehicle).label,
          style: styleMeta(trip.style).label,
          durationDays: durationDays(trip),
          season: seasonFromDate(trip.startDate),
          stopTypes: Array.from(new Set(stopTypes.map((t) => stopMeta(t as never).label))).slice(0, 12),
          origin: trip.origin,
          destination: trip.destination,
        },
      });
      setAiItems(res.items);
      if (res.items.length === 0) toast.info("AI fant ingen nye forslag.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Kunne ikke hente AI-forslag.");
      setAiOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  const addSuggested = (s: SuggestedPackingItem) => {
    addItem(s.label, s.category);
    setAiItems((prev) => prev?.filter((x) => !(x.label === s.label && x.category === s.category)) ?? null);
  };

  const addAllSuggested = () => {
    if (!aiItems || aiItems.length === 0) return;
    const existing = new Set(items.map((i) => i.label.toLowerCase()));
    const additions: PackingItem[] = aiItems
      .filter((s) => !existing.has(s.label.toLowerCase()))
      .map((s) => ({ id: uid(), label: s.label, checked: false, category: s.category }));
    if (additions.length === 0) {
      toast.info("Alle forslag er allerede lagt til.");
      return;
    }
    persist([...items, ...additions]);
    toast.success(`La til ${additions.length} forslag.`);
    setAiItems(null);
    setAiOpen(false);
  };

  const defaultTpl = templateForVehicle(trip.vehicle);
  const visibleTemplates = showAllTemplates
    ? PACKING_TEMPLATES
    : defaultTpl ? [defaultTpl] : PACKING_TEMPLATES;

  return (
    <section id="packing" className="mt-10 scroll-mt-24">
      <div className="rounded-2xl border border-border bg-surface overflow-hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4 hover:bg-surface-2/40"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="h-10 w-10 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0">
              <Backpack className="h-5 w-5" />
            </span>
            <div className="text-left min-w-0">
              <h2 className="font-display text-2xl uppercase">Pakkeliste</h2>
              <p className="text-xs text-muted-foreground">
                {total === 0 ? "Ingen elementer ennå" : `${done} av ${total} pakket`}
              </p>
            </div>
          </div>
          {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>

        {open && (
          <div className="border-t border-border/60 p-5 space-y-5">
            {/* Progress */}
            {total > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{done} av {total} pakket</span>
                  <span className="font-mono tabular-nums">{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* Action bar */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={fetchAi}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-60"
              >
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Forslag fra AI
              </button>
              {visibleTemplates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs hover:border-primary"
                >
                  <span>{tpl.emoji}</span> {tpl.label}
                </button>
              ))}
              {!showAllTemplates && PACKING_TEMPLATES.length > visibleTemplates.length && (
                <button
                  onClick={() => setShowAllTemplates(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
                >
                  Vis flere maler
                </button>
              )}
            </div>

            {/* AI suggestions panel */}
            {aiOpen && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> AI-forslag
                  </p>
                  <div className="flex items-center gap-2">
                    {aiItems && aiItems.length > 0 && (
                      <button
                        onClick={addAllSuggested}
                        className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110"
                      >
                        <Check className="h-3 w-3" /> Legg til alle
                      </button>
                    )}
                    <button
                      onClick={() => { setAiOpen(false); setAiItems(null); }}
                      className="text-muted-foreground hover:text-foreground p-1"
                      aria-label="Lukk"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {aiLoading && (
                  <p className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Tenker…
                  </p>
                )}
                {!aiLoading && aiItems && aiItems.length === 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">Ingen nye forslag.</p>
                )}
                {!aiLoading && aiItems && aiItems.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {aiItems.map((s, i) => {
                      const m = categoryMeta(s.category);
                      return (
                        <button
                          key={`${s.label}-${i}`}
                          onClick={() => addSuggested(s)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-xs hover:border-primary hover:text-primary"
                        >
                          <Plus className="h-3 w-3" /> <span>{m.emoji}</span> {s.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Categories */}
            <div className="space-y-4">
              {PACKING_CATEGORIES.map((cat) => (
                <CategoryBlock
                  key={cat.value}
                  category={cat.value}
                  label={cat.label}
                  emoji={cat.emoji}
                  items={grouped.get(cat.value) ?? []}
                  onToggle={toggle}
                  onRemove={remove}
                  onAdd={(label) => addItem(label, cat.value)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function CategoryBlock({
  category, label, emoji, items, onToggle, onRemove, onAdd,
}: {
  category: PackingCategory;
  label: string;
  emoji: string;
  items: PackingItem[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: (label: string) => void;
}) {
  const [value, setValue] = useState("");
  const submit = () => {
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  };

  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
        <span className="mr-1.5">{emoji}</span>{label} <span className="text-foreground/60">· {items.length}</span>
      </p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it.id} className="group flex items-center gap-2.5">
            <button
              onClick={() => onToggle(it.id)}
              className={`h-5 w-5 shrink-0 rounded-md border ${it.checked ? "bg-primary border-primary text-primary-foreground" : "border-border bg-surface"} grid place-items-center transition`}
              aria-label={it.checked ? "Marker som ikke pakket" : "Marker som pakket"}
            >
              {it.checked && <Check className="h-3 w-3" />}
            </button>
            <span className={`flex-1 text-sm ${it.checked ? "line-through text-muted-foreground" : ""}`}>{it.label}</span>
            <button
              onClick={() => onRemove(it.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition"
              aria-label={`Fjern ${it.label}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-muted-foreground italic">Ingen elementer.</li>
        )}
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          placeholder={`Legg til i ${label.toLowerCase()}…`}
          aria-label={`Legg til ${label}`}
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={submit}
          disabled={!value.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-primary-foreground hover:brightness-110 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Legg til
        </button>
      </div>
    </div>
  );
}
