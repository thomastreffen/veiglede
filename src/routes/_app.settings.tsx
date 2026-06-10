import { useState, useEffect, useCallback, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTripsStore } from "@/lib/trips-store";
import { useQuery } from "@tanstack/react-query";
import { useDebugMode, setDebugMode } from "@/components/DemoDebugPanel";
import { useAuth, signOut } from "@/lib/auth";
import { deleteMyAccount } from "@/lib/account";
import { supabase } from "@/integrations/supabase/client";
import { UsernamePicker } from "@/components/UsernamePicker";
import { getFollowStatsFn } from "@/lib/social.functions";
import { toast } from "sonner";
import { LogOut, LogIn, Trash2, AlertTriangle, ExternalLink, Moon, Sun, Lock, Link as LinkIcon, Image as ImageIcon, Radio, Plus, Globe, Eye, BarChart3, Car as CarIcon, Map, Gift, HelpCircle, ChevronRight } from "lucide-react";
import { useT } from "@/i18n/provider";
import { useTheme, setTheme, type Theme } from "@/lib/theme";
import { ROUTE_STYLES, stopMeta, vehicleMeta, styleMeta } from "@/lib/trips-store";
import {
  useDriverPrefs, updateDriverPrefs, toggleDrivingFlag, toggleStopInterest,
  DRIVING_FLAGS, STOP_INTERESTS,
} from "@/lib/driver-prefs";
import { useVehicles, vehiclesApi, type Vehicle } from "@/lib/vehicles-store";
import { VehicleEditor } from "@/components/VehicleEditor";
import { VehicleCard } from "@/components/VehicleCard";
import { BenefitsConsent } from "@/components/BenefitsConsent";
import { AvatarImg } from "@/lib/avatar";

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
        Dette sletter Veiglede-kontoen din og fjerner lokale Veiglede-data fra denne nettleseren. Profil, kjøretøy, turer, preferanser og delte turlenker fjernes permanent.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Hvis du logger inn igjen med samme Google-konto senere, opprettes en helt ny Veiglede-profil — gamle data hentes ikke tilbake.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Kan ikke angres. 30 dagers gjenoppretting kan komme senere.</p>
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


function ProfileHeader() {
  const { user } = useAuth();
  const prefs = useDriverPrefs();
  // Prefer the signed-in identity (Google → user_metadata.full_name); fall back
  // to the local driver display name only when no auth user is present.
  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string };
  const displayName = meta.full_name || meta.name || user?.email?.split("@")[0] || prefs.displayName;
  const email = user?.email ?? "Lokal demo-profil · ingen pålogging";
  const avatar = meta.avatar_url;
  const initial = (displayName || "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-display text-3xl overflow-hidden">
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-lg truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground truncate">{email}</p>
        <ProfileFollowStats />
      </div>
    </div>
  );
}

