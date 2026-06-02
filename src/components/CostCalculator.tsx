import { useMemo, useState } from "react";
import { Calculator, Fuel, Zap, Ship, Bed, Receipt, Users, ChevronDown } from "lucide-react";
import type { Trip, Stop, CostSettings } from "@/lib/trips-store";
import { tripsApi, tripFuelKind, computeEnergyCost } from "@/lib/trips-store";

interface VehicleDefaults {
  consumption: number;
  price: number;
  unit: "l" | "kWh";
  label: string;
  isElectric: boolean;
}

function defaultsFor(trip: Trip): VehicleDefaults {
  const kind = tripFuelKind(trip);
  const isMc = trip.vehicle === "motorcycle";
  const isRv = trip.vehicle === "rv";
  if (kind === "electric")
    return { consumption: 18, price: 3.5, unit: "kWh", label: "Lading", isElectric: true };
  if (isRv)
    return { consumption: 14, price: 18, unit: "l", label: "Diesel", isElectric: false };
  if (isMc)
    return { consumption: 5, price: 22, unit: "l", label: "Bensin", isElectric: false };
  if (kind === "diesel")
    return { consumption: 8, price: 18, unit: "l", label: "Diesel", isElectric: false };
  // petrol / hybrid / other car
  return { consumption: 8, price: 20, unit: "l", label: "Bensin", isElectric: false };
}

function fmtNok(n: number) {
  return `${Math.round(n).toLocaleString("nb-NO")} kr`;
}

export function CostCalculator({ trip, stops }: { trip: Trip; stops: Stop[] }) {
  const [open, setOpen] = useState(false);
  const settings = trip.costSettings ?? {};
  const def = defaultsFor(trip);

  const consumption = settings.fuelConsumptionPer100km ?? def.consumption;
  const energyPrice = def.isElectric
    ? (settings.electricityPricePerKwh ?? def.price)
    : (settings.fuelPricePerLiter ?? def.price);
  const toll = settings.tollEstimate ?? 0;
  const ferry = settings.ferryEstimate ?? 0;
  const other = settings.otherCosts ?? 0;
  const people = Math.max(1, settings.people ?? 1);

  const distanceKm = trip.distanceKm ?? 0;
  const energyCost = (distanceKm * consumption * energyPrice) / 100;

  const lodgingCost = useMemo(
    () =>
      stops
        .filter((s) => s.type === "lodging" && s.booking?.pricePerNight)
        .reduce((sum, s) => sum + (s.booking!.pricePerNight! * (s.booking!.nights ?? 1)), 0),
    [stops]
  );

  const total = energyCost + toll + ferry + lodgingCost + other;
  const perPerson = total / people;

  function patch(p: Partial<CostSettings>) {
    tripsApi.updateTrip(trip.id, {
      costSettings: { ...settings, ...p },
    });
  }

  const EnergyIcon = def.isElectric ? Zap : Fuel;

  return (
    <div className="mt-4 pt-3 border-t border-border/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <Calculator className="h-3 w-3" /> Kostnad
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="text-sm font-semibold text-primary font-mono tabular-nums">
            ca. {fmtNok(total)}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {/* Always-visible summary list */}
      <ul className="mt-3 space-y-1.5">
        <SummaryRow
          icon={<EnergyIcon className="h-3.5 w-3.5" />}
          label={`${def.label} (ca. ${((distanceKm * consumption) / 100).toFixed(distanceKm * consumption / 100 >= 10 ? 0 : 1)} ${def.unit})`}
          value={energyCost}
        />
        {(toll > 0 || ferry > 0) && (
          <>
            {toll > 0 && <SummaryRow icon={<Receipt className="h-3.5 w-3.5" />} label="Bom" value={toll} />}
            {ferry > 0 && <SummaryRow icon={<Ship className="h-3.5 w-3.5" />} label="Ferge" value={ferry} />}
          </>
        )}
        {lodgingCost > 0 && (
          <SummaryRow icon={<Bed className="h-3.5 w-3.5" />} label="Overnatting" value={lodgingCost} />
        )}
        {other > 0 && (
          <SummaryRow icon={<Receipt className="h-3.5 w-3.5" />} label="Andre kostnader" value={other} />
        )}
        <li className="flex items-center justify-between text-sm font-semibold pt-2 mt-1 border-t-2 border-primary/30">
          <span>TOTALT</span>
          <span className="font-mono tabular-nums text-primary">ca. {fmtNok(total)}</span>
        </li>
        {people > 1 && (
          <li className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Users className="h-3 w-3" /> Per person ({people})</span>
            <span className="font-mono tabular-nums">ca. {fmtNok(perPerson)}</span>
          </li>
        )}
      </ul>

      {open && (
        <div className="mt-4 pt-3 border-t border-border/40 grid grid-cols-2 gap-2.5 text-xs print:hidden">
          <Field
            label={`${def.unit}/100 km`}
            value={consumption}
            step={0.1}
            onChange={(v) => patch({ fuelConsumptionPer100km: v })}
          />
          <Field
            label={def.isElectric ? "kr/kWh" : "kr/liter"}
            value={energyPrice}
            step={0.1}
            onChange={(v) =>
              patch(def.isElectric ? { electricityPricePerKwh: v } : { fuelPricePerLiter: v })
            }
          />
          <Field
            label="Bom (kr)"
            value={toll}
            step={10}
            onChange={(v) => patch({ tollEstimate: v })}
          />
          <Field
            label="Ferge (kr)"
            value={ferry}
            step={10}
            onChange={(v) => patch({ ferryEstimate: v })}
          />
          <Field
            label="Andre kostnader (kr)"
            value={other}
            step={50}
            onChange={(v) => patch({ otherCosts: v })}
          />
          <Field
            label="Antall personer"
            value={people}
            step={1}
            min={1}
            onChange={(v) => patch({ people: Math.max(1, Math.round(v)) })}
          />
          <p className="col-span-2 text-[10px] text-muted-foreground leading-relaxed">
            Alle beløp er estimater. Overnatting hentes fra bookinger lagt inn på stoppene.
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <li className="flex items-center justify-between text-xs">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">{icon}<span className="truncate">{label}</span></span>
      <span className="font-mono tabular-nums text-foreground">ca. {fmtNok(value)}</span>
    </li>
  );
}

function Field({
  label, value, step, min, onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step ?? 1}
        min={min}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
    </label>
  );
}
