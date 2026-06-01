import { supabase } from "@/integrations/supabase/client";

export interface VehiclePhoto {
  id: string;
  vehicle_id: string;
  url: string;
  storage_path: string;
  caption: string | null;
  created_at: string;
}

/** Compress an image File to a JPEG Blob, max 1200×1200, quality 80%. */
export async function compressImageToBlob(file: File, maxPx = 1200, quality = 0.8): Promise<Blob> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("compress-failed"))),
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = dataUrl;
  });
}

export async function uploadVehiclePhoto(params: {
  file: File;
  vehicleId: string;
  userId: string;
}): Promise<VehiclePhoto | null> {
  const { file, vehicleId, userId } = params;
  const blob = await compressImageToBlob(file).catch(() => null);
  if (!blob) return null;
  const safeId = vehicleId.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${safeId}/${Date.now()}.jpg`;
  const { data: up, error: upErr } = await supabase.storage
    .from("vehicle-photos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (upErr || !up) {
    console.error("vehicle-photo upload:", upErr?.message);
    return null;
  }
  const { data: pub } = supabase.storage.from("vehicle-photos").getPublicUrl(up.path);
  const { data: row, error: dbErr } = await supabase
    .from("vehicle_photos")
    .insert({
      vehicle_id: vehicleId,
      user_id: userId,
      storage_path: up.path,
      url: pub.publicUrl,
    })
    .select("id, vehicle_id, url, storage_path, caption, created_at")
    .single();
  if (dbErr || !row) {
    console.error("vehicle-photo db:", dbErr?.message);
    return null;
  }
  return row as VehiclePhoto;
}

export async function listVehiclePhotos(userId: string, vehicleId: string): Promise<VehiclePhoto[]> {
  const { data, error } = await supabase
    .from("vehicle_photos")
    .select("id, vehicle_id, url, storage_path, caption, created_at")
    .eq("user_id", userId)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("vehicle-photo list:", error.message);
    return [];
  }
  return (data ?? []) as VehiclePhoto[];
}

export async function updateVehiclePhotoCaption(id: string, caption: string): Promise<void> {
  const trimmed = caption.trim().slice(0, 200);
  await supabase
    .from("vehicle_photos")
    .update({ caption: trimmed || null })
    .eq("id", id);
}

export async function deleteVehiclePhoto(photo: VehiclePhoto): Promise<void> {
  await supabase.storage.from("vehicle-photos").remove([photo.storage_path]);
  await supabase.from("vehicle_photos").delete().eq("id", photo.id);
}