function ProfileFollowStats() {
  const { user } = useAuth();
  const [username, setUsername] = useState<string | null>(null);
  const fetchStats = useServerFn(getFollowStatsFn);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setUsername((data?.username as string | null) ?? null); });
    return () => { cancelled = true; };
  }, [user]);

  const { data: stats } = useQuery({
    queryKey: ["follow-stats", user?.id],
    queryFn: () => fetchStats({ data: { userId: user!.id } }),
    enabled: !!user,
    staleTime: 60_000,
  });

  if (!user || !stats || !username) return null;

  return (
    <p className="mt-1 text-xs text-muted-foreground">
      <Link to="/u/$username" params={{ username }} hash="followers" className="hover:text-primary hover:underline">
        {stats.followers} følgere
      </Link>
      {" · "}
      <Link to="/u/$username" params={{ username }} hash="following" className="hover:text-primary hover:underline">
        følger {stats.following}
      </Link>
    </p>
  );
}

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
    <div className="py-5 md:py-8 max-w-6xl mx-auto px-2 md:px-4">
      <header className="mb-6 md:mb-8">
        <p className="text-[11px] uppercase tracking-[0.24em] text-primary">Din profil</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl uppercase">Førerprofil</h1>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">Veiglede tilpasser ruter, stopp og forslag etter hvordan du liker å kjøre — og hvilket kjøretøy du tar med.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
        {/* Sidebar (desktop) / inline top (mobile) */}
        <aside className="md:col-span-1">
          <div className="md:sticky md:top-20 space-y-4">
            <SidebarProfile />
            <AccountCard />
            <QuickLinksCard />
            <SectionNav />
          </div>
        </aside>

        <div className="md:col-span-2 space-y-6">
      <StatsStrip />

      {/* 1 — Driver profile */}
      <Section id="sjafor" title="Sjåfør" caption="Grunninnstillinger">
        <ProfileHeader />

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

        <div className="mt-5 pt-5 border-t border-border/60">
          <UsernameField />
        </div>
      </Section>

      {/* 2 — My vehicles */}
      <Section
        id="garasje"
        title="Min garasje"
        caption={`${vehicles.length} ${vehicles.length === 1 ? "kjøretøy" : "kjøretøy"}`}
        action={
          <button onClick={openNew} className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20">
            <Plus className="h-3.5 w-3.5" /> Legg til
          </button>
        }
      >
        <p className="text-xs text-muted-foreground mb-3">Hvert kjøretøy har sin egen rutestil og foretrukne stopp. Velg standard ved å trykke «Sett som standard».</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      <Section id="korepreferanser" title="Kjørepreferanser" caption="Hva slags kjøring liker du?">
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
      <Section id="langs-ruta" title="Hva vil du se langs ruta?" caption="Personaliserer «Langs ruta» og partnertips">
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

      {/* 5b — Profile fields */}
      <Section id="profil" title="Profil" caption="Hvordan andre ser deg">
        <ProfileFieldsEditor />
      </Section>

      {/* 5c — Public profile privacy */}
      <Section id="personvern" title="Personvern" caption="Din offentlige profil">
        <PrivacyControls />
      </Section>

      {/* 6 — Appearance */}
      <Section id="utseende" title="Utseende" caption="Tema">
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
            <p className="font-medium">Vis debug-info</p>
            <p className="text-xs text-muted-foreground">Skjult i normal demo.</p>
          </div>
          <span
            onClick={() => setDebugMode(!debug)}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${debug ? "bg-primary" : "bg-border"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${debug ? "translate-x-[22px]" : "translate-x-0.5"}`} />
          </span>
        </label>

        {debug && (
          <button
            onClick={() => { if (confirm("Tilbakestille demo-data?")) { localStorage.removeItem("veiglede.v2"); localStorage.removeItem("veiglede.v3"); localStorage.removeItem("veiglede.v4"); localStorage.removeItem("veiglede.profile.v1"); location.reload(); } }}
            className="mt-4 w-full rounded-2xl border border-border bg-background py-2.5 text-xs uppercase tracking-wider hover:border-primary"
          >
            Tilbakestill demo-data
          </button>
        )}
      </section>

      <BenefitsConsent />

      <div id="konto" className="scroll-mt-24">
        <DangerZone />
      </div>
        </div>
      </div>
    </div>
  );
}


/* ---------- helpers ---------- */

function UsernameField() {
  const { user } = useAuth();
  const [current, setCurrent] = useState<string | null>(null);
  const [pending, setPending] = useState("");
  const [pendingOk, setPendingOk] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setCurrent((data?.username as string | null) ?? null); });
    return () => { cancelled = true; };
  }, [user]);

  const onChange = useCallback((v: string, ok: boolean) => {
    setPending(v);
    setPendingOk(ok);
  }, []);

  if (!user) return null;

  const dirty = pendingOk && !!pending && pending !== current;

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ username: pending }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Kunne ikke lagre brukernavn");
      return;
    }
    setCurrent(pending);
    toast.success("Brukernavn lagret");
  };

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">Offentlig profil</p>
      <UsernamePicker
        initialValue={current ?? ""}
        ownUserId={user.id}
        onChange={onChange}
      />
      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        {current ? (
          <a
            href={`/u/${current}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            👤 Se min offentlige profil <ExternalLink className="h-3 w-3" />
          </a>
        ) : <span />}
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Lagrer…" : "Lagre brukernavn"}
        </button>
      </div>
    </div>
  );
}


