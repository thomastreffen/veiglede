/**
 * Curated trips — Veiglede-authored seed content.
 *
 * Stable ids (`curated:<slug>`) let existing `trip_reactions` and
 * `saved_trips` rows target a curated trip without a schema change.
 *
 * Each curated trip carries:
 * - `originLoc` / `destinationLoc` lat/lng — used for map preview.
 * - `macroRegions` — Norwegian macro-region tags so an Østlandet-based
 *   user actually sees Buskerud/Telemark/Innlandet routes (not Lofoten).
 * - `estimatedDurationMin` — used to populate a real drive time on copy
 *   so copied trips never show "0 min".
 * - Stops carry optional lat/lng for the schematic map preview.
 */

import type { CoverKey, RouteStyle, VehicleType } from "@/lib/trips-store";
import routeLofoten from "@/assets/route-lofoten.jpg";
import routeAtlanterhavsveien from "@/assets/route-atlanterhavsveien.jpg";
import routeHardanger from "@/assets/route-hardanger.jpg";
import routeSognefjellet from "@/assets/route-sognefjellet.jpg";
import heroFjord from "@/assets/hero-fjord.jpg";

export type Country = "no" | "se" | "dk" | "de";

export type MacroRegion =
  | "ostlandet"
  | "sorlandet"
  | "vestlandet"
  | "more-romsdal"
  | "trondelag"
  | "nord-norge"
  | "innlandet";

export const MACRO_REGION_LABEL: Record<MacroRegion, string> = {
  ostlandet: "Østlandet",
  sorlandet: "Sørlandet",
  vestlandet: "Vestlandet",
  "more-romsdal": "Møre og Romsdal",
  trondelag: "Trøndelag",
  "nord-norge": "Nord-Norge",
  innlandet: "Innlandet",
};

export interface CuratedStop {
  name: string;
  location?: string;
  type: "viewpoint" | "photo" | "food" | "lodging" | "fuel" | "attraction" | "rest" | "city" | "experience" | "detour" | "ferry";
  description?: string;
  estimatedTime?: string;
  lat?: number;
  lng?: number;
}

export interface CuratedDay {
  title: string;
  summary?: string;
  stops: CuratedStop[];
}

export interface CuratedTrip {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  country: Country;
  macroRegions: MacroRegion[];
  vehicleSuitability: VehicleType[];
  style: RouteStyle;
  distanceKm: number;
  /** Human-readable drive time like "5–7 t kjøring + stopp". */
  drivingTime: string;
  /** Machine-friendly estimated drive time used when copying to a real trip. */
  estimatedDurationMin: number;
  stopsCount: number;
  cover: CoverKey;
  coverImage: string;
  shortDescription: string;
  whyDrive: string;
  origin: string;
  destination: string;
  originLoc: { lat: number; lng: number };
  destinationLoc: { lat: number; lng: number };
  days: CuratedDay[];
  tags: string[];
}

const t = (slug: string): string => `curated:${slug}`;

