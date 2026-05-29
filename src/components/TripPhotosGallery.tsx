import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { uploadTripPhoto } from "@/lib/trip-photo-upload";

interface PhotoRow {
  id: string;
  url: string;
  path: string | null;
  created_at: string;
}

export function TripPhotosGallery({ tripId }: { tripId: string }) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = async () => {
    const { data, error } = await supabase
      .from("trip_photos")
      .select("id,url,path,created_at")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Fetch photos error:", error.message);
      return;
    }
    console.log("Photos fetched:", data?.length);
    setPhotos(data ?? []);
  };

  useEffect(() => {
    if (!tripId) return;
    fetchPhotos();

    const channel = supabase
      .channel(`trip_photos:${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_photos", filter: `trip_id=eq.${tripId}` },
        () => fetchPhotos(),
      )
      .subscribe();

    const onRefresh = (e: Event) => {
      const detail = (e as CustomEvent).detail as { tripId?: string } | undefined;
      if (!detail?.tripId || detail.tripId === tripId) fetchPhotos();
    };
    window.addEventListener("trip-photos:refresh", onRefresh);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("trip-photos:refresh", onRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const handlePhotoUpload = async (file: File) => {
    if (!user) { toast.error("Logg inn for å laste opp bilder"); return; }
    try {
      const res = await uploadTripPhoto({ file, tripId, userId: user.id });
      if (!res) {
        toast.error("Kunne ikke laste opp bilde — prøv igjen");
        return;
      }
      await fetchPhotos();
    } catch (e) {
      console.error("Unexpected error:", e);
      toast.error("Kunne ikke laste opp bilde — prøv igjen");
    }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const f of files) {
        await handlePhotoUpload(f);
      }
      toast.success(files.length === 1 ? "Bilde lagt til" : `${files.length} bilder lagt til`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photo: PhotoRow) => {
    setDeletingId(photo.id);
    const prev = photos;
    setPhotos((cur) => cur.filter((p) => p.id !== photo.id));
    setConfirmId(null);
    try {
      if (photo.path) {
        const { error: sErr } = await supabase.storage.from("trip-photos").remove([photo.path]);
        if (sErr) console.warn("Storage remove error:", sErr.message);
      }
      const { error: dErr } = await supabase.from("trip_photos").delete().eq("id", photo.id);
      if (dErr) {
        console.error("DB delete error:", dErr.message);
        setPhotos(prev);
        toast.error("Kunne ikke slette bildet");
        return;
      }
      console.log("Photo deleted:", photo.id);
    } catch (e) {
      console.error("Delete error:", e);
      setPhotos(prev);
      toast.error("Kunne ikke slette bildet");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="mt-4">
        <label
          htmlFor="trip-photo-upload"
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-surface-2/40 transition-colors p-6 md:p-8 text-center cursor-pointer text-sm text-muted-foreground"
        >
          <span className="text-2xl">📷</span>
          <span>{uploading ? "Laster opp…" : "Klikk for å laste opp bilder fra turen"}</span>
          <span className="text-[11px] text-muted-foreground/70">JPG/PNG · flere bilder om gangen</span>
        </label>
        <input
          ref={inputRef}
          id="trip-photo-upload"
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={onPick}
          disabled={uploading}
        />
      </div>

      {photos.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground italic text-center">
          Ingen bilder ennå — legg til ditt første.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative group aspect-square rounded-xl overflow-hidden border border-border hover:border-primary"
            >
              <button
                type="button"
                onClick={() => setLightbox(p.url)}
                className="block h-full w-full"
              >
                <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>

              {confirmId !== p.id && (
                <button
                  type="button"
                  aria-label="Slett bilde"
                  onClick={(e) => { e.stopPropagation(); setConfirmId(p.id); }}
                  style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 16, lineHeight: 1, display: "grid", placeItems: "center" }}
                >
                  ×
                </button>
              )}

              {confirmId === p.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 bg-black/70 backdrop-blur-sm grid place-items-center p-2"
                >
                  <div className="text-center">
                    <p className="text-white text-sm font-medium mb-2">Slett?</p>
                    <div className="flex gap-2 justify-center">
                      <button
                        type="button"
                        disabled={deletingId === p.id}
                        onClick={() => handleDelete(p)}
                        className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-50"
                      >
                        Ja
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 text-white text-xs font-medium"
                      >
                        Nei
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}


      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur grid place-items-center p-4 cursor-zoom-out"
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-2xl shadow-2xl" />
        </div>
      )}
    </>
  );
}