function ProfileFieldsEditor() {
  const { user } = useAuth();
  const debug = useDebugMode();
  const [loaded, setLoaded] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [initial, setInitial] = useState({ displayName: "", bio: "", avatarUrl: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("profiles").select("display_name, bio, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const dn = (data.display_name as string | null) ?? "";
        const b = (data.bio as string | null) ?? "";
        const a = (data.avatar_url as string | null) ?? "";
        setDisplayName(dn); setBio(b); setAvatarUrl(a);
        setInitial({ displayName: dn, bio: b, avatarUrl: a });
        setLoaded(true);
      });
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return <p className="text-sm text-muted-foreground">Logg inn for å redigere profil.</p>;
  if (!loaded) return <p className="text-sm text-muted-foreground">Laster…</p>;

  const dirty = displayName !== initial.displayName || bio !== initial.bio || avatarUrl !== initial.avatarUrl;
  const tooLongBio = bio.length > 160;
  const initialLetter = (displayName || user.email || "?").charAt(0).toUpperCase();

  const save = async () => {
    if (!dirty || tooLongBio) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: displayName.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl.trim() || null,
    }).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error("Kunne ikke lagre profil"); return; }
    setInitial({ displayName, bio, avatarUrl });
    toast.success("Profil lagret");
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    const { uploadProfileAvatar, cleanupOldAvatars } = await import("@/lib/profile-avatar");
    const res = await uploadProfileAvatar(file, user.id);
    if (!res.ok) {
      setUploading(false);
      toast.error(res.error);
      return;
    }
    const { error } = await supabase.from("profiles").update({ avatar_url: res.path }).eq("id", user.id);
    if (error) {
      setUploading(false);
      toast.error("Kunne ikke lagre profilbilde");
      return;
    }
    setAvatarUrl(res.path);
    setInitial((p) => ({ ...p, avatarUrl: res.path }));
    cleanupOldAvatars(user.id, res.path).catch(() => undefined);
    setUploading(false);
    toast.success("Profilbilde oppdatert");
  };

  const removeAvatar = async () => {
    if (!avatarUrl) return;
    setUploading(true);
    const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
    if (error) {
      setUploading(false);
      toast.error("Kunne ikke fjerne bilde");
      return;
    }
    const { cleanupOldAvatars } = await import("@/lib/profile-avatar");
    cleanupOldAvatars(user.id).catch(() => undefined);
    setAvatarUrl("");
    setInitial((p) => ({ ...p, avatarUrl: "" }));
    setUploading(false);
    toast.success("Profilbilde fjernet");
  };

  return (
    <div className="space-y-4">
      <div>
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Profilbilde</span>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-display text-3xl overflow-hidden shrink-0">
            {avatarUrl ? <AvatarImg value={avatarUrl} className="h-full w-full object-cover" /> : initialLetter}
          </div>
          <div className="flex flex-col gap-2 min-w-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={onPickFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
            >
              {uploading ? "Laster opp…" : "Last opp profilbilde"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={removeAvatar}
                disabled={uploading}
                className="inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2 disabled:opacity-50"
              >
                Fjern bilde
              </button>
            )}
            <p className="text-xs text-muted-foreground">JPG, PNG eller WebP. Maks 5 MB.</p>
          </div>
        </div>
      </div>
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Visningsnavn</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value.slice(0, 60))}
          placeholder="Ditt navn"
          className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </label>
      <label className="block">
        <span className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
          <span>Bio</span>
          <span className={tooLongBio ? "text-destructive" : ""}>{bio.length}/160</span>
        </span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="Kort om deg — bilstil, favorittruter, hva du jakter på."
          className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary resize-y"
        />
      </label>
      {debug && (
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Profilbilde (URL · debug)</span>
          <input
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
            className="w-full bg-surface-1 border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </label>
      )}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={!dirty || saving || tooLongBio}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Lagrer…" : "Lagre profil"}
        </button>
      </div>
    </div>
  );
}

type PrivacyFlags = { is_public: boolean; show_garage: boolean; show_trips: boolean; show_stats: boolean };

