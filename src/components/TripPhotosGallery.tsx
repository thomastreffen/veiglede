import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

interface PhotoRow {
  id: string;
  url: string;
  created_at: string;
}

export function TripPhotosGallery({ tripId }: { tripId: string }) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = async () => {
    const { data, error } = await supabase
      .from("trip_photos")
      .select("id,url,created_at")
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

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const handlePhotoUpload = async (file: File) => {
    console.log("1. Starting upload", file.name, file.size);
    if (!user) { toast.error("Logg inn for å laste opp bilder"); return; }

    try {
      // Storage RLS requires first folder = auth.uid(); keep that prefix.
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${tripId}/${Date.now()}_${safeName}`;
      console.log("2. Uploading to path:", path);

      const { data, error } = await supabase.storage
        .from("trip-photos")
        .upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });

      if (error) {
        console.error("3. Storage error:", error.message);
        toast.error("Kunne ikke laste opp bilde — prøv igjen");
        return;
      }

      console.log("4. Upload success:", data.path);

      const { data: urlData } = supabase.storage
        .from("trip-photos")
        .getPublicUrl(data.path);

      console.log("5. Public URL:", urlData.publicUrl);

      const { error: dbError } = await supabase
        .from("trip_photos")
        .insert({ trip_id: tripId, user_id: user.id, url: urlData.publicUrl, path: data.path });

      if (dbError) {
        console.error("6. DB error:", dbError.message);
        toast.error("Kunne ikke laste opp bilde — prøv igjen");
        return;
      }

      console.log("7. Saved to DB - refreshing photos");
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
            <button
              key={p.id}
              type="button"
              onClick={() => setLightbox(p.url)}
              className="aspect-square rounded-xl overflow-hidden border border-border hover:border-primary"
            >
              <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
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
