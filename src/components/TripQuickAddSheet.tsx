import { useRef, useState } from "react";
import { Camera, MapPin, StickyNote, Fuel, BedDouble, X } from "lucide-react";
import { toast } from "sonner";
import { tripsApi } from "@/lib/trips-store";
import { useAuth } from "@/lib/auth";

interface Props {
  tripId: string;
  open: boolean;
  onClose: () => void;
}

export function TripQuickAddSheet({ tripId, open, onClose }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const trip = tripsApi.getTrip(tripId);
  const days = tripsApi.getDaysForTrip(tripId);
  const firstDay = days[0];
  const firstStop = firstDay ? tripsApi.getStopsForDay(firstDay.id)[0] : undefined;

  const close = () => { if (!busy) onClose(); };

  const onPhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!user) { toast.error("Logg inn for å laste opp bilder"); return; }
    if (!firstStop) { toast.error("Legg til et stopp først"); return; }
    setBusy(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const photoId = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      const path = `${user.id}/${tripId}/${firstStop.id}/${photoId}.${ext}`;
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.storage.from("trip-photos").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type || "image/jpeg",
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("trip-photos").getPublicUrl(path);
      const ok = tripsApi.addStopPhoto(firstStop.id, { id: photoId, url: pub.publicUrl, path });
      if (!ok) toast.error("Maks 5 bilder per stopp");
      else toast.success("Bilde lagt til");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke laste opp bildet");
    } finally {
      setBusy(false);
    }
  };

  const goAddStop = () => {
    onClose();
    if (typeof window !== "undefined") {
      const target = document.getElementById("stops") ?? document.getElementById("suggestions");
      target?.scrollIntoView({ behavior: "smooth" });
    }
  };

  const addNote = () => {
    if (!firstDay) { toast.error("Ingen dag å legge notat til"); return; }
    const text = window.prompt("Skriv et notat:");
    if (!text || !text.trim()) return;
    tripsApi.addStop(firstDay.id, {
      name: "Notat",
      type: "rest",
      notes: text.trim(),
      description: text.trim(),
      durationMin: 0,
    });
    toast.success("Notat lagt til");
    onClose();
  };

  const addFuel = () => {
    if (!firstDay) { toast.error("Ingen dag tilgjengelig"); return; }
    tripsApi.addStop(firstDay.id, {
      name: "Drivstoffstopp",
      type: "fuel",
      description: "Tanking / lading.",
      reason: "Lagt til via hurtigvalg.",
      durationMin: 10,
    });
    toast.success("Drivstoffstopp lagt til");
    onClose();
  };

  const addLodging = () => {
    const stop = tripsApi.addOvernight(tripId, trip?.destination);
    if (stop) {
      toast.success("Overnatting lagt til");
      onClose();
    } else {
      toast.error("Kunne ikke legge til overnatting");
    }
  };

  const items: { icon: React.ReactNode; label: string; onClick: () => void }[] = [
    { icon: <Camera className="h-5 w-5" />, label: "📷 Ta bilde / Last opp bilde", onClick: () => fileRef.current?.click() },
    { icon: <MapPin className="h-5 w-5" />, label: "📍 Legg til stopp", onClick: goAddStop },
    { icon: <StickyNote className="h-5 w-5" />, label: "📝 Legg til notat", onClick: addNote },
    { icon: <Fuel className="h-5 w-5" />, label: "⛽ Legg til drivstoffstopp", onClick: addFuel },
    { icon: <BedDouble className="h-5 w-5" />, label: "🏨 Legg til overnatting", onClick: addLodging },
  ];

  return (
    <div
      className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end animate-in fade-in"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full bg-surface border-t border-border rounded-t-3xl pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1 w-10 rounded-full bg-border" />
        </div>
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
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPhotoPick}
      />
    </div>
  );
}
