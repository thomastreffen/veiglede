import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { VEHICLES, ROUTE_STYLES, stopMeta, vehicleMeta, type VehicleType, type RouteStyle, type StopType } from "@/lib/trips-store";
import {
  ENERGIES, defaultsFor, vehiclesApi, energyMeta,
  type Vehicle, type EnergyType,
} from "@/lib/vehicles-store";
import { DRIVING_FLAGS, STOP_INTERESTS } from "@/lib/driver-prefs";
import { Camera, Trash2, Upload } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: Vehicle; // edit mode if present
  onSaved?: (vehicle: Vehicle) => void;
}

export function VehicleEditor({ open, onOpenChange, vehicle, onSaved }: Props) {
  const isEdit = !!vehicle;
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<VehicleType>("motorcycle");
  const [energy, setEnergy] = useState<EnergyType>("petrol");
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [style, setStyle] = useState<RouteStyle>("curvy");
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [interests, setInterests] = useState<StopType[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Initialize when opening
  useEffect(() => {
    if (!open) return;
    if (vehicle) {
      setName(vehicle.name);
      setNickname(vehicle.nickname ?? "");
      setDescription(vehicle.description ?? "");
      setType(vehicle.type);
      setEnergy(vehicle.energy);
      setPhoto(vehicle.photo);
      setStyle(vehicle.defaultStyle);
      setFlags(vehicle.drivingFlags);
      setInterests(vehicle.stopInterests);
    } else {
      const d = defaultsFor("motorcycle", "petrol");
      setName("");
      setNickname("");
      setDescription("");
      setType("motorcycle");
      setEnergy("petrol");
      setPhoto(undefined);
      setStyle(d.defaultStyle);
      setFlags(d.drivingFlags);
      setInterests(d.stopInterests);
    }
  }, [open, vehicle]);

  // When type or energy changes in CREATE mode, refresh defaults
  const applyTypeEnergy = (t: VehicleType, e: EnergyType) => {
    setType(t);
    setEnergy(e);
    if (!isEdit) {
      const d = defaultsFor(t, e);
      setStyle(d.defaultStyle);
      setFlags(d.drivingFlags);
      setInterests(d.stopInterests);
    }
  };

  const onPhotoChange = async (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImage(reader.result as string);
      setPhoto(compressed);
    };
    reader.readAsDataURL(file);
  };

  const toggleFlag = (k: string) => setFlags((f) => ({ ...f, [k]: !f[k] }));
  const toggleInt = (t: StopType) =>
    setInterests((s) => s.includes(t) ? s.filter((x) => x !== t) : [...s, t]);

  const save = () => {
    const trimmed = name.trim() || `${vehicleMeta(type).label} (uten navn)`;
    const trimmedNick = nickname.trim().slice(0, 40);
    const trimmedDesc = description.trim().slice(0, 240);
    const payload = {
      name: trimmed,
      nickname: trimmedNick || undefined,
      description: trimmedDesc || undefined,
      type, energy, photo,
      defaultStyle: style,
      drivingFlags: flags,
      stopInterests: interests,
    };
    let saved: Vehicle;
    if (vehicle) {
      vehiclesApi.update(vehicle.id, payload);
      saved = { ...vehicle, ...payload };
    } else {
      saved = vehiclesApi.add(payload);
    }
    onSaved?.(saved);
    onOpenChange(false);
  };

  const remove = () => {
    if (!vehicle) return;
    if (!confirm(`Slette «${vehicle.name}»?`)) return;
    vehiclesApi.remove(vehicle.id);
    onOpenChange(false);
  };

  const typeMeta = vehicleMeta(type);
  const em = energyMeta(energy);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl uppercase">
            {isEdit ? "Rediger kjøretøy" : "Nytt kjøretøy"}
          </DialogTitle>
          <DialogDescription>
            Hvert kjøretøy har sine egne preferanser som påvirker rutene Veiglede foreslår.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Photo */}
          <div className="flex items-center gap-4">
            <div className="h-24 w-24 rounded-2xl border border-border bg-surface-2 overflow-hidden grid place-items-center text-4xl shrink-0">
              {photo ? (
                <img src={photo} alt={name || "Kjøretøy"} className="h-full w-full object-cover" />
              ) : (
                <span>{typeMeta.emoji}</span>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onPhotoChange(e.target.files?.[0])}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wider hover:border-primary"
              >
                <Upload className="h-3.5 w-3.5" /> {photo ? "Bytt bilde" : "Last opp bilde"}
              </button>
              {photo && (
                <button
                  onClick={() => setPhoto(undefined)}
                  className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" /> Fjern
                </button>
              )}
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Camera className="h-3 w-3" /> Bildet lagres lokalt på enheten din.
              </p>
            </div>
          </div>

          {/* Name */}
          <Field label="Navn">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="F.eks. BMW R 1250 GS"
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </Field>

          {/* Type + Energy */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <div className="grid grid-cols-3 gap-1.5">
                {VEHICLES.map((v) => (
                  <button
                    key={v.value}
                    onClick={() => applyTypeEnergy(v.value as VehicleType, energy)}
                    className={`rounded-xl border p-2 text-center transition-colors ${type === v.value ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-border/80"}`}
                  >
                    <div className="text-xl">{v.emoji}</div>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wider">{v.label}</p>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Drivstoff *">
              <div className="grid grid-cols-3 gap-1.5">
                {ENERGIES.map((e) => (
                  <button
                    key={e.value}
                    onClick={() => applyTypeEnergy(type, e.value)}
                    className={`rounded-xl border px-2 py-2 text-left transition-colors ${energy === e.value ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-border/80"}`}
                  >
                    <span className="text-base">{e.emoji}</span>
                    <p className="text-[11px] mt-0.5 leading-tight">{e.label}</p>
                  </button>
                ))}
              </div>
            </Field>
          </div>


          {/* Default style */}
          <Field label="Standard rutestil">
            <div className="flex flex-wrap gap-1.5">
              {ROUTE_STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${style === s.value ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}
                >
                  <span>{s.emoji}</span> {s.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Driving flags */}
          <Field label="Kjørepreferanser">
            <div className="flex flex-wrap gap-1.5">
              {DRIVING_FLAGS.map((f) => {
                const on = !!flags[f.key];
                return (
                  <button
                    key={f.key}
                    onClick={() => toggleFlag(f.key)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>{f.emoji}</span> {f.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Stop interests */}
          <Field label="Stopp-interesser">
            <div className="flex flex-wrap gap-1.5">
              {STOP_INTERESTS.map((s) => {
                const on = interests.includes(s.value);
                const showCharging = energy === "electric" && s.value === "fuel";
                return (
                  <button
                    key={s.value}
                    onClick={() => toggleInt(s.value)}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs ${on ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>{showCharging ? "🔌" : s.emoji}</span>
                    {showCharging ? "Lading" : s.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Summary */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground/80">
            <span className="font-semibold text-primary">{typeMeta.emoji} {typeMeta.label}</span>
            <span className="mx-1">·</span>
            <span>{em.emoji} {em.label}</span>
            <span className="mx-1">·</span>
            <span>{ROUTE_STYLES.find((s) => s.value === style)?.label}</span>
            {interests.length > 0 && (
              <>
                <span className="mx-1">·</span>
                <span>{interests.map((t) => stopMeta(t).emoji).join(" ")}</span>
              </>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          {isEdit && (
            <button onClick={remove} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-muted-foreground hover:text-destructive hover:border-destructive">
              <Trash2 className="h-4 w-4" /> Slett
            </button>
          )}
          <button onClick={() => onOpenChange(false)} className="ml-auto rounded-xl border border-border bg-surface px-4 py-2.5 text-sm hover:border-primary">
            Avbryt
          </button>
          <button onClick={save} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-primary-foreground hover:brightness-110">
            {isEdit ? "Lagre" : "Legg til"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

async function compressImage(dataUrl: string, maxPx = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.src = dataUrl;
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">{label}</p>
      {children}
    </div>
  );
}
