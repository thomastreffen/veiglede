import { useRef, useState } from "react";
import { Camera, MapPin, StickyNote, Fuel, BedDouble, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { tripsApi } from "@/lib/trips-store";
import { useAuth } from "@/lib/auth";

interface Props {
  tripId: string;
  open: boolean;
  onClose: () => void;
}

type Mode = "menu" | "fuel" | "lodging";

export function TripQuickAddSheet({ tripId, open, onClose }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");

  // Fuel form
  const [fuelName, setFuelName] = useState("");
  const [fuelPrice, setFuelPrice] = useState("");

  // Lodging form
  const bundle = open ? tripsApi.getTripBundle(tripId) : { trip: null, days: [], stops: [] };
  const trip = bundle.trip;
  const days = [...bundle.days].sort((a, b) => a.dayNumber - b.dayNumber);
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const firstStop = firstDay ? bundle.stops.filter((s) => s.dayId === firstDay.id).sort((a, b) => a.order - b.order)[0] : undefined;

  const [lodgingName, setLodgingName] = useState("");
  const [lodgingDate, setLodgingDate] = useState(trip?.startDate ?? new Date().toISOString().slice(0, 10));
  const [lodgingNights, setLodgingNights] = useState("1");

  if (!open) return null;

  const reset = () => {
    setMode("menu");
    setFuelName(""); setFuelPrice("");
    setLodgingName(""); setLodgingNights("1");
  };
  const close = () => { if (!busy) { reset(); onClose(); } };

  const onPhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!user) { toast.error("Logg inn for å laste opp bilder"); return; }
    setBusy(true);
    try {
      console.log("uploading photo...");
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const photoId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      const path = `${user.id}/${tripId}/${Date.now()}_${photoId}.${ext}`;
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.storage.from("trip-photos").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type || "image/jpeg",
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("trip-photos").getPublicUrl(path);
      console.log(`upload complete: ${pub.publicUrl}`);
      const { data: row, error: dbErr } = await supabase
        .from("trip_photos")
        .insert({ trip_id: tripId, stop_id: firstStop?.id ?? null, user_id: user.id, url: pub.publicUrl, path })
        .select("id")
        .single();
      if (dbErr) throw dbErr;
      console.log(`saved to db: ${row?.id}`);
      if (firstStop) tripsApi.addStopPhoto(firstStop.id, { id: photoId, url: pub.publicUrl, path });
      toast.success("Bilde lagt til");
      close();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`error: ${msg}`);
      toast.error("Kunne ikke laste opp bilde — prøv igjen");
    } finally {
      setBusy(false);
    }
  };

  const goAddStop = () => {
    close();
    if (typeof window !== "undefined") {
      setTimeout(() => {
        const target = document.getElementById("suggestions") ?? document.getElementById("stops");
        target?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  };

  const addNote = () => {
    if (!firstDay) { toast.error("Ingen dag å legge notat til"); return; }
    const text = window.prompt("Skriv et notat:");
    if (!text || !text.trim()) return;
    tripsApi.addStop(firstDay.id, {
      name: "Notat", type: "rest", notes: text.trim(), description: text.trim(), durationMin: 0,
    });
    toast.success("Notat lagt til");
    close();
  };

  const submitFuel = () => {
    if (!firstDay) { toast.error("Ingen dag tilgjengelig"); return; }
    const name = fuelName.trim() || "Drivstoffstopp";
    const price = fuelPrice.trim() ? Number(fuelPrice.replace(",", ".")) : null;
    const desc = price && !Number.isNaN(price) ? `Tanking / lading. Estimert pris: ${price.toFixed(2)} kr/l.` : "Tanking / lading.";
    tripsApi.addStop(firstDay.id, {
      name, type: "fuel", location: fuelName.trim() || undefined,
      description: desc, reason: "Lagt til via hurtigvalg.", durationMin: 10,
    });
    toast.success("Drivstoffstopp lagt til");
    close();
  };

  const submitLodging = () => {
    if (!lastDay) { toast.error("Ingen dag tilgjengelig"); return; }
    const name = lodgingName.trim() || `Overnatting i ${trip?.destination ?? ""}`.trim();
    const nights = Math.max(1, Number(lodgingNights) || 1);
    tripsApi.addStop(lastDay.id, {
      name, type: "lodging", location: lodgingName.trim() || trip?.destination,
      description: `Overnatting${nights > 1 ? ` (${nights} netter)` : ""}.${lodgingDate ? ` Innsjekk ${lodgingDate}.` : ""}`,
      reason: "Lagt til via hurtigvalg.", durationMin: 720 * nights,
    });
    toast.success("Overnatting lagt til");
    close();
  };

  const items: { icon: React.ReactNode; label: string; onClick: () => void }[] = [
    { icon: <Camera className="h-5 w-5" />, label: "📷 Ta bilde / Last opp bilde", onClick: () => fileRef.current?.click() },
    { icon: <MapPin className="h-5 w-5" />, label: "📍 Legg til stopp", onClick: goAddStop },
    { icon: <StickyNote className="h-5 w-5" />, label: "📝 Legg til notat", onClick: addNote },
    { icon: <Fuel className="h-5 w-5" />, label: "⛽ Legg til drivstoffstopp", onClick: () => setMode("fuel") },
    { icon: <BedDouble className="h-5 w-5" />, label: "🏨 Legg til overnatting", onClick: () => setMode("lodging") },
  ];

  return (
    <div
      className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end animate-in fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full bg-surface border-t border-border rounded-t-3xl pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom duration-200 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>

        {mode === "menu" && (
          <div className="px-4 py-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground px-2 pb-2">Legg til i turen</p>
            <ul className="space-y-1.5">
              {items.map((it, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={it.onClick}
                    disabled={busy}
                    className="w-full flex items-center gap-3 rounded-2xl bg-background/60 hover:bg-surface-2 active:bg-surface-2 px-4 min-h-[56px] text-left text-base font-medium disabled:opacity-60"
                  >
                    <span className="grid place-items-center h-10 w-10 rounded-xl bg-surface-2 text-primary shrink-0">{it.icon}</span>
                    <span className="flex-1">{it.label}</span>
                  </button>
                </li>
              ))}
              <li className="pt-1">
                <button
                  type="button"
                  onClick={close}
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border px-4 min-h-[56px] text-base text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" /> Avbryt
                </button>
              </li>
            </ul>
          </div>
        )}

        {mode === "fuel" && (
          <FormShell title="Legg til drivstoffstopp" onBack={() => setMode("menu")}>
            <Field label="Stedsnavn">
              <input
                autoFocus
                value={fuelName}
                onChange={(e) => setFuelName(e.target.value)}
                placeholder="F.eks. Circle K Lillehammer"
                className="form-input"
              />
            </Field>
            <Field label="Estimert pris per liter (valgfritt)">
              <input
                type="number" inputMode="decimal" step="0.01"
                value={fuelPrice}
                onChange={(e) => setFuelPrice(e.target.value)}
                placeholder="F.eks. 21.90"
                className="form-input"
              />
            </Field>
            <SubmitRow onCancel={close} onSubmit={submitFuel} label="Legg til drivstoffstopp" />
          </FormShell>
        )}

        {mode === "lodging" && (
          <FormShell title="Legg til overnatting" onBack={() => setMode("menu")}>
            <Field label="Stedsnavn / hotellnavn">
              <input
                autoFocus
                value={lodgingName}
                onChange={(e) => setLodgingName(e.target.value)}
                placeholder="F.eks. Scandic Geilo"
                className="form-input"
              />
            </Field>
            <Field label="Dato">
              <input
                type="date"
                value={lodgingDate}
                onChange={(e) => setLodgingDate(e.target.value)}
                className="form-input"
              />
            </Field>
            <Field label="Antall netter">
              <input
                type="number" inputMode="numeric" min={1}
                value={lodgingNights}
                onChange={(e) => setLodgingNights(e.target.value)}
                className="form-input"
              />
            </Field>
            <SubmitRow onCancel={close} onSubmit={submitLodging} label="Legg til overnatting" />
          </FormShell>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPhotoPick}
      />

      <style>{`
        .form-input {
          width: 100%;
          min-height: 48px;
          border-radius: 12px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background) / 0.6);
          padding: 0 14px;
          color: inherit;
          font-size: 15px;
        }
        .form-input:focus { outline: 2px solid hsl(var(--primary) / 0.5); outline-offset: 0; }
      `}</style>
    </div>
  );
}

function FormShell({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 px-1 pb-3">
        <button type="button" onClick={onBack} className="grid place-items-center h-9 w-9 rounded-lg hover:bg-surface-2 text-muted-foreground" aria-label="Tilbake">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function SubmitRow({ onCancel, onSubmit, label }: { onCancel: () => void; onSubmit: () => void; label: string }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="button" onClick={onCancel} className="flex-1 min-h-[48px] rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground">
        Avbryt
      </button>
      <button type="button" onClick={onSubmit} className="flex-[2] min-h-[48px] rounded-2xl bg-primary text-primary-foreground text-sm font-bold uppercase tracking-wider hover:brightness-110">
        {label}
      </button>
    </div>
  );
}
