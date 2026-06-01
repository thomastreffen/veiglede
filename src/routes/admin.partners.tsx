import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  adminListPartnersFn,
  adminCreatePartnerFn,
  adminUpdatePartnerFn,
  adminDeletePartnerFn,
} from "@/lib/admin.functions";
import { Plus, Pencil, Trash2, X } from "lucide-react";

type Partner = {
  id: string;
  name: string;
  category: "mat" | "overnatting" | "attraksjon" | "drivstoff";
  logo_url: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  region: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

const CATEGORY_LABEL: Record<Partner["category"], string> = {
  mat: "🍽️ Mat",
  overnatting: "🛏️ Overnatting",
  attraksjon: "🏞️ Attraksjon",
  drivstoff: "⛽ Drivstoff",
};

export const Route = createFileRoute("/admin/partners")({
  component: AdminPartners,
});

function AdminPartners() {
  const list = useServerFn(adminListPartnersFn);
  const create = useServerFn(adminCreatePartnerFn);
  const update = useServerFn(adminUpdatePartnerFn);
  const del = useServerFn(adminDeletePartnerFn);
  const qc = useQueryClient();

  const [editing, setEditing] = useState<Partner | "new" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-partners"],
    queryFn: () => list(),
    staleTime: 20_000,
  });

  const partners = (data?.partners ?? []) as Partner[];

  const onToggle = async (p: Partner) => {
    try {
      await update({ data: { id: p.id, is_active: !p.is_active } });
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feilet");
    }
  };

  const onDelete = async (p: Partner) => {
    if (!confirm(`Slette partneren "${p.name}"?`)) return;
    try {
      await del({ data: { id: p.id } });
      toast.success("Slettet");
      qc.invalidateQueries({ queryKey: ["admin-partners"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feilet");
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-primary">Innhold</p>
          <h1 className="mt-1 font-display text-3xl md:text-4xl uppercase">Partnere</h1>
          <p className="mt-1 text-xs text-slate-400">Aktive partnere med koordinater foreslås som stopp innen 50 km av planlagte ruter.</p>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> Legg til partner
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {isLoading ? (
          <p className="text-sm text-slate-500">Laster…</p>
        ) : partners.length === 0 ? (
          <p className="text-sm text-slate-500">Ingen partnere ennå.</p>
        ) : partners.map((p) => (
          <div key={p.id} className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-4 ${!p.is_active ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-lg bg-slate-800 grid place-items-center overflow-hidden text-xl shrink-0">
                {p.logo_url ? <img src={p.logo_url} alt="" className="h-full w-full object-cover" /> : "🏷️"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{p.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {CATEGORY_LABEL[p.category]} {p.region && `· ${p.region}`}
                </p>
                {p.description && <p className="mt-2 text-xs text-slate-400 line-clamp-2">{p.description}</p>}
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <label className="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input type="checkbox" checked={p.is_active} onChange={() => onToggle(p)} className="accent-primary" />
                Aktiv
              </label>
              <div className="inline-flex gap-1.5">
                <button onClick={() => setEditing(p)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] hover:bg-slate-800">
                  <Pencil className="h-3 w-3" /> Rediger
                </button>
                <button onClick={() => onDelete(p)} className="inline-flex items-center gap-1 rounded-lg border border-red-800 text-red-400 px-2 py-1 text-[11px] hover:bg-red-900/20">
                  <Trash2 className="h-3 w-3" /> Slett
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <PartnerEditor
          partner={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (vals) => {
            try {
              if (editing === "new") {
                await create({ data: vals });
                toast.success("Partner opprettet");
              } else {
                await update({ data: { id: editing.id, ...vals } });
                toast.success("Partner oppdatert");
              }
              qc.invalidateQueries({ queryKey: ["admin-partners"] });
              setEditing(null);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Feilet");
            }
          }}
        />
      )}
    </div>
  );
}

type PartnerInput = {
  name: string;
  category: Partner["category"];
  logo_url: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  region: string | null;
  description: string | null;
  is_active: boolean;
};

function PartnerEditor({ partner, onClose, onSave }: { partner: Partner | null; onClose: () => void; onSave: (v: PartnerInput) => void }) {
  const [name, setName] = useState(partner?.name ?? "");
  const [category, setCategory] = useState<Partner["category"]>(partner?.category ?? "mat");
  const [logoUrl, setLogoUrl] = useState(partner?.logo_url ?? "");
  const [website, setWebsite] = useState(partner?.website ?? "");
  const [region, setRegion] = useState(partner?.region ?? "");
  const [lat, setLat] = useState(partner?.lat?.toString() ?? "");
  const [lng, setLng] = useState(partner?.lng?.toString() ?? "");
  const [description, setDescription] = useState(partner?.description ?? "");
  const [isActive, setIsActive] = useState(partner?.is_active ?? true);

  const submit = () => {
    if (!name.trim()) { toast.error("Navn må fylles ut"); return; }
    onSave({
      name: name.trim(),
      category,
      logo_url: logoUrl.trim() || null,
      website: website.trim() || null,
      region: region.trim() || null,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      description: description.trim() || null,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur grid place-items-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 p-6 my-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl uppercase">{partner ? "Rediger partner" : "Ny partner"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 space-y-3">
          <Field label="Navn"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Kategori">
            <select value={category} onChange={(e) => setCategory(e.target.value as Partner["category"])} className={inputCls}>
              {(Object.keys(CATEGORY_LABEL) as Partner["category"][]).map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
              ))}
            </select>
          </Field>
          <Field label="Logo URL"><input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" className={inputCls} /></Field>
          <Field label="Nettside"><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className={inputCls} /></Field>
          <Field label="Region"><input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Vestlandet, Nord-Norge…" className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude"><input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="60.391" className={inputCls} /></Field>
            <Field label="Longitude"><input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="5.322" className={inputCls} /></Field>
          </div>
          <Field label="Beskrivelse">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="accent-primary" />
            Aktiv
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800">Avbryt</button>
          <button onClick={submit} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110">
            Lagre
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
