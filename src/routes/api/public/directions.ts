// Public routing endpoint.
//
// Primary: Google Routes API (computeRoutes) via Lovable connector gateway.
// Honors routeStyle, vehicleType and avoidHighways/avoidFerries flags.
// Falls back to Mapbox Directions if Google fails, then to a demo straight
// line if neither provider is available.

import { createFileRoute } from "@tanstack/react-router";

const GOOGLE_GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
} as const;

interface LatLng { lat: number; lng: number }
interface Body {
  origin?: LatLng;
  destination?: LatLng;
  waypoints?: LatLng[];
  vehicleType?: string;
  routeStyle?: string;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  /** When true, return up to 3 alternative routes in `routes: [...]`. */
  alternatives?: boolean;
}


function isFiniteNum(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n !== 0;
}

function isLatLng(v: unknown): v is LatLng {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (!isFiniteNum(o.lat) || !isFiniteNum(o.lng)) return false;
  return (
    (o.lat as number) >= -90 && (o.lat as number) <= 90 &&
    (o.lng as number) >= -180 && (o.lng as number) <= 180
  );
}

function distKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function interpolate(a: LatLng, b: LatLng, steps = 32): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  return pts;
}

// Decode a Google encoded polyline string into [lat,lng] points.
function decodePolyline(str: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dLat;
    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dLng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// Map our routeStyle to Google routing preferences + modifiers.
function googleRoutingPrefs(body: Body): {
  routingPreference: "TRAFFIC_AWARE" | "TRAFFIC_AWARE_OPTIMAL" | "FUEL_EFFICIENT" | "TRAFFIC_UNAWARE";
  avoidHighways: boolean;
  avoidFerries: boolean;
} {
  const style = body.routeStyle ?? "fastest";
  let routingPreference: "TRAFFIC_AWARE" | "FUEL_EFFICIENT" = "TRAFFIC_AWARE";
  let avoidHighways = !!body.avoidHighways;
  const avoidFerries = !!body.avoidFerries;

  if (body.vehicleType === "rv" || style === "cruise") {
    routingPreference = "FUEL_EFFICIENT";
  }
  if (style === "scenic" || style === "curvy" || style === "photo" || style === "tourist") {
    avoidHighways = true; // honest: prefer non-motorway corridors
  }
  return { routingPreference, avoidHighways, avoidFerries };
}

function demoResponse(body: Body, warnings: string[]) {
  const km = Math.round(distKm(body.origin!, body.destination!) * 1.25);
  const speed = body.routeStyle === "fastest" ? 75 : 60;
  const isRv = body.vehicleType === "rv";
  return {
    distanceKm: km,
    durationMin: Math.round((km / speed) * 60 * (isRv ? 1 / 0.85 : 1)),
    geometry: interpolate(body.origin!, body.destination!, 32),
    provider: "demo" as const,
    profile: "driving",
    avoidOptions: { highways: !!body.avoidHighways, ferries: !!body.avoidFerries },
    warnings: warnings.length ? warnings : undefined,
  };
}

async function tryGoogle(body: Body, warnings: string[]): Promise<Response | null> {
  const lovableKey = (process.env.LOVABLE_API_KEY ?? "").trim();
  const mapsKey = (
    process.env.GOOGLE_MAPS_API_KEY_2 ??
    process.env.GOOGLE_MAPS_API_KEY_1 ??
    process.env.GOOGLE_MAPS_API_KEY ??
    ""
  ).trim();
  if (!lovableKey || !mapsKey) {
    warnings.push("no-google-key");
    return null;
  }

  const prefs = googleRoutingPrefs(body);
  const intermediates = (body.waypoints ?? [])
    .filter(isLatLng)
    .map((w) => ({ location: { latLng: { latitude: w.lat, longitude: w.lng } } }));

  const reqBody = {
    origin: { location: { latLng: { latitude: body.origin!.lat, longitude: body.origin!.lng } } },
    destination: { location: { latLng: { latitude: body.destination!.lat, longitude: body.destination!.lng } } },
    intermediates,
    travelMode: "DRIVE",
    routingPreference: prefs.routingPreference,
    routeModifiers: {
      avoidHighways: prefs.avoidHighways,
      avoidFerries: prefs.avoidFerries,
    },
    // Only meaningful when there are no intermediates (Google ignores it otherwise).
    computeAlternativeRoutes: !!body.alternatives && intermediates.length === 0,
    polylineQuality: "OVERVIEW",
    languageCode: "no",
    regionCode: "NO",
  };


  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(`${GOOGLE_GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": mapsKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask": [
          "routes.duration",
          "routes.distanceMeters",
          "routes.polyline.encodedPolyline",
          "routes.routeLabels",
          "routes.description",
          "routes.legs.steps.travelMode",
          "routes.legs.steps.staticDuration",
          "routes.legs.steps.distanceMeters",
          "routes.legs.steps.navigationInstruction",
          "routes.legs.steps.startLocation.latLng",
          "routes.legs.steps.endLocation.latLng",
        ].join(","),

      },
      body: JSON.stringify(reqBody),
    });
    clearTimeout(t);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[directions] Google routes non-200", { status: res.status, body: text.slice(0, 300) });
      warnings.push(`google-http-${res.status}`);
      return null;
    }
    const data = await res.json();
    const routesRaw: unknown[] = Array.isArray(data?.routes) ? data.routes : [];
    if (routesRaw.length === 0) {
      warnings.push("google-no-routes");
      return null;
    }

    type FerrySegment = {
      fromLabel?: string;
      toLabel?: string;
      durationMin: number;
      distanceKm: number;
      start?: { lat: number; lng: number };
      end?: { lat: number; lng: number };
    };
    interface StepShape {
      travelMode?: string;
      staticDuration?: string;
      distanceMeters?: number;
      navigationInstruction?: { instructions?: string };
      startLocation?: { latLng?: { latitude?: number; longitude?: number } };
      endLocation?: { latLng?: { latitude?: number; longitude?: number } };
    }
    const FERRY_KEYWORDS = [
      "ferje", "ferga", "ferje-", "fergeleie", "fergekai", "ferry", "car ferry",
      "fjord1", "norled", "boreal", "torghatten", "bastø fosen", "color line", "fjordline",
    ];
    const isFerryStep = (step: StepShape): boolean => {
      if (step?.travelMode === "FERRY") return true;
      const text = (step?.navigationInstruction?.instructions ?? "").toLowerCase();
      if (text && FERRY_KEYWORDS.some((k) => text.includes(k))) return true;
      const sd = typeof step.staticDuration === "string" ? Number(step.staticDuration.replace(/s$/, "")) : 0;
      const dm = typeof step.distanceMeters === "number" ? step.distanceMeters : 0;
      if (dm > 0 && dm < 5000 && sd > 15 * 60) return true;
      return false;
    };

    const isRv = body.vehicleType === "rv";
    const parseRoute = (route: Record<string, unknown> & {
      polyline?: { encodedPolyline?: string };
      distanceMeters?: number;
      duration?: string;
      routeLabels?: string[];
      description?: string;
      legs?: Array<{ steps?: StepShape[] }>;
    }) => {
      const encoded = route?.polyline?.encodedPolyline ?? "";
      if (!encoded) return null;
      const geom = decodePolyline(encoded);
      if (geom.length < 2) return null;
      const rawDistanceMeters = typeof route.distanceMeters === "number" ? route.distanceMeters : 0;
      const durRaw: string = typeof route.duration === "string" ? route.duration : "0s";
      const rawDurationSeconds = Number(durRaw.replace(/s$/, "")) || 0;
      const baseMinutes = rawDurationSeconds ? rawDurationSeconds / 60 : 0;
      const durationMin = Math.round(baseMinutes * (isRv ? 1 / 0.85 : 1));

      const ferrySegments: FerrySegment[] = [];
      let ferryDistanceMeters = 0;
      let ferryDurationSec = 0;
      const legs: Array<{ steps?: StepShape[] }> = Array.isArray(route?.legs) ? route.legs : [];
      for (const leg of legs) {
        const steps: StepShape[] = Array.isArray(leg?.steps) ? leg.steps! : [];
        for (const step of steps) {
          if (!isFerryStep(step)) continue;
          const sd = typeof step.staticDuration === "string" ? Number(step.staticDuration.replace(/s$/, "")) : 0;
          const dm = typeof step.distanceMeters === "number" ? step.distanceMeters : 0;
          ferryDistanceMeters += dm;
          ferryDurationSec += sd || 0;
          const text: string = step?.navigationInstruction?.instructions ?? "";
          let from: string | undefined;
          let to: string | undefined;
          const m1 = text.match(/(?:from|fra)\s+(.+?)\s+(?:to|til)\s+(.+?)(?:\.|$)/i);
          const m2 = text.match(/([A-Za-zÆØÅæøå]+)[-–]([A-Za-zÆØÅæøå]+)[-\s]?(?:ferga|ferja|ferry|ferje)/i);
          const m3 = text.match(/([A-Za-zÆØÅæøå]+)\s*→\s*([A-Za-zÆØÅæøå]+)/);
          if (m1) { from = m1[1]?.trim(); to = m1[2]?.trim(); }
          else if (m2) { from = m2[1]?.trim(); to = m2[2]?.trim(); }
          else if (m3) { from = m3[1]?.trim(); to = m3[2]?.trim(); }
          const startLL = step?.startLocation?.latLng;
          const endLL = step?.endLocation?.latLng;
          ferrySegments.push({
            fromLabel: from,
            toLabel: to,
            durationMin: Math.max(5, Math.round((sd || 0) / 60)),
            distanceKm: dm ? Math.round(dm / 100) / 10 : 0,
            start: startLL ? { lat: Number(startLL.latitude), lng: Number(startLL.longitude) } : undefined,
            end: endLL ? { lat: Number(endLL.latitude), lng: Number(endLL.longitude) } : undefined,
          });
        }
      }

      return {
        distanceKm: rawDistanceMeters ? Math.round(rawDistanceMeters / 100) / 10 : 0,
        durationMin,
        geometry: geom,
        provider: "google" as const,
        profile: prefs.routingPreference,
        avoidOptions: { highways: prefs.avoidHighways, ferries: prefs.avoidFerries },
        rawDistanceMeters,
        rawDurationSeconds,
        ferryDistanceKm: ferryDistanceMeters ? Math.round(ferryDistanceMeters / 100) / 10 : undefined,
        ferryDurationMin: ferryDurationSec ? Math.round(ferryDurationSec / 60) : undefined,
        ferrySegments: ferrySegments.length ? ferrySegments : undefined,
        routeLabels: Array.isArray(route.routeLabels) ? route.routeLabels : undefined,
        description: typeof route.description === "string" ? route.description : undefined,
      };
    };

    const parsed = routesRaw
      .map((r) => parseRoute(r as Parameters<typeof parseRoute>[0]))
      .filter((r): r is NonNullable<ReturnType<typeof parseRoute>> => r !== null);

    if (parsed.length === 0) {
      warnings.push("google-no-geometry");
      return null;
    }

    if (body.alternatives) {
      return json({
        routes: parsed,
        provider: "google" as const,
        warnings: warnings.length ? warnings : undefined,
      });
    }

    return json({ ...parsed[0], warnings: warnings.length ? warnings : undefined });

  } catch (err) {
    warnings.push(`google-error-${(err as Error)?.name ?? "unknown"}`);
    return null;
  }
}


async function tryMapbox(body: Body, warnings: string[]): Promise<Response | null> {
  const token = (process.env.MAPBOX_TOKEN ?? "").trim();
  if (!token) {
    warnings.push("no-mapbox-token");
    return null;
  }
  try {
    const originPair: [number, number] = [body.origin!.lng, body.origin!.lat];
    const destPair: [number, number] = [body.destination!.lng, body.destination!.lat];
    const rawVia = Array.isArray(body.waypoints) ? body.waypoints : [];
    const viaCoords: [number, number][] = [];
    rawVia.forEach((w, i) => {
      if (!isLatLng(w)) { warnings.push(`mapbox-skip-waypoint-${i}`); return; }
      viaCoords.push([w.lng, w.lat]);
    });
    const coordinates: [number, number][] = [originPair, ...viaCoords, destPair];
    const coordStr = coordinates.map((c) => `${c[0]},${c[1]}`).join(";");
    const excludes: string[] = [];
    if (body.avoidHighways) excludes.push("motorway");
    if (body.avoidFerries) excludes.push("ferry");
    const excludeParam = excludes.length ? `&exclude=${excludes.join(",")}` : "";
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordStr}?geometries=geojson&overview=full${excludeParam}&access_token=${encodeURIComponent(token)}`;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) {
      warnings.push(`mapbox-http-${res.status}`);
      return null;
    }
    const data = await res.json();
    const route = data?.routes?.[0];
    const coords: [number, number][] = route?.geometry?.coordinates ?? [];
    if (!coords.length) {
      warnings.push("mapbox-no-geometry");
      return null;
    }
    const rawDistanceMeters = typeof route.distance === "number" ? route.distance : 0;
    const rawDurationSeconds = typeof route.duration === "number" ? route.duration : 0;
    const isRv = body.vehicleType === "rv";
    const baseMinutes = rawDurationSeconds ? rawDurationSeconds / 60 : 0;
    const durationMin = Math.round(baseMinutes * (isRv ? 1 / 0.85 : 1));

    return json({
      distanceKm: rawDistanceMeters ? Math.round(rawDistanceMeters / 100) / 10 : 0,
      durationMin,
      geometry: coords.map(([lng, lat]) => ({ lat, lng })),
      provider: "mapbox" as const,
      profile: "driving",
      avoidOptions: { highways: !!body.avoidHighways, ferries: !!body.avoidFerries },
      rawDistanceMeters,
      rawDurationSeconds,
      warnings: warnings.length ? warnings : undefined,
    });
  } catch (err) {
    warnings.push(`mapbox-error-${(err as Error)?.name ?? "unknown"}`);
    return null;
  }
}

export const Route = createFileRoute("/api/public/directions")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => {
        let body: Body;
        try { body = (await request.json()) as Body; }
        catch { return json({ error: "invalid-json" }, 400); }

        if (!isLatLng(body.origin) || !isLatLng(body.destination)) {
          return json({ error: "invalid-coordinates" }, 400);
        }

        const warnings: string[] = [];

        const google = await tryGoogle(body, warnings);
        if (google) return google;

        const mapbox = await tryMapbox(body, warnings);
        if (mapbox) return mapbox;

        return json(demoResponse(body, warnings));
      },
    },
  },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}