export const CURATED_TRIPS: CuratedTrip[] = [
  {
    id: t("lofoten-rundt"),
    slug: "lofoten-rundt",
    title: "Lofoten rundt",
    subtitle: "Hav, fjell og fiskevær på arktisk asfalt",
    region: "Nordland",
    country: "no",
    macroRegions: ["nord-norge"],
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "scenic",
    distanceKm: 230,
    drivingTime: "5–7 t kjøring + stopp",
    estimatedDurationMin: 360,
    stopsCount: 7,
    cover: "lofoten",
    coverImage: routeLofoten,
    shortDescription: "Fra Svolvær til Å — alpetinder rett opp av havet og rorbuer på rad og rekke.",
    whyDrive:
      "Få strekninger i Norge gir like mye for hver kilometer som E10 gjennom Lofoten. Du kjører forbi tinder som stiger rett opp av havet, krysser broer mellom øyer og kommer til fiskevær som ser ut som postkort. Best i mai–september når veiene er åpne og det er lyst sent.",
    origin: "Svolvær",
    destination: "Å i Lofoten",
    originLoc: { lat: 68.234, lng: 14.5688 },
    destinationLoc: { lat: 67.879, lng: 12.985 },
    tags: ["Kystvei", "Fototur", "Nasjonale turistveier", "Bro-arkitektur"],
    days: [
      {
        title: "Svolvær → Henningsvær → Nusfjord",
        summary: "Start mykt med fiskevær og en av Norges fineste sidegater (Henningsvær-broene).",
        stops: [
          { name: "Svolvær", location: "Svolvær, Vågan", type: "city", description: "Klassisk start på Lofoten — havn, kafé og Svolværgeita over byen.", lat: 68.234, lng: 14.5688 },
          { name: "Henningsvær", location: "Henningsvær", type: "viewpoint", description: "Sving av E10 og kjør broene ut til galleribyen.", estimatedTime: "1–2 t", lat: 68.157, lng: 14.205 },
          { name: "Nusfjord", location: "Nusfjord, Flakstad", type: "attraction", description: "Et av Norges best bevarte fiskevær. Liten omvei, stor opplevelse.", lat: 68.027, lng: 13.367 },
        ],
      },
      {
        title: "Nusfjord → Ramberg → Reine → Å",
        summary: "Den fotogene halvdelen: hvit sand, Reinefjorden og Å som veis ende.",
        stops: [
          { name: "Rambergstranda", location: "Flakstad", type: "photo", description: "Hvit sandstrand med utsikt mot Hustinden.", lat: 68.094, lng: 13.234 },
          { name: "Reinebringen utsiktspunkt", location: "Reine", type: "viewpoint", description: "Kjør forbi om du ikke skal gå opp — utsikten fra parkering er også bra.", lat: 67.932, lng: 13.092 },
          { name: "Å i Lofoten", location: "Å, Moskenes", type: "city", description: "Veis ende. Tørrfiskmuseum og rorbuer fra 1800-tallet.", lat: 67.879, lng: 12.985 },
          { name: "Anker for natten", location: "Reine eller Sakrisøy", type: "lodging", description: "Rorbu rett over fjorden.", lat: 67.932, lng: 13.092 },
        ],
      },
    ],
  },
  {
    id: t("atlanterhavsveien"),
    slug: "atlanterhavsveien",
    title: "Atlanterhavsveien",
    subtitle: "Norges mest fotograferte 8 kilometer",
    region: "Møre og Romsdal",
    country: "no",
    macroRegions: ["more-romsdal"],
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "tourist",
    distanceKm: 160,
    drivingTime: "3–4 t med stopp",
    estimatedDurationMin: 210,
    stopsCount: 5,
    cover: "coast",
    coverImage: routeAtlanterhavsveien,
    shortDescription: "Kristiansund → Molde via Storseisundet — broer som ser ut som de kaster bilen ut i havet.",
    whyDrive:
      "Selve Atlanterhavsveien er bare 8,3 km, men dette er strekningen som har vært på alle Top Gear-lister av en grunn. Best i kuling — bølgene slår over rekkverket og Storseisundet får sin signaturoptiske illusjon. Kombiner med Eldhusøya og Bud fiskevær for en hel dag.",
    origin: "Kristiansund",
    destination: "Molde",
    originLoc: { lat: 63.111, lng: 7.728 },
    destinationLoc: { lat: 62.737, lng: 7.156 },
    tags: ["Nasjonale turistveier", "Kystvei", "Bro-arkitektur", "Fototur"],
    days: [
      {
        title: "Kristiansund → Atlanterhavsveien → Bud → Molde",
        summary: "Hele klassikeren i én dag — kort på papiret, men du vil stoppe ofte.",
        stops: [
          { name: "Kristiansund sentrum", location: "Kristiansund", type: "city", description: "Klippfiskbyen — ta en kaffe på Smia før du kjører.", lat: 63.111, lng: 7.728 },
          { name: "Storseisundbrua", location: "Averøy", type: "viewpoint", description: "Selve bildet. Stopp ved Eldhusøya like før eller etter.", estimatedTime: "30–45 min", lat: 63.020, lng: 7.350 },
          { name: "Eldhusøya utsiktsplattform", location: "Averøy", type: "photo", description: "Arkitektonisk rasteplass med kafé.", lat: 63.011, lng: 7.378 },
          { name: "Bud fiskevær", location: "Bud", type: "attraction", description: "Lite fiskevær med havkant og krigsminne (Ergan kystfort).", lat: 62.907, lng: 6.911 },
          { name: "Molde panorama", location: "Molde", type: "viewpoint", description: "Avslutt med utsikt over Romsdalsalpene fra Varden.", lat: 62.737, lng: 7.156 },
        ],
      },
    ],
  },
  {
    id: t("hardanger-rundt"),
    slug: "hardanger-rundt",
    title: "Hardanger rundt",
    subtitle: "Fossefall, fruktblomstring og fjordveier",
    region: "Vestland",
    country: "no",
    macroRegions: ["vestlandet"],
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "scenic",
    distanceKm: 600,
    drivingTime: "2–3 dager",
    estimatedDurationMin: 720,
    stopsCount: 8,
    cover: "fjord",
    coverImage: routeHardanger,
    shortDescription: "Rundtur fra Bergen via Norheimsund, Eidfjord, Vøringsfossen og tilbake over Kvamskogen.",
    whyDrive:
      "Hardanger er Vestlandet i ett konsentrert område: dramatiske fjorder, brattlent frukthager (best i mai), Vøringsfossen som braser 182 meter rett ned og noen av landets fineste fjordveier. Egner seg som en avslappet helgetur med én eller to overnattinger.",
    origin: "Bergen",
    destination: "Bergen (rundtur)",
    originLoc: { lat: 60.392, lng: 5.324 },
    destinationLoc: { lat: 60.392, lng: 5.324 },
    tags: ["Fjord", "Nasjonale turistveier", "Foss", "Rolig cruise"],
    days: [
      {
        title: "Bergen → Norheimsund → Utne",
        stops: [
          { name: "Steinsdalsfossen", location: "Norheimsund", type: "viewpoint", description: "Gå bak fossen — bokstavelig talt.", lat: 60.376, lng: 6.140 },
          { name: "Utne ferge", location: "Utne", type: "ferry", description: "Kort ferge over Hardangerfjorden — pakk kaffe.", lat: 60.420, lng: 6.640 },
          { name: "Utne hotell", location: "Utne", type: "lodging", description: "Norges eldste hotell i drift (1722).", lat: 60.420, lng: 6.640 },
        ],
      },
      {
        title: "Utne → Eidfjord → Vøringsfossen",
        stops: [
          { name: "Eidfjord", location: "Eidfjord", type: "city", description: "Stopp for lunsj med utsikt.", lat: 60.467, lng: 7.075 },
          { name: "Vøringsfossen", location: "Måbødalen", type: "viewpoint", description: "Den nye trappa og gangbroa er obligatorisk.", lat: 60.428, lng: 7.255 },
          { name: "Hardangervidda Natursenter", location: "Eidfjord", type: "attraction", description: "Bra for regnvær.", lat: 60.467, lng: 7.075 },
        ],
      },
      {
        title: "Eidfjord → Kvamskogen → Bergen",
        stops: [
          { name: "Skjeggedal", location: "Tyssedal", type: "detour", description: "Hvis du har gått Trolltunga, kjenner du parkeringa.", lat: 60.117, lng: 6.566 },
          { name: "Kvamskogen", location: "Kvam", type: "viewpoint", description: "Fin avslutning over fjellet før du faller ned mot Bergen.", lat: 60.380, lng: 5.965 },
        ],
      },
    ],
  },
  {
    id: t("sognefjellet"),
    slug: "sognefjellet",
    title: "Sognefjellet",
    subtitle: "Nord-Europas høyeste fjellovergang",
    region: "Innlandet / Vestland",
    country: "no",
    macroRegions: ["innlandet", "vestlandet"],
    vehicleSuitability: ["motorcycle", "car"],
    style: "curvy",
    distanceKm: 108,
    drivingTime: "2,5–3 t",
    estimatedDurationMin: 165,
    stopsCount: 5,
    cover: "mountain",
    coverImage: routeSognefjellet,
    shortDescription: "Lom → Skjolden over Sognefjellet — 1434 moh og snø langs veien til midten av juli.",
    whyDrive:
      "Sognefjellsvegen er en MC-klassiker. Asfalt i god stand, lange svinger med god sikt og et høydedrama som tar pusten fra deg. Best i juni–august; ofte stengt resten av året. Kombiner med Jotunheimen og Lustrafjorden for en perfekt helg.",
    origin: "Lom",
    destination: "Skjolden",
    originLoc: { lat: 61.838, lng: 8.566 },
    destinationLoc: { lat: 61.502, lng: 7.594 },
    tags: ["Svingete vei", "Fjellovergang", "MC-favoritt", "Nasjonale turistveier"],
    days: [
      {
        title: "Lom → Sognefjellshytta → Turtagrø → Skjolden",
        stops: [
          { name: "Lom stavkirke", location: "Lom", type: "attraction", description: "Klassisk start. Bakeriet i sentrum er en institusjon.", lat: 61.838, lng: 8.566 },
          { name: "Sognefjellshytta", location: "Sognefjellet", type: "rest", description: "1430 moh, ofte snø rundt selv om sommeren.", lat: 61.566, lng: 7.998 },
          { name: "Mefjellet utsiktspunkt", location: "Sognefjellet", type: "viewpoint", description: "Arkitektrasteplass — stopp for bildet.", lat: 61.553, lng: 7.917 },
          { name: "Turtagrø", location: "Luster", type: "lodging", description: "Klatremiljøet sitt hjem; god kaffe.", lat: 61.504, lng: 7.808 },
          { name: "Skjolden", location: "Skjolden", type: "city", description: "Innerst i Sognefjorden — videre mot Lustrafjorden.", lat: 61.502, lng: 7.594 },
        ],
      },
    ],
  },
  {
    id: t("drammen-gaustatoppen"),
    slug: "drammen-rodberg-gaustatoppen",
    title: "Drammen – Rødberg – Gaustatoppen",
    subtitle: "Numedal opp, Telemark hjem",
    region: "Buskerud / Telemark",
    country: "no",
    macroRegions: ["ostlandet"],
    vehicleSuitability: ["motorcycle", "car"],
    style: "curvy",
    distanceKm: 320,
    drivingTime: "5–6 t kjøring + stopp",
    estimatedDurationMin: 330,
    stopsCount: 6,
    cover: "valley",
    coverImage: heroFjord,
    shortDescription: "Inn Numedal til Rødberg, opp på Hardangervidda og ned via Tinnsjø til Gaustatoppen.",
    whyDrive:
      "En perfekt langhelg fra Østlandet uten å måtte krysse hele landet. Numedalsdraget gir deg eldgammel stavkirke-arkitektur, Rødberg/Nore er et stille blikk inn i innlandet, og avslutningen på Gaustatoppen er Telemarks signaturbilde. Lite trafikk og god MC-asfalt.",
    origin: "Drammen",
    destination: "Rjukan / Gaustatoppen",
    originLoc: { lat: 59.744, lng: 10.204 },
    destinationLoc: { lat: 59.851, lng: 8.652 },
    tags: ["Svingete vei", "Innland", "Stavkirker", "MC-favoritt"],
    days: [
      {
        title: "Drammen → Kongsberg → Rødberg",
        stops: [
          { name: "Kongsberg sølvverk", location: "Kongsberg", type: "attraction", description: "Verdt en kort omvei.", lat: 59.665, lng: 9.652 },
          { name: "Nore stavkirke", location: "Nore", type: "attraction", description: "1167. Stopp for et bilde og en tankepause.", lat: 60.179, lng: 9.014 },
          { name: "Rødberg", location: "Rødberg", type: "lodging", description: "Lite tettsted, god base for natta.", lat: 60.275, lng: 8.788 },
        ],
      },
      {
        title: "Rødberg → Geilo → Rjukan → Gaustatoppen",
        stops: [
          { name: "Dagali", location: "Dagali", type: "viewpoint", description: "Vidda åpner seg.", lat: 60.420, lng: 8.495 },
          { name: "Rjukan", location: "Rjukan", type: "city", description: "Industri-arkitektur og solspeil.", lat: 59.880, lng: 8.595 },
          { name: "Gaustatoppen", location: "Tuddal", type: "viewpoint", description: "1883 moh — på klare dager ser du 1/6 av Norge.", lat: 59.851, lng: 8.652 },
        ],
      },
    ],
  },
  {
    id: t("fin-runde-drammen"),
    slug: "fin-runde-fra-drammen",
    title: "Fin runde fra Drammen",
    subtitle: "Søndagstur uten å pakke kofferten",
    region: "Buskerud",
    country: "no",
    macroRegions: ["ostlandet"],
    vehicleSuitability: ["motorcycle", "car"],
    style: "cruise",
    distanceKm: 180,
    drivingTime: "3–4 t",
    estimatedDurationMin: 200,
    stopsCount: 4,
    cover: "forest",
    coverImage: routeHardanger,
    shortDescription: "Drammen → Eggedal → Sigdal → Krødsherad — rolig dagsrunde med god kaffe.",
    whyDrive:
      "Perfekt når du har 4 timer og vil ha noe finere enn motorveien. Lite trafikk, god asfalt, åpne jorder og noen av Buskeruds beste bakerier. Ideelt for en søndagstur med vennegjengen.",
    origin: "Drammen",
    destination: "Drammen (rundtur)",
    originLoc: { lat: 59.744, lng: 10.204 },
    destinationLoc: { lat: 59.744, lng: 10.204 },
    tags: ["Rolig cruise", "Kaffestopp", "Søndagstur", "Innland"],
    days: [
      {
        title: "Drammen rundt via Sigdal",
        stops: [
          { name: "Vikersund", location: "Modum", type: "rest", description: "Skiflygingsanlegget på avstand.", lat: 59.969, lng: 9.969 },
          { name: "Sigdal", location: "Sigdal", type: "rest", description: "Theodor Kittelsens hjemtrakter.", lat: 60.018, lng: 9.659 },
          { name: "Eggedal bakeri", location: "Eggedal", type: "food", description: "Kanelbolle og kaffe.", lat: 60.135, lng: 9.305 },
          { name: "Krødsherad", location: "Krødsherad", type: "viewpoint", description: "Krøderen og siste etappe hjem.", lat: 60.087, lng: 9.687 },
        ],
      },
    ],
  },
  {
    id: t("sognefjellet-drammen"),
    slug: "sognefjellet-til-drammen",
    title: "Sognefjellet til Drammen",
    subtitle: "Fjell, fjord og hjem — på to dager",
    region: "Vestland → Buskerud",
    country: "no",
    macroRegions: ["vestlandet", "innlandet", "ostlandet"],
    vehicleSuitability: ["motorcycle", "car"],
    style: "scenic",
    distanceKm: 540,
    drivingTime: "9–10 t over 2 dager",
    estimatedDurationMin: 570,
    stopsCount: 7,
    cover: "mountain",
    coverImage: routeSognefjellet,
    shortDescription: "Skjolden → Sognefjellet → Valdres → Hallingdal → Drammen.",
    whyDrive:
      "En klassisk sommeretappe hjem fra Vestlandet. Du tar høydedramaet over Sognefjellet, slipper deg ned gjennom Valdres med Strondafjorden og Slidrefjorden, og kommer hjem via Hallingdal. To dager med en god overnatting underveis (Beitostølen eller Gol) er perfekt.",
    origin: "Skjolden",
    destination: "Drammen",
    originLoc: { lat: 61.502, lng: 7.594 },
    destinationLoc: { lat: 59.744, lng: 10.204 },
    tags: ["Fjellovergang", "Svingete vei", "Innland", "Etappetur"],
    days: [
      {
        title: "Skjolden → Sognefjellet → Beitostølen",
        stops: [
          { name: "Turtagrø", location: "Luster", type: "rest", description: "Kaffepause før fjellet.", lat: 61.504, lng: 7.808 },
          { name: "Sognefjellshytta", location: "Sognefjellet", type: "viewpoint", description: "Pause med utsikt.", lat: 61.566, lng: 7.998 },
          { name: "Beitostølen", location: "Øystre Slidre", type: "lodging", description: "Overnatting på fjellet.", lat: 61.246, lng: 8.901 },
        ],
      },
      {
        title: "Beitostølen → Valdres → Hallingdal → Drammen",
        stops: [
          { name: "Fagernes", location: "Valdres", type: "rest", description: "Lunsj ved Strondafjorden.", lat: 60.989, lng: 9.230 },
          { name: "Gol", location: "Hallingdal", type: "rest", description: "Stavkirke (replika) og påfyll.", lat: 60.700, lng: 8.949 },
          { name: "Hønefoss", location: "Ringerike", type: "city", description: "Siste etappe ned mot Drammen.", lat: 60.168, lng: 10.255 },
          { name: "Drammen", location: "Drammen", type: "city", description: "Hjem.", lat: 59.744, lng: 10.204 },
        ],
      },
    ],
  },
];

