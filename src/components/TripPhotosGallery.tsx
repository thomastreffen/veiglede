import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PhotoRow {
  id: string;
  url: string;
  created_at: string;
}

export function TripPhotosGallery({ tripId }: { tripId: string }) {
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("trip_photos")
        .select("id,url,created_at")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true });
      if (!active) return;
      if (error) {
        console.error("error: ", error.message);
        return;
      }
      setPhotos(data ?? []);
    };
    load();

    const channel = supabase
      .channel(`trip_photos:${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_photos", filter: `trip_id=eq.${tripId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [tripId]);

  if (photos.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Legg til fotostopp så dukker bildene opp her.
      </div>
    );
  }

  return (
    <>
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
