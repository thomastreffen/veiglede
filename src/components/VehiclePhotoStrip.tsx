import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  listVehiclePhotos, uploadVehiclePhoto, deleteVehiclePhoto, updateVehiclePhotoCaption,
  type VehiclePhoto,
} from "@/lib/vehicle-photos";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  vehicleId: string;
  onShare?: () => void;
}

export function VehiclePhotoStrip({ vehicleId, onShare }: Props) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<VehiclePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<VehiclePhoto | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) { setPhotos([]); return; }
    let cancelled = false;
    setLoading(true);
    listVehiclePhotos(user.id, vehicleId)
      .then((rows) => { if (!cancelled) setPhotos(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, vehicleId]);

  if (!user) return null;

  const onPick = () => fileRef.current?.click();
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (photos.length >= 10) {
      toast.error("Maks 10 bilder per kjøretøy");
      return;
    }
    setUploading(true);
    const row = await uploadVehiclePhoto({ file, vehicleId, userId: user.id });
    setUploading(false);
    if (!row) {
      toast.error("Kunne ikke laste opp bildet");
      return;
    }
    setPhotos((cur) => [...cur, row]);
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bilder ({photos.length}/10)</p>
        {onShare && (
          <button
            onClick={onShare}
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-primary"
          >
            <Share2 className="h-3 w-3" /> Del kjøretøy
          </button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {photos.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p)}
            className="relative h-20 w-20 shrink-0 rounded-lg overflow-hidden border border-border bg-surface-2 group"
          >
            <img src={p.url} alt={p.caption ?? ""} className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
        {photos.length < 10 && (
          <button
            onClick={onPick}
            disabled={uploading}
            className="h-20 w-20 shrink-0 rounded-lg border-2 border-dashed border-border bg-surface-1/50 grid place-items-center text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
            aria-label="Legg til bilde"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </button>
        )}
        {loading && photos.length === 0 && (
          <div className="h-20 w-20 shrink-0 rounded-lg bg-surface-2 animate-pulse" />
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      <PhotoLightbox
        photo={selected}
        onClose={() => setSelected(null)}
        onUpdate={(p) => setPhotos((cur) => cur.map((x) => x.id === p.id ? p : x))}
        onDelete={(id) => {
          setPhotos((cur) => cur.filter((x) => x.id !== id));
          setSelected(null);
        }}
      />
    </div>
  );
}

function PhotoLightbox({
  photo, onClose, onUpdate, onDelete,
}: {
  photo: VehiclePhoto | null;
  onClose: () => void;
  onUpdate: (p: VehiclePhoto) => void;
  onDelete: (id: string) => void;
}) {
  const [caption, setCaption] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setCaption(photo?.caption ?? ""); }, [photo]);
  if (!photo) return null;
  const save = async () => {
    setSaving(true);
    await updateVehiclePhotoCaption(photo.id, caption);
    setSaving(false);
    onUpdate({ ...photo, caption: caption.trim() || null });
    toast.success("Bildetekst lagret");
  };
  const remove = async () => {
    if (!confirm("Slette dette bildet?")) return;
    await deleteVehiclePhoto(photo);
    onDelete(photo.id);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Bilde</DialogTitle>
          <DialogDescription>Legg til en bildetekst eller slett bildet.</DialogDescription>
        </DialogHeader>
        <img src={photo.url} alt={photo.caption ?? ""} className="w-full rounded-lg border border-border max-h-[60vh] object-contain bg-surface-2" />
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 200))}
          placeholder="Bildetekst (valgfri)"
          rows={2}
          className="mt-3 w-full rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <button
            onClick={remove}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:border-destructive"
          >
            <Trash2 className="h-4 w-4" /> Slett
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-surface-2">
              Lukk
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60"
            >
              {saving ? "Lagrer…" : "Lagre tekst"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