export function getCuratedTrip(slug: string): CuratedTrip | null {
  return CURATED_TRIPS.find((t) => t.slug === slug) ?? null;
}

export function listCuratedTrips(): CuratedTrip[] {
  return CURATED_TRIPS;
}

/** Return all stops with coordinates as a flat array of points. */
export function curatedTripPoints(trip: CuratedTrip): Array<{ lat: number; lng: number; label?: string }> {
  const pts: Array<{ lat: number; lng: number; label?: string }> = [];
  pts.push({ lat: trip.originLoc.lat, lng: trip.originLoc.lng, label: trip.origin });
  trip.days.forEach((d) => {
    d.stops.forEach((s) => {
      if (typeof s.lat === "number" && typeof s.lng === "number") {
        const dup = pts.length > 0 && pts[pts.length - 1].lat === s.lat && pts[pts.length - 1].lng === s.lng;
        if (!dup) pts.push({ lat: s.lat, lng: s.lng, label: s.name });
      }
    });
  });
  const last = pts[pts.length - 1];
  if (!last || last.lat !== trip.destinationLoc.lat || last.lng !== trip.destinationLoc.lng) {
    pts.push({ lat: trip.destinationLoc.lat, lng: trip.destinationLoc.lng, label: trip.destination });
  }
  return pts;
}

export const COUNTRY_LABEL: Record<Country, string> = {
  no: "Norge",
  se: "Sverige",
  dk: "Danmark",
  de: "Tyskland",
};
