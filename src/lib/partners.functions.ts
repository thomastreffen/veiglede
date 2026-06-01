import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Haversine distance in km between two lat/lng points. */
function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type PartnerLite = {
  id: string;
  name: string;
  category: string;
  region: string | null;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  lat: number;
  lng: number;
};

const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Fetch active partners with coords within `radiusKm` of a single point. */
export const fetchNearbyPartnersFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusKm: z.number().min(1).max(2000).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("partners")
      .select("id,name,category,region,description,logo_url,website,lat,lng")
      .eq("is_active", true)
      .not("lat", "is", null)
      .not("lng", "is", null);
    if (error) throw new Error(error.message);
    const partners = (rows ?? [])
      .filter((p): p is PartnerLite => p.lat != null && p.lng != null)
      .map((p) => ({
        ...p,
        distanceKm: haversineKm({ lat: data.lat, lng: data.lng }, { lat: p.lat, lng: p.lng }),
      }))
      .filter((p) => p.distanceKm <= data.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return { partners };
  });

/**
 * Fetch active partners within 50 km of the route, measured against origin,
 * destination, and any provided waypoints. Returns the closest match per
 * partner with the minimum distance to any of those anchors.
 */
export const fetchRoutePartnersFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        origin: pointSchema,
        destination: pointSchema,
        waypoints: z.array(pointSchema).max(20).optional(),
        radiusKm: z.number().min(1).max(500).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("partners")
      .select("id,name,category,region,description,logo_url,website,lat,lng")
      .eq("is_active", true)
      .not("lat", "is", null)
      .not("lng", "is", null);
    if (error) throw new Error(error.message);
    const anchors = [data.origin, data.destination, ...(data.waypoints ?? [])];
    const partners = (rows ?? [])
      .filter((p): p is PartnerLite => p.lat != null && p.lng != null)
      .map((p) => {
        const minKm = Math.min(
          ...anchors.map((a) => haversineKm(a, { lat: p.lat, lng: p.lng })),
        );
        return { ...p, distanceKm: minKm };
      })
      .filter((p) => p.distanceKm <= data.radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return { partners };
  });

/** Atomically increment impressions counter for a partner. */
export const incrementPartnerImpressionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ partnerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("increment_partner_impression", {
      p_partner_id: data.partnerId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Atomically increment clicks counter for a partner. */
export const incrementPartnerClickFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ partnerId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("increment_partner_click", {
      p_partner_id: data.partnerId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