function PrivacyControls() {
  const { user } = useAuth();
  const [flags, setFlags] = useState<PrivacyFlags | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("profiles")
      .select("username, is_public, show_garage, show_trips, show_stats")
      .eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setUsername((data.username as string | null) ?? null);
        setFlags({
          is_public: data.is_public !== false,
          show_garage: data.show_garage !== false,
          show_trips: data.show_trips !== false,
          show_stats: data.show_stats !== false,
        });
      });
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return <p className="text-sm text-muted-foreground">Logg inn for å justere personvern.</p>;
  if (!flags) return <p className="text-sm text-muted-foreground">Laster…</p>;

  const patch = async (next: Partial<PrivacyFlags>) => {
    const merged = { ...flags, ...next };
    setFlags(merged);
    const { error } = await supabase.from("profiles").update(next).eq("id", user.id);
    if (error) {
      toast.error("Kunne ikke lagre");
      setFlags(flags);
    }
  };

  return (
    <div className="space-y-1">
      <ToggleRow
        icon={<Globe className="h-4 w-4" />}
        label="Offentlig profil"
        help="Når profilen er offentlig kan andre se profil, offentlig garasje og delte/offentlige turer. Private turer og live-posisjon deles aldri her."
        on={flags.is_public}
        onChange={(on) => patch({ is_public: on })}
      />
      {flags.is_public && (
        <div className="pl-4 border-l-2 border-primary/30 ml-1 mt-2 space-y-1">
          <ToggleRow
            icon={<CarIcon className="h-4 w-4" />}
            label="Vis garasje og kjøretøy"
            help="Vis kjøretøyene dine på profilen."
            on={flags.show_garage}
            onChange={(on) => patch({ show_garage: on })}
          />
          <ToggleRow
            icon={<Eye className="h-4 w-4" />}
            label="Vis mine offentlige turer"
            help="Vis turer du har gjort offentlige."
            on={flags.show_trips}
            onChange={(on) => patch({ show_trips: on })}
          />
          <ToggleRow
            icon={<BarChart3 className="h-4 w-4" />}
            label="Vis statistikk (km og antall turer)"
            help="Vis totalsummer på profilen din."
            on={flags.show_stats}
            onChange={(on) => patch({ show_stats: on })}
          />
        </div>
      )}
      {flags.is_public && username && (
        <a
          href={`/u/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          Se hvordan profilen din ser ut <ExternalLink className="h-3 w-3" /> →
        </a>
      )}
    </div>
  );
}




function Section({ id, title, caption, action, children }: { id?: string; title: string; caption?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 md:p-6">
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

/* ---------- Desktop dashboard pieces ---------- */

const NAV_ITEMS: { id: string; label: string }[] = [
  { id: "sjafor", label: "Sjåfør" },
  { id: "garasje", label: "Min garasje" },
  { id: "korepreferanser", label: "Kjørepreferanser" },
  { id: "langs-ruta", label: "Hva vil du se langs ruta?" },
  { id: "profil", label: "Profil" },
  { id: "personvern", label: "Personvern" },
  { id: "utseende", label: "Utseende" },
  { id: "konto", label: "Konto og data" },
];

function SidebarProfile() {
  const { user } = useAuth();
  const prefs = useDriverPrefs();
  const [username, setUsername] = useState<string | null>(null);
  const fetchStats = useServerFn(getFollowStatsFn);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.from("profiles").select("username").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (!cancelled) setUsername((data?.username as string | null) ?? null); });
    return () => { cancelled = true; };
  }, [user]);

  const { data: stats } = useQuery({
    queryKey: ["follow-stats", user?.id],
    queryFn: () => fetchStats({ data: { userId: user!.id } }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const meta = (user?.user_metadata ?? {}) as { full_name?: string; name?: string; avatar_url?: string };
  const displayName = meta.full_name || meta.name || user?.email?.split("@")[0] || prefs.displayName;
  const avatar = meta.avatar_url;
  const initial = (displayName || "?").charAt(0).toUpperCase();

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 text-center">
      <div className="mx-auto h-24 w-24 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-display text-4xl overflow-hidden">
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
      </div>
      <p className="mt-3 font-semibold text-base truncate">{displayName}</p>
      {username && <p className="text-xs text-muted-foreground">@{username}</p>}
      {stats && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="text-foreground font-medium">{stats.followers}</span> følgere
          {" · følger "}
          <span className="text-foreground font-medium">{stats.following}</span>
        </p>
      )}
      {username && (
        <a
          href={`/u/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Se min offentlige profil →
        </a>
      )}
    </div>
  );
}

