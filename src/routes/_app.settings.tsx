import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useDebugMode, setDebugMode } from "@/components/DemoDebugPanel";
import { useAuth, signOut } from "@/lib/auth";
import { deleteMyAccount } from "@/lib/account";
import { LogOut, LogIn, Trash2, AlertTriangle } from "lucide-react";

function DangerZone() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!user) return null;
  const canDelete = confirmText.trim().toUpperCase() === "SLETT";
  const onDelete = async () => {
    if (!canDelete || busy) return;
    setBusy(true); setErr(null);
    try {
      await deleteMyAccount();
      window.location.assign("/");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Klarte ikke slette kontoen.");
      setBusy(false);
    }
  };
  return (
    <section className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl uppercase">Konto og data</h2>
        <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Permanent</span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Sletter profil, kjøretøy, turer, preferanser og delte turlenker fra kontoen din. Kan ikke angres.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">30 dagers gjenoppretting kan komme senere.</p>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-destructive/60 bg-background px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" /> Slett konto
        </button>
      ) : (
        <div className="mt-4 rounded-xl border border-destructive/50 bg-background p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm">
              Skriv <span className="font-mono font-bold">SLETT</span> for å bekrefte. Alle dine data fjernes permanent.
            </p>
          </div>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="SLETT"
            className="mt-3 w-full rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm font-mono outline-none focus:border-destructive"
          />
          {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button
              onClick={onDelete}
              disabled={!canDelete || busy}
              className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:brightness-110 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> {busy ? "Sletter…" : "Slett kontoen min for alltid"}
            </button>
            <button
              onClick={() => { setOpen(false); setConfirmText(""); setErr(null); }}
              disabled={busy}
              className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </section>
  );
}



function AccountCard() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Du utforsker i demo-modus</p>
          <p className="text-xs text-muted-foreground">Logg inn for å lagre turer, kjøretøy og kjørestil på tvers av enheter.</p>
        </div>
        <Link to="/signup" className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110">
          <LogIn className="h-3.5 w-3.5" /> Opprett konto
        </Link>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border bg-surface-1 p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center font-semibold">
          {(user.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{user.email}</p>
          <p className="text-xs text-muted-foreground">Innlogget · turer synkroniseres</p>
        </div>
      </div>
      <button onClick={() => signOut()} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs hover:bg-surface-2">
        <LogOut className="h-3.5 w-3.5" /> Logg ut
      </button>
    </div>
  );
}

import { useTheme, setTheme, type Theme } from "@/lib/theme";
import { ROUTE_STYLES, stopMeta, vehicleMeta, styleMeta } from "@/lib/trips-store";
import {
  useDriverPrefs, updateDriverPrefs, toggleDrivingFlag, toggleStopInterest,
  DRIVING_FLAGS, STOP_INTERESTS,
} from "@/lib/driver-prefs";
import {
  useVehicles, vehiclesApi, energyMeta, type Vehicle,
} from "@/lib/vehicles-store";
import { VehicleEditor } from "@/components/VehicleEditor";
import { Moon, Sun, Check, Lock, Link as LinkIcon, Image as ImageIcon, Radio, Plus, Pencil } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Profil — Veiglede" }] }),
  component: Settings,
});

