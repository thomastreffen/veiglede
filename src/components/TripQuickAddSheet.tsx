import { useMemo, useRef, useState } from "react";
import { Camera, MapPin, StickyNote, Fuel, BedDouble, X, ArrowLeft, Zap } from "lucide-react";
import { toast } from "sonner";
import { tripsApi, tripFuelKind } from "@/lib/trips-store";
import { useAuth } from "@/lib/auth";
import { uploadTripPhoto } from "@/lib/trip-photo-upload";
import { PlaceAutocomplete } from "@/components/PlaceAutocomplete";
import type { ResolvedPlace, SearchOptions } from "@/lib/places/geocoder";
import { routeMidpointAndLengthKm } from "@/lib/geo";

const PETROL_CHIPS = ["Circle K", "Uno-X", "Shell", "Esso", "Best"] as const;
const CHARGING_CHIPS = ["Recharge", "Mer", "Tesla", "Ionity", "Asko", "Fortum"] as const;
const LODGING_CHIPS = ["Hotell", "Hytte", "Camping", "Scandic", "Thon", "Nordic Choice"] as const;


interface Props {
  tripId: string;
  open: boolean;
  onClose: () => void;
}

type Mode = "menu" | "stop" | "fuel" | "lodging";

export function TripQuickAddSheet({ tripId, open, onClose }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");

  const bundle = open ? tripsApi.getTripBundle(tripId) : { trip: null, days: [], stops: [] };
  const trip = bundle.trip;
  const days = [...bundle.days].sort((a, b) => a.dayNumber - b.dayNumber);
  const firstDay = days[0];
  const lastDay = days[days.length - 1];
  const firstStop = firstDay ? bundle.stops.filter((s) => s.dayId === firstDay.id).sort((a, b) => a.order - b.order)[0] : undefined;

  // Proximity bias for POI searches — route midpoint when available,
  // otherwise the first stop, otherwise the centre of Norway.
  const proximity = useMemo<{ lng: number; lat: number }>(() => {
    const geom = trip?.routeGeometry && trip.routeGeometry.length > 1 ? trip.routeGeometry : null;
    const mid = geom ? routeMidpointAndLengthKm(geom)?.mid : null;
    if (mid) return { lng: mid.lng, lat: mid.lat };
    if (firstStop?.lat != null && firstStop?.lng != null) return { lng: firstStop.lng, lat: firstStop.lat };
    return { lng: 9.0, lat: 61.0 };
  }, [trip?.routeGeometry, firstStop?.lat, firstStop?.lng]);

  // Trip fuel kind drives whether we search for gas stations, chargers, or both.
  const tripKind = trip ? tripFuelKind(trip) : "other";
  const [fuelSubMode, setFuelSubMode] = useState<"petrol" | "charging">(
    tripKind === "electric" ? "charging" : "petrol"
  );
  // When hybrid, user can toggle; otherwise forced by tripKind.
  const effectiveFuelMode: "petrol" | "charging" =
    tripKind === "electric" ? "charging" :
    tripKind === "hybrid" ? fuelSubMode : "petrol";

  const fuelSearchOptions = useMemo<SearchOptions>(() => ({
    category: effectiveFuelMode === "charging" ? "charging" : "fuel",
    proximity,
  }), [proximity, effectiveFuelMode]);
  const lodgingSearchOptions = useMemo<SearchOptions>(() => ({
    category: "lodging", proximity,
  }), [proximity]);
  const stopSearchOptions = useMemo<SearchOptions>(() => ({
    proximity,
  }), [proximity]);


  // Stop form
  const [stopText, setStopText] = useState("");
  const [stopPlace, setStopPlace] = useState<ResolvedPlace | null>(null);

  // Fuel form
  const [fuelText, setFuelText] = useState("");
  const [fuelPlace, setFuelPlace] = useState<ResolvedPlace | null>(null);
  const [fuelPrice, setFuelPrice] = useState("");

  // Lodging form
  const defaultLodgingDate = trip?.startDate ?? new Date().toISOString().slice(0, 10);
  const addDaysIso = (iso: string, days: number) => {
    const d = new Date(iso);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const [lodgingText, setLodgingText] = useState("");
  const [lodgingPlace, setLodgingPlace] = useState<ResolvedPlace | null>(null);
  const [lodgingDate, setLodgingDate] = useState(defaultLodgingDate);
  const [lodgingCheckout, setLodgingCheckout] = useState(addDaysIso(defaultLodgingDate, 1));
  const [lodgingNights, setLodgingNights] = useState("1");
  const [lodgingGuests, setLodgingGuests] = useState("2");
  const [lodgingPrice, setLodgingPrice] = useState("");
  const [lodgingStatus, setLodgingStatus] = useState<"none" | "booked" | "paid">("none");

  if (!open) return null;

  const reset = () => {
    setMode("menu");
    setStopText(""); setStopPlace(null);
    setFuelText(""); setFuelPlace(null); setFuelPrice("");
    setLodgingText(""); setLodgingPlace(null);
    setLodgingDate(defaultLodgingDate);
    setLodgingCheckout(addDaysIso(defaultLodgingDate, 1));
    setLodgingNights("1"); setLodgingGuests("2"); setLodgingPrice(""); setLodgingStatus("none");
  };
  const close = () => { if (!busy) { reset(); onClose(); } };

  const onPhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (!user) { toast.error("Logg inn for å laste opp bilder"); return; }
    setBusy(true);
    try {
      let ok = 0;
      for (const file of files) {
        const res = await uploadTripPhoto({ file, tripId, userId: user.id, stopId: firstStop?.id ?? null });
        if (res) {
          ok++;
          if (firstStop) tripsApi.addStopPhoto(firstStop.id, { id: res.id, url: res.url, path: res.path });
        }
      }
      if (ok === 0) {
        toast.error("Kunne ikke laste opp bilde — prøv igjen");
      } else {
        toast.success(ok === 1 ? "Bilde lagt til" : `${ok} bilder lagt til`);
        close();
      }
    } finally {
      setBusy(false);
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

  const addStopWithPlacement = (placement: "along" | "detour" | "new-day") => {
    if (!stopPlace) return;
    const target = placement === "new-day" ? lastDay : firstDay;
    if (!target) { toast.error("Ingen dag tilgjengelig"); return; }
    const labelByPlacement = {
      along: { type: "attraction" as const, routeStatus: "on-route" as const, msg: "Lagt til langs ruta" },
      detour: { type: "detour" as const, routeStatus: "detour" as const, msg: "Lagt til som avstikker" },
      "new-day": { type: "attraction" as const, routeStatus: undefined, msg: "Lagt til på egen dag" },
    }[placement];
    tripsApi.addStop(target.id, {
      name: stopPlace.name,
      location: stopPlace.secondary ?? stopPlace.label,
      lat: stopPlace.lat, lng: stopPlace.lng,
      type: labelByPlacement.type,
      placement,
      routeStatus: labelByPlacement.routeStatus,
      reason: "Lagt til via hurtigvalg.",
      durationMin: 30,
    });
    toast.success(`${labelByPlacement.msg}: ${stopPlace.name}`);
    close();
  };

  const submitFuel = () => {
    if (!firstDay) { toast.error("Ingen dag tilgjengelig"); return; }
    if (!fuelPlace) { toast.error("Velg et sted fra listen"); return; }
    const price = fuelPrice.trim() ? Number(fuelPrice.replace(",", ".")) : null;
    const isCharging = effectiveFuelMode === "charging";
    const unitLabel = isCharging ? "kr/kWh" : "kr/l";
    const desc = price && !Number.isNaN(price)
      ? `${isCharging ? "Lading" : "Tanking"}. Estimert pris: ${price.toFixed(2)} ${unitLabel}.`
      : isCharging ? "Lading." : "Tanking.";
    tripsApi.addStop(firstDay.id, {
      name: fuelPlace.name,
      type: "fuel",
      energy: isCharging ? "electric" : (tripKind === "diesel" ? "diesel" : "petrol"),
      location: fuelPlace.secondary ?? fuelPlace.label,
      lat: fuelPlace.lat, lng: fuelPlace.lng,
      description: desc,
      reason: "Lagt til via hurtigvalg.",
      durationMin: isCharging ? 25 : 10,
    });
    toast.success(`${isCharging ? "Ladestopp" : "Drivstoffstopp"} lagt til: ${fuelPlace.name}`);
    close();
  };


  const submitLodging = () => {
    if (!lastDay) { toast.error("Ingen dag tilgjengelig"); return; }
    if (!lodgingPlace) { toast.error("Velg et sted fra listen"); return; }
    const nights = Math.max(1, Number(lodgingNights) || 1);
    const guests = lodgingGuests.trim() ? Math.max(1, Number(lodgingGuests) || 1) : undefined;
    const price = lodgingPrice.trim() ? Number(lodgingPrice.replace(",", ".")) : undefined;
    const validPrice = price != null && !Number.isNaN(price) && price > 0 ? price : undefined;
    const checkout = lodgingCheckout || addDaysIso(lodgingDate, nights);
    tripsApi.addStop(lastDay.id, {
      name: lodgingPlace.name,
      type: "lodging",
      location: lodgingPlace.secondary ?? lodgingPlace.label,
      lat: lodgingPlace.lat, lng: lodgingPlace.lng,
      description: `Overnatting${nights > 1 ? ` (${nights} netter)` : ""}.${lodgingDate ? ` Innsjekk ${lodgingDate}.` : ""}${validPrice ? ` ${validPrice.toFixed(0)} kr/natt.` : ""}`,
      reason: "Lagt til via hurtigvalg.",
      durationMin: 720 * nights,
      booking: {
        checkinDate: lodgingDate,
        checkoutDate: checkout,
        nights,
        guests,
        pricePerNight: validPrice,
        status: lodgingStatus,
      },
    });
    toast.success(`Overnatting lagt til: ${lodgingPlace.name}`);
    close();
  };


  const items: { icon: React.ReactNode; label: string; onClick: () => void }[] = [
    { icon: <Camera className="h-5 w-5" />, label: "📷 Ta bilde / Last opp bilde", onClick: () => fileRef.current?.click() },
    { icon: <MapPin className="h-5 w-5" />, label: "📍 Legg til stopp", onClick: () => setMode("stop") },
    { icon: <StickyNote className="h-5 w-5" />, label: "📝 Legg til notat", onClick: addNote },
    { icon: tripKind === "electric" ? <Zap className="h-5 w-5" /> : <Fuel className="h-5 w-5" />, label: tripKind === "electric" ? "⚡ Legg til ladestopp" : tripKind === "hybrid" ? "⛽⚡ Legg til drivstoff / lading" : "⛽ Legg til drivstoffstopp", onClick: () => setMode("fuel") },
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

        {mode === "stop" && (
          <FormShell title="Legg til stopp" onBack={() => setMode("menu")}>
            <PlaceField
              label="Søk etter sted"
              text={stopText}
              place={stopPlace}
              onTextChange={setStopText}
              onSelect={setStopPlace}
              placeholder="By, attraksjon eller adresse"
              searchOptions={stopSearchOptions}
            />
            {stopPlace && (
              <div className="space-y-2 pt-1">
                <p className="text-[12px] text-muted-foreground px-1">Hvor i turen?</p>
                <PlacementButton
                  title="Legg inn i ruta"
                  subtitle="Endrer hovedruta så den går gjennom stedet"
                  onClick={() => addStopWithPlacement("along")}
                />
                <PlacementButton
                  title="Avstikker"
                  subtitle="Beholder hovedruta, vises som ekstra tur"
                  onClick={() => addStopWithPlacement("detour")}
                />
                <PlacementButton
                  title="Egen dag"
                  subtitle="Legg til på en ny dag"
                  onClick={() => addStopWithPlacement("new-day")}
                />
                <button
                  type="button"
                  onClick={close}
                  className="w-full min-h-[44px] rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground"
                >
                  Avbryt
                </button>
              </div>
            )}
          </FormShell>
        )}

        {mode === "fuel" && (
          <FormShell
            title={effectiveFuelMode === "charging" ? "Legg til ladestopp" : "Legg til drivstoffstopp"}
            onBack={() => setMode("menu")}
          >
            {tripKind === "hybrid" && !fuelPlace && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setFuelSubMode("petrol")}
                  className={`flex-1 min-h-9 rounded-full border px-3 text-xs font-medium ${effectiveFuelMode === "petrol" ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground"}`}
                >
                  ⛽ Drivstoff
                </button>
                <button
                  type="button"
                  onClick={() => setFuelSubMode("charging")}
                  className={`flex-1 min-h-9 rounded-full border px-3 text-xs font-medium ${effectiveFuelMode === "charging" ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground"}`}
                >
                  ⚡ Lading
                </button>
              </div>
            )}
            {!fuelPlace && (
              <ChipRow
                chips={(effectiveFuelMode === "charging" ? CHARGING_CHIPS : PETROL_CHIPS) as unknown as string[]}
                onPick={(brand) => { setFuelPlace(null); setFuelText((prev) => combineChip(brand, prev)); }}
              />
            )}
            <PlaceField
              label={effectiveFuelMode === "charging" ? "Søk etter ladestasjon" : "Søk etter bensinstasjon"}
              text={fuelText}
              place={fuelPlace}
              onTextChange={setFuelText}
              onSelect={setFuelPlace}
              placeholder={effectiveFuelMode === "charging" ? "F.eks. Recharge Dombås" : "F.eks. Circle K Lillehammer"}
              searchOptions={fuelSearchOptions}
            />

            {fuelPlace && (
              <Field label={effectiveFuelMode === "charging" ? "Pris per kWh (valgfritt)" : "Pris per liter (valgfritt)"}>
                <input
                  type="number" inputMode="decimal" step="0.01"
                  value={fuelPrice}
                  onChange={(e) => setFuelPrice(e.target.value)}
                  placeholder={effectiveFuelMode === "charging" ? "F.eks. 5.90" : "F.eks. 21.90"}
                  className="form-input"
                />
              </Field>
            )}
            <SubmitRow
              onCancel={close}
              onSubmit={submitFuel}
              label={effectiveFuelMode === "charging" ? "Legg til ladestopp" : "Legg til drivstoffstopp"}
              disabled={!fuelPlace}
            />
          </FormShell>

        )}

        {mode === "lodging" && (
          <FormShell title="Legg til overnatting" onBack={() => setMode("menu")}>
            {!lodgingPlace && (
              <ChipRow
                chips={LODGING_CHIPS as unknown as string[]}
                onPick={(brand) => { setLodgingPlace(null); setLodgingText((prev) => combineChip(brand, prev)); }}
              />
            )}
            <PlaceField
              label="Søk etter hotell, hytte eller camping"
              text={lodgingText}
              place={lodgingPlace}
              onTextChange={setLodgingText}
              onSelect={setLodgingPlace}
              placeholder="F.eks. Scandic Geilo"
              searchOptions={lodgingSearchOptions}
            />

            {lodgingPlace && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Innsjekk">
                    <input
                      type="date"
                      value={lodgingDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLodgingDate(v);
                        const n = Math.max(1, Number(lodgingNights) || 1);
                        setLodgingCheckout(addDaysIso(v, n));
                      }}
                      className="form-input"
                    />
                  </Field>
                  <Field label="Utsjekk">
                    <input
                      type="date"
                      value={lodgingCheckout}
                      min={lodgingDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLodgingCheckout(v);
                        const ms = new Date(v).getTime() - new Date(lodgingDate).getTime();
                        const n = Math.max(1, Math.round(ms / 86400000));
                        if (!Number.isNaN(n)) setLodgingNights(String(n));
                      }}
                      className="form-input"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Antall netter">
                    <input
                      type="number" inputMode="numeric" min={1}
                      value={lodgingNights}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setLodgingNights(raw);
                        const n = Math.max(1, Number(raw) || 1);
                        setLodgingCheckout(addDaysIso(lodgingDate, n));
                      }}
                      className="form-input"
                    />
                  </Field>
                  <Field label="Gjester">
                    <input
                      type="number" inputMode="numeric" min={1}
                      value={lodgingGuests}
                      onChange={(e) => setLodgingGuests(e.target.value)}
                      className="form-input"
                    />
                  </Field>
                </div>
                <Field label="Pris per natt (NOK, valgfritt)">
                  <input
                    type="number" inputMode="decimal" min={0} step="1"
                    value={lodgingPrice}
                    onChange={(e) => setLodgingPrice(e.target.value)}
                    placeholder="F.eks. 1490"
                    className="form-input"
                  />
                  {lodgingPrice.trim() && !Number.isNaN(Number(lodgingPrice.replace(",", "."))) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Totalt: {(Number(lodgingPrice.replace(",", ".")) * Math.max(1, Number(lodgingNights) || 1)).toFixed(0)} kr
                    </p>
                  )}
                </Field>
                <Field label="Bookingstatus">
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { v: "none", label: "Ikke booket" },
                        { v: "booked", label: "Booket" },
                        { v: "paid", label: "Betalt" },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setLodgingStatus(opt.v)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                          lodgingStatus === opt.v
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-background/60 text-muted-foreground"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}
            <SubmitRow onCancel={close} onSubmit={submitLodging} label="Legg til overnatting" disabled={!lodgingPlace} />
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