function SectionNav() {
  const [active, setActive] = useState<string>(NAV_ITEMS[0].id);
  const clickedRef = useRef<{ id: string; until: number } | null>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        if (clickedRef.current && Date.now() < clickedRef.current.until) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 },
    );
    NAV_ITEMS.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const onClick = (id: string) => {
    setActive(id);
    clickedRef.current = { id, until: Date.now() + 800 };
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="hidden md:block rounded-2xl border border-border bg-surface p-3">
      <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">På siden</p>
      <ul className="space-y-0.5">
        {NAV_ITEMS.map((it) => {
          const on = active === it.id;
          return (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                onClick={(e) => { e.preventDefault(); onClick(it.id); }}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${on ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"}`}
              >
                {it.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function QuickLinksCard() {
  const t = useT();
  const { user } = useAuth();
  const p = t.app.profile;
  const items = [
    { to: "/trips" as const, label: p.myTrips, icon: <Map className="h-4 w-4" /> },
    { to: "/garage" as const, label: p.garage, subtitle: p.garageSubtitle, icon: <CarIcon className="h-4 w-4" /> },
    { to: "/fordeler" as const, label: p.fordeler, subtitle: p.fordelerSubtitle, icon: <Gift className="h-4 w-4" /> },
    { to: "/hjelp" as const, label: p.help, subtitle: p.helpSubtitle, icon: <HelpCircle className="h-4 w-4" /> },
  ];
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 space-y-0.5">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2 transition-colors"
        >
          <span className="h-8 w-8 rounded-lg bg-surface-2 grid place-items-center text-primary shrink-0">
            {item.icon}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{item.label}</p>
            {item.subtitle && <p className="text-xs text-muted-foreground">{item.subtitle}</p>}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </Link>
      ))}
      {user && (
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2 transition-colors text-left"
        >
          <span className="h-8 w-8 rounded-lg bg-surface-2 grid place-items-center text-primary shrink-0">
            <LogOut className="h-4 w-4" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{p.logout}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      )}
    </div>
  );
}

function StatsStrip() {
  const { user } = useAuth();
  const { trips: allTrips } = useTripsStore();
  const { vehicles } = useVehicles();
  const fetchStats = useServerFn(getFollowStatsFn);
  const { data: follow } = useQuery({
    queryKey: ["follow-stats", user?.id],
    queryFn: () => fetchStats({ data: { userId: user!.id } }),
    enabled: !!user,
    staleTime: 60_000,
  });

  const trips = allTrips.filter((t) => t.status !== "draft");
  const plannedKm = trips.reduce((a, t) => a + (t.distanceKm ?? 0), 0);
  const drivenKm = trips.reduce(
    (a, t) => a + (typeof t.actualDistanceKm === "number" && t.actualDistanceKm > 0 ? t.actualDistanceKm : 0),
    0,
  );

  return (
    <div className="grid grid-cols-4 md:grid-cols-5 gap-2 md:gap-3 rounded-2xl border border-border bg-surface p-3 md:p-4">
      <Cell n={String(trips.length)} l="turer" />
      {/* Combined km cell on mobile, two cells on desktop */}
      <div className="md:hidden text-center">
        <p className="font-display text-base leading-tight">
          {plannedKm.toLocaleString("nb-NO")}
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground ml-1">planlagt</span>
        </p>
        <p className="font-display text-base leading-tight mt-0.5">
          {Math.round(drivenKm).toLocaleString("nb-NO")}
          <span className="text-[9px] uppercase tracking-wider text-primary ml-1">kjørt</span>
        </p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">km</p>
      </div>
      <Cell className="hidden md:block" n={plannedKm.toLocaleString("nb-NO")} l="km planlagt" />
      <Cell className="hidden md:block" n={Math.round(drivenKm).toLocaleString("nb-NO")} l="km kjørt" accent />
      <Cell n={String(vehicles.length)} l="kjøretøy" />
      <Cell n={String(follow?.followers ?? 0)} l="følgere" />
    </div>
  );
}

function Cell({ n, l, accent, className }: { n: string; l: string; accent?: boolean; className?: string }) {
  return (
    <div className={`text-center ${className ?? ""}`}>
      <p className={`font-display text-2xl md:text-3xl ${accent ? "text-primary" : ""}`}>{n}</p>
      <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">{l}</p>
    </div>
  );
}