function Settings() {
  const debug = useDebugMode();
  const theme = useTheme();
  const prefs = useDriverPrefs();
  const { vehicles, defaultId } = useVehicles();
  const defaultVehicle = vehicles.find((v) => v.id === defaultId) ?? vehicles[0];
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | undefined>(undefined);

  const openNew = () => { setEditing(undefined); setEditorOpen(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setEditorOpen(true); };

  return (
    <div className="py-5 md:py-8 max-w-2xl mx-auto space-y-6">
      <header>
        <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Din profil</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl uppercase">Førerprofil</h1>
        <p className="mt-2 text-sm text-muted-foreground">Veiglede tilpasser ruter, stopp og forslag etter hvordan du liker å kjøre — og hvilket kjøretøy du tar med.</p>
      </header>

      <AccountCard />


      {/* 1 — Driver profile */}
      <Section title="Sjåfør" caption="Grunninnstillinger">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-display text-3xl">
            {prefs.displayName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <input
              value={prefs.displayName}
              onChange={(e) => updateDriverPrefs({ displayName: e.target.value })}
              className="w-full bg-transparent font-semibold text-lg outline-none focus:bg-surface-2 rounded px-1 -mx-1"
            />
            <p className="text-xs text-muted-foreground">Lokal demo-profil · ingen pålogging</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <MiniSelect
            label="Enheter"
            value={prefs.units}
            onChange={(v) => updateDriverPrefs({ units: v as "km" | "mi" })}
            options={[{ value: "km", label: "Kilometer" }, { value: "mi", label: "Miles" }]}
          />
          <MiniSelect
            label="Språk"
            value={prefs.language}
            onChange={(v) => updateDriverPrefs({ language: v as "nb" | "en" })}
            options={[{ value: "nb", label: "Norsk" }, { value: "en", label: "English" }]}
          />
        </div>
        {defaultVehicle && (
          <p className="mt-3 text-xs text-muted-foreground">
            Standardkjøretøy: <span className="text-foreground font-medium">{vehicleMeta(defaultVehicle.type).emoji} {defaultVehicle.name}</span>
          </p>
        )}
      </Section>

      {/* 2 — My vehicles */}
      <Section
        title="Mine kjøretøy"
        caption={`${vehicles.length} ${vehicles.length === 1 ? "kjøretøy" : "kjøretøy"}`}
        action={
          <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20">
            <Plus className="h-3.5 w-3.5" /> Legg til
          </button>
        }
      >
        <p className="text-xs text-muted-foreground mb-3">Hvert kjøretøy har sin egen rutestil og foretrukne stopp. Velg standard ved å trykke «Sett som standard».</p>
        <div className="grid grid-cols-1 gap-3">
          {vehicles.map((vh) => (
            <VehicleCard
              key={vh.id}
              vehicle={vh}
              isDefault={vh.id === defaultId}
              onEdit={() => openEdit(vh)}
              onSetDefault={() => vehiclesApi.setDefault(vh.id)}
            />
          ))}
          <button
            onClick={openNew}
            className="rounded-2xl border-2 border-dashed border-border bg-surface/40 p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" /> Legg til kjøretøy
          </button>
        </div>
      </Section>

      <VehicleEditor open={editorOpen} onOpenChange={setEditorOpen} vehicle={editing} />



      {/* 3 — Driving preferences */}
      <Section title="Kjørepreferanser" caption="Hva slags kjøring liker du?">
        <div className="flex flex-wrap gap-2">
          {DRIVING_FLAGS.map((f) => {
            const on = !!prefs.drivingFlags[f.key];
            return (
              <button
                key={f.key}
                onClick={() => toggleDrivingFlag(f.key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}
              >
                <span>{f.emoji}</span> {f.label}
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniSelect
            label="Standard rutestil"
            value={prefs.defaultStyle}
            onChange={(v) => updateDriverPrefs({ defaultStyle: v as never })}
            options={ROUTE_STYLES.map((s) => ({ value: s.value, label: `${s.emoji} ${s.label}` }))}
          />
          <MiniSelect
            label="Maks timer / dag"
            value={String(prefs.maxDrivingHours)}
            onChange={(v) => updateDriverPrefs({ maxDrivingHours: Number(v) })}
            options={[3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: String(n), label: `${n} timer` }))}
          />
          <MiniSelect
            label="Pause hver"
            value={String(prefs.pauseEveryMin)}
            onChange={(v) => updateDriverPrefs({ pauseEveryMin: Number(v) })}
            options={[60, 90, 120, 150, 180].map((n) => ({ value: String(n), label: `${n} min` }))}
          />
        </div>
      </Section>

      {/* 4 — Stop interests */}
      <Section title="Hva vil du se langs ruta?" caption="Personaliserer «Langs ruta» og partnertips">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {STOP_INTERESTS.map((s) => {
            const on = prefs.stopInterests.includes(s.value);
            return (
              <button
                key={s.value}
                onClick={() => toggleStopInterest(s.value)}
                className={`rounded-xl border-2 p-3 text-left transition-colors ${on ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-border/80"}`}
              >
                <div className="text-xl">{s.emoji}</div>
                <p className="mt-1.5 text-xs font-medium">{s.label}</p>
                {on && <p className="mt-1 text-[10px] uppercase tracking-wider text-primary">Valgt</p>}
              </button>
            );
          })}
        </div>
      </Section>

      {/* 5 — Sharing & privacy */}
      <Section title="Deling og personvern" caption="Hvordan turene dine deles">
        <ToggleRow
          icon={<Lock className="h-4 w-4" />}
          label="Standard: Privat"
          help="Nye turer er kun synlige for deg."
          on={prefs.sharing.defaultPrivate}
          onChange={(on) => updateDriverPrefs({ sharing: { ...prefs.sharing, defaultPrivate: on } })}
        />
        <ToggleRow
          icon={<LinkIcon className="h-4 w-4" />}
          label="Tillat delbar roadbook-lenke"
          help="Send turen som lesbar lenke til reisefølge."
          on={prefs.sharing.allowRoadbookLink}
          onChange={(on) => updateDriverPrefs({ sharing: { ...prefs.sharing, allowRoadbookLink: on } })}
        />
        <ToggleRow
          icon={<ImageIcon className="h-4 w-4" />}
          label="Vis bilder i delt tur"
          help="Bilder fra fotostoppene blir synlige i delt versjon."
          on={prefs.sharing.showPhotos}
          onChange={(on) => updateDriverPrefs({ sharing: { ...prefs.sharing, showPhotos: on } })}
        />
        <ToggleRow
          icon={<Radio className="h-4 w-4" />}
          label="Live deling"
          help="Følg turen i sanntid. Kommer senere."
          on={prefs.sharing.liveSharing}
          disabled
          tag="Kommer senere"
          onChange={() => {}}
        />
      </Section>

      {/* 6 — Appearance */}
      <Section title="Utseende" caption="Tema">
        <div className="inline-flex rounded-2xl border border-border bg-background p-1">
          <ThemeOption current={theme} value="dark" label="Mørk" icon={<Moon className="h-4 w-4" />} />
          <ThemeOption current={theme} value="light" label="Lys" icon={<Sun className="h-4 w-4" />} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Mørk modus er standard. Lys passer for kjøring i dagslys.</p>
      </Section>

      {/* 7 — Developer */}
      <section className="rounded-2xl border border-dashed border-border bg-surface/60 p-5">
        <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Utvikler · Demo</p>
        <h2 className="mt-1 font-display text-base uppercase">Demo-verktøy</h2>

        <label className="mt-4 flex items-center justify-between gap-3 cursor-pointer">
          <div className="text-sm">
            <p className="font-medium">Vis debug-paneler</p>
            <p className="text-xs text-muted-foreground">Skjult i normal demo.</p>
          </div>
          <span
            onClick={() => setDebugMode(!debug)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${debug ? "bg-primary" : "bg-border"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${debug ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </span>
        </label>

        <button
          onClick={() => { if (confirm("Tilbakestille demo-data?")) { localStorage.removeItem("veiglede.v2"); localStorage.removeItem("veiglede.v3"); localStorage.removeItem("veiglede.v4"); localStorage.removeItem("veiglede.profile.v1"); location.reload(); } }}
          className="mt-4 w-full rounded-2xl border border-border bg-background py-2.5 text-xs uppercase tracking-wider hover:border-primary"
        >
          Tilbakestill demo-data
        </button>
      </section>

      <DangerZone />
    </div>
  );
}


/* ---------- helpers ---------- */

function Section({ title, caption, action, children }: { title: string; caption?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl uppercase">{title}</h2>
        <div className="flex items-center gap-3">
          {caption && <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">{caption}</span>}
          {action}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function VehicleCard({ vehicle, isDefault, onEdit, onSetDefault }: {
  vehicle: Vehicle; isDefault: boolean; onEdit: () => void; onSetDefault: () => void;
}) {
  const tm = vehicleMeta(vehicle.type);
  const em = energyMeta(vehicle.energy);
  const sm = styleMeta(vehicle.defaultStyle);
  return (
    <div className={`rounded-2xl border-2 p-4 transition-colors ${isDefault ? "border-primary bg-primary/5" : "border-border bg-surface"}`}>
      <div className="flex items-start gap-3">
        <div className="h-16 w-16 rounded-xl border border-border bg-surface-2 overflow-hidden grid place-items-center text-2xl shrink-0">
          {vehicle.photo ? <img src={vehicle.photo} alt={vehicle.name} className="h-full w-full object-cover" /> : <span>{tm.emoji}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="font-display text-lg uppercase leading-tight">{vehicle.name}</p>
            {isDefault && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                <Check className="h-3 w-3" /> Standard
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{tm.emoji} {tm.label} · {em.emoji} {em.label}</p>
          <p className="mt-1.5 text-[11px] text-primary uppercase tracking-wider">{sm.emoji} {sm.label}</p>
          {vehicle.stopInterests.length > 0 && (
            <p className="mt-1.5 text-[11px] text-muted-foreground truncate">
              {vehicle.stopInterests.slice(0, 6).map((t) => stopMeta(t).emoji).join(" ")}
            </p>
          )}
        </div>
        <button onClick={onEdit} className="text-muted-foreground hover:text-primary p-1.5" aria-label="Rediger">
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      {!isDefault && (
        <button onClick={onSetDefault} className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground hover:border-primary hover:text-primary">
          Sett som standard
        </button>
      )}
    </div>
  );
}


function MiniSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function ToggleRow({ icon, label, help, on, onChange, disabled, tag }: {
  icon: React.ReactNode; label: string; help: string; on: boolean;
  onChange: (next: boolean) => void; disabled?: boolean; tag?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 py-3 border-b border-border/60 last:border-0 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3 min-w-0">
        <span className="mt-0.5 h-8 w-8 rounded-lg bg-surface-2 grid place-items-center text-primary shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{label}</p>
            {tag && <span className="rounded-md border border-border px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">{tag}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{help}</p>
        </div>
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors mt-1 ${on ? "bg-primary" : "bg-border"} disabled:cursor-not-allowed`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${on ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}

function ThemeOption({ current, value, label, icon }: { current: Theme; value: Theme; label: string; icon: React.ReactNode }) {
  const active = current === value;
  return (
    <button
      onClick={() => setTheme(value)}
      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {icon} {label}
    </button>
  );
}