function PlaceField({
  label, text, place, onTextChange, onSelect, placeholder, searchOptions,
}: {
  label: string;
  text: string;
  place: ResolvedPlace | null;
  onTextChange: (t: string) => void;
  onSelect: (p: ResolvedPlace | null) => void;
  placeholder?: string;
  searchOptions?: import("@/lib/places/geocoder").SearchOptions;
}) {
  if (place) {
    return (
      <div>
        <span className="block text-[12px] text-muted-foreground mb-1.5">{label}</span>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2.5">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{place.name}</p>
            {place.secondary && <p className="text-[11px] text-muted-foreground truncate">{place.secondary}</p>}
          </div>
          <button
            type="button"
            onClick={() => { onSelect(null); onTextChange(""); }}
            className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline shrink-0"
          >
            Endre
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <span className="block text-[12px] text-muted-foreground mb-1.5">{label}</span>
      <PlaceAutocomplete
        value={text}
        onTextChange={onTextChange}
        selected={null}
        onSelect={onSelect}
        placeholder={placeholder}
        searchOptions={searchOptions}
      />
    </div>
  );
}

function PlacementButton({ title, subtitle, onClick }: { title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border bg-background/60 hover:bg-surface-2 px-4 py-3 min-h-[56px]"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
    </button>
  );
}

function SubmitRow({ onCancel, onSubmit, label, disabled }: { onCancel: () => void; onSubmit: () => void; label: string; disabled?: boolean }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="button" onClick={onCancel} className="flex-1 min-h-[48px] rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground">
        Avbryt
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="flex-[2] min-h-[48px] rounded-2xl bg-primary text-primary-foreground text-sm font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {label}
      </button>
    </div>
  );
}

function ChipRow({ chips, onPick }: { chips: string[]; onPick: (label: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          className="rounded-full border border-border bg-background/60 hover:bg-surface-2 active:bg-surface-2 px-3 py-1.5 text-xs font-medium text-foreground"
        >
          {c}
        </button>
      ))}
    </div>
  );
}

// Combine a quick-chip brand/type with any text the user has already typed,
// so tapping "Scandic" after typing "risør" searches "Scandic risør".
function combineChip(chip: string, prev: string): string {
  const existing = (prev ?? "").trim();
  if (!existing) return chip;
  const lcExisting = existing.toLowerCase();
  if (lcExisting.includes(chip.toLowerCase())) return existing;
  return `${chip} ${existing}`;
}
