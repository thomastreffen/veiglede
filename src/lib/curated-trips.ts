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
  {
    id: t("tyrifjorden-rundt"),
    slug: "tyrifjorden-rundt",
    title: "Tyrifjorden rundt",
    subtitle: "Klassisk Ringerike-runde med fjordutsikt",
    region: "Buskerud",
    country: "no",
    macroRegions: ["ostlandet"],
    vehicleSuitability: ["motorcycle", "car"],
    style: "cruise",
    distanceKm: 95,
    drivingTime: "2–3 t med stopp",
    estimatedDurationMin: 130,
    stopsCount: 5,
    cover: "forest",
    coverImage: heroFjord,
    shortDescription: "Hønefoss → Sundvollen → Sylling → Vikersund — fjord, jorder og kafé.",
    whyDrive:
      "Tyrifjorden er en av Østlandets fineste søndagsrunder. Du får utsikten fra Kongens utsikt, kjører forbi Utøya, og lander hos kanelbollen i Sigdal. Kort nok til en formiddag, fin nok til å gjøre om igjen.",
    origin: "Hønefoss",
    destination: "Hønefoss (rundtur)",
    originLoc: { lat: 60.168, lng: 10.255 },
    destinationLoc: { lat: 60.168, lng: 10.255 },
    tags: ["Rundtur", "Søndagstur", "Fjordutsikt", "Innland"],
    days: [
      {
        title: "Tyrifjorden rundt via Sundvollen",
        stops: [
          { name: "Kongens utsikt", location: "Krokkleiva", type: "viewpoint", description: "Utsikten over Tyrifjorden — klassikeren.", lat: 60.082, lng: 10.347 },
          { name: "Sundvollen", location: "Hole", type: "rest", description: "Kaffepause før Steinsfjorden.", lat: 60.062, lng: 10.272 },
          { name: "Sylling", location: "Lier", type: "viewpoint", description: "Sørsiden av fjorden — mindre trafikk.", lat: 59.872, lng: 10.265 },
          { name: "Vikersund", location: "Modum", type: "rest", description: "Vendepunkt vest for fjorden.", lat: 59.969, lng: 9.969 },
          { name: "Hønefoss", location: "Ringerike", type: "city", description: "Tilbake der du startet.", lat: 60.168, lng: 10.255 },
        ],
      },
    ],
  },
  {
    id: t("oslofjorden-vestside"),
    slug: "oslofjorden-vestside",
    title: "Oslofjorden vestside",
    subtitle: "Oslo → Larvik langs kysten",
    region: "Oslo / Vestfold",
    country: "no",
    macroRegions: ["ostlandet"],
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "cruise",
    distanceKm: 175,
    drivingTime: "4–5 t med stopp",
    estimatedDurationMin: 230,
    stopsCount: 6,
    cover: "coast",
    coverImage: routeAtlanterhavsveien,
    shortDescription: "Oslo → Drøbak → Horten ferge → Tønsberg → Larvik — fjord, festninger og hvit Vestfold-kyst.",
    whyDrive:
      "Den fineste varianten av en sommerdag fra Oslo: ned vestsiden med korte stopp i Drøbak, ferge over til Horten og lunsj i Tønsberg før du lander på Stavernsodden. God som dagstur eller med én overnatting.",
    origin: "Oslo",
    destination: "Larvik",
    originLoc: { lat: 59.913, lng: 10.752 },
    destinationLoc: { lat: 59.054, lng: 10.029 },
    tags: ["Kystvei", "Ferje", "Søndagstur", "Vestfold"],
    days: [
      {
        title: "Oslo → Drøbak → Horten → Tønsberg → Larvik",
        stops: [
          { name: "Drøbak sentrum", location: "Frogn", type: "city", description: "Trehus og brygge — kort stopp.", lat: 59.665, lng: 10.629 },
          { name: "Moss–Horten ferge", location: "Moss", type: "ferry", description: "Klassisk fjordkryssing.", lat: 59.434, lng: 10.661 },
          { name: "Karljohansvern", location: "Horten", type: "attraction", description: "Marinemuseum og park.", lat: 59.427, lng: 10.481 },
          { name: "Tønsberg brygge", location: "Tønsberg", type: "food", description: "Lunsj på brygga.", lat: 59.267, lng: 10.408 },
          { name: "Stavern", location: "Larvik", type: "viewpoint", description: "Hvite trehus og badebukter.", lat: 58.997, lng: 10.040 },
          { name: "Larvik", location: "Larvik", type: "city", description: "Veis ende — eller fortsett mot Kragerø.", lat: 59.054, lng: 10.029 },
        ],
      },
    ],
  },
  {
    id: t("kongsberg-blefjell-notodden"),
    slug: "kongsberg-blefjell-notodden",
    title: "Kongsberg – Blefjell – Notodden",
    subtitle: "Sølv, fjell og stavkirke på én dag",
    region: "Buskerud / Telemark",
    country: "no",
    macroRegions: ["ostlandet"],
    vehicleSuitability: ["motorcycle", "car"],
    style: "curvy",
    distanceKm: 140,
    drivingTime: "3–4 t med stopp",
    estimatedDurationMin: 190,
    stopsCount: 5,
    cover: "mountain",
    coverImage: routeSognefjellet,
    shortDescription: "Kongsberg → Lampeland → Blefjell → Heddal stavkirke → Notodden.",
    whyDrive:
      "En perfekt halvdagsrunde med variasjon: sølvverk i Kongsberg, åpen fjellvei over Blefjell og avslutning ved Heddal — Norges største stavkirke. God MC-asfalt og lite turisttrafikk.",
    origin: "Kongsberg",
    destination: "Notodden",
    originLoc: { lat: 59.665, lng: 9.652 },
    destinationLoc: { lat: 59.560, lng: 9.260 },
    tags: ["Svingete vei", "Stavkirke", "Innland", "MC-favoritt"],
    days: [
      {
        title: "Kongsberg → Blefjell → Notodden",
        stops: [
          { name: "Kongsberg sentrum", location: "Kongsberg", type: "city", description: "Start ved Lågen.", lat: 59.665, lng: 9.652 },
          { name: "Lampeland", location: "Flesberg", type: "rest", description: "Kaffe før fjellet.", lat: 59.875, lng: 9.530 },
          { name: "Blefjell utsikt", location: "Flesberg", type: "viewpoint", description: "Åpen fjellvei med utsikt mot Hardangervidda.", lat: 59.910, lng: 9.241 },
          { name: "Heddal stavkirke", location: "Notodden", type: "attraction", description: "Norges største stavkirke.", lat: 59.578, lng: 9.171 },
          { name: "Notodden", location: "Notodden", type: "city", description: "Bluesbyen — avslutt ved Tinnsjø.", lat: 59.560, lng: 9.260 },
        ],
      },
    ],
  },
  {
    id: t("telemarkskanalen-runde"),
    slug: "telemarkskanalen-runde",
    title: "Telemarkskanalen-runde",
    subtitle: "Slusene, Skien og innlandet",
    region: "Telemark",
    country: "no",
    macroRegions: ["ostlandet"],
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "scenic",
    distanceKm: 210,
    drivingTime: "4–6 t med stopp",
    estimatedDurationMin: 290,
    stopsCount: 6,
    cover: "valley",
    coverImage: heroFjord,
    shortDescription: "Skien → Ulefoss → Lunde → Dalen → Bø → Skien — kanal, sluser og frodige daler.",
    whyDrive:
      "Du følger Telemarkskanalen fra Skien til Dalen — 105 km menneskeskapt vannvei med 18 sluser. Stopp ved Ulefoss og Vrangfoss for sluse-show, og spis lunsj på Dalen Hotell hvis du har tid.",
    origin: "Skien",
    destination: "Skien (rundtur)",
    originLoc: { lat: 59.207, lng: 9.609 },
    destinationLoc: { lat: 59.207, lng: 9.609 },
    tags: ["Kanal", "Sluser", "Innland", "Rundtur"],
    days: [
      {
        title: "Skien → Ulefoss → Dalen → Bø → Skien",
        stops: [
          { name: "Ulefoss sluser", location: "Nome", type: "attraction", description: "Første slusestopp.", lat: 59.286, lng: 9.272 },
          { name: "Vrangfoss", location: "Nome", type: "viewpoint", description: "Største sluse — fem trinn.", lat: 59.319, lng: 9.157 },
          { name: "Dalen", location: "Tokke", type: "lodging", description: "Eventyrhotell fra 1894.", lat: 59.448, lng: 8.005 },
          { name: "Lårdal", location: "Tokke", type: "rest", description: "Pause mellom fjellene.", lat: 59.413, lng: 8.106 },
          { name: "Bø", location: "Midt-Telemark", type: "city", description: "Sommerland-byen.", lat: 59.413, lng: 9.062 },
          { name: "Skien", location: "Skien", type: "city", description: "Tilbake der du startet.", lat: 59.207, lng: 9.609 },
        ],
      },
    ],
  },
  {
    id: t("mjosa-rundt"),
    slug: "mjosa-rundt",
    title: "Mjøsa rundt",
    subtitle: "Hamar → Gjøvik → Lillehammer → Hamar",
    region: "Innlandet",
    country: "no",
    macroRegions: ["innlandet", "ostlandet"],
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "cruise",
    distanceKm: 200,
    drivingTime: "4–5 t med stopp",
    estimatedDurationMin: 260,
    stopsCount: 6,
    cover: "valley",
    coverImage: heroFjord,
    shortDescription: "Klassisk Mjøsa-runde forbi Skibladner, Maihaugen og Atlungstad brenneri.",
    whyDrive:
      "Norges største innsjø rundt på en dag. Vestsiden er åpen og flat med utsikt mot Hedmarkstoppen, østsiden gir deg Hamar domkirke-ruin og Atlungstad. Skibladner ligger ved Gjøvik om sommeren.",
    origin: "Hamar",
    destination: "Hamar (rundtur)",
    originLoc: { lat: 60.794, lng: 11.067 },
    destinationLoc: { lat: 60.794, lng: 11.067 },
    tags: ["Rundtur", "Innsjø", "Innland", "Søndagstur"],
    days: [
      {
        title: "Mjøsa rundt mot klokken",
        stops: [
          { name: "Domkirkeodden", location: "Hamar", type: "attraction", description: "Hamars middelaldersk ruin.", lat: 60.808, lng: 11.067 },
          { name: "Moelv bru", location: "Ringsaker", type: "viewpoint", description: "Krysser Mjøsa — bra fotostopp.", lat: 60.928, lng: 10.700 },
          { name: "Lillehammer / Maihaugen", location: "Lillehammer", type: "attraction", description: "Friluftsmuseum og OL-by.", lat: 61.117, lng: 10.466 },
          { name: "Gjøvik", location: "Gjøvik", type: "rest", description: "Lunsjpause ved Mjøsa.", lat: 60.795, lng: 10.692 },
          { name: "Skreia", location: "Østre Toten", type: "rest", description: "Vestsiden med jorder og kornåkre.", lat: 60.643, lng: 10.928 },
          { name: "Atlungstad brenneri", location: "Stange", type: "food", description: "Lokalt brenneri og kafé.", lat: 60.737, lng: 11.137 },
        ],
      },
    ],
  },
  {
    id: t("valdresflye"),
    slug: "valdresflye",
    title: "Valdresflye",
    subtitle: "Norges nest høyeste fjellovergang",
    region: "Innlandet",
    country: "no",
    macroRegions: ["innlandet"],
    vehicleSuitability: ["motorcycle", "car"],
    style: "scenic",
    distanceKm: 75,
    drivingTime: "2 t med stopp",
    estimatedDurationMin: 110,
    stopsCount: 4,
    cover: "mountain",
    coverImage: routeSognefjellet,
    shortDescription: "Beitostølen → Valdresflye → Vågå — 1389 moh midt i Jotunheimen.",
    whyDrive:
      "En av landets fineste fjelloverganger: åpen utsikt mot Jotunheimens topper hele veien. Best i juni–september. Kombinér gjerne med Sognefjellet eller Rondane for en lengre fjellhelg.",
    origin: "Beitostølen",
    destination: "Vågå",
    originLoc: { lat: 61.246, lng: 8.901 },
    destinationLoc: { lat: 61.876, lng: 9.099 },
    tags: ["Fjellovergang", "Nasjonale turistveier", "MC-favoritt"],
    days: [
      {
        title: "Beitostølen → Valdresflye → Vågå",
        stops: [
          { name: "Beitostølen", location: "Øystre Slidre", type: "city", description: "Start ved fjellet.", lat: 61.246, lng: 8.901 },
          { name: "Gjende / Bessheim", location: "Vågå", type: "viewpoint", description: "Innfallsport til Besseggen.", lat: 61.502, lng: 8.812 },
          { name: "Vargebakkane utsikt", location: "Valdresflye", type: "viewpoint", description: "Arkitektrasteplass.", lat: 61.430, lng: 9.060 },
          { name: "Vågå", location: "Vågå", type: "city", description: "Veis ende — videre mot Lom.", lat: 61.876, lng: 9.099 },
        ],
      },
    ],
  },
  {
    id: t("rondane-venabygdsfjellet"),
    slug: "rondane-venabygdsfjellet",
    title: "Rondane & Venabygdsfjellet",
    subtitle: "Lett fjellrunde fra Ringebu",
    region: "Innlandet",
    country: "no",
    macroRegions: ["innlandet"],
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "scenic",
    distanceKm: 130,
    drivingTime: "3 t med stopp",
    estimatedDurationMin: 175,
    stopsCount: 4,
    cover: "mountain",
    coverImage: routeSognefjellet,
    shortDescription: "Ringebu → Venabygdsfjellet → Atnsjøen → Rondvassbu-parkering.",
    whyDrive:
      "Mild fjellvei med Rondanes karakteristiske kuppelfjell rundt deg. Lavere enn Valdresflye, åpen fra mai. Lett kombinerbar med Lillehammer/Mjøsa for en lang helg.",
    origin: "Ringebu",
    destination: "Otta",
    originLoc: { lat: 61.527, lng: 10.157 },
    destinationLoc: { lat: 61.770, lng: 9.539 },
    tags: ["Fjellovergang", "Nasjonale turistveier", "Familietur"],
    days: [
      {
        title: "Ringebu → Venabygdsfjellet → Otta",
        stops: [
          { name: "Ringebu stavkirke", location: "Ringebu", type: "attraction", description: "Rød stavkirke fra 1220.", lat: 61.527, lng: 10.157 },
          { name: "Venabygdsfjellet", location: "Ringebu", type: "viewpoint", description: "Åpen vidde — Rondane på rad og rekke.", lat: 61.628, lng: 10.140 },
          { name: "Atnsjøen utsikt", location: "Stor-Elvdal", type: "viewpoint", description: "Postkortbildet av Rondane.", lat: 61.798, lng: 10.193 },
          { name: "Otta", location: "Sel", type: "city", description: "Lunsj og videre planlegging.", lat: 61.770, lng: 9.539 },
        ],
      },
    ],
  },
  {
    id: t("geiranger-trollstigen"),
    slug: "geiranger-trollstigen",
    title: "Geiranger → Trollstigen",
    subtitle: "To turistveier på én dag",
    region: "Møre og Romsdal",
    country: "no",
    macroRegions: ["more-romsdal"],
    vehicleSuitability: ["motorcycle", "car"],
    style: "scenic",
    distanceKm: 100,
    drivingTime: "3–5 t med ferge",
    estimatedDurationMin: 250,
    stopsCount: 5,
    cover: "fjord",
    coverImage: routeAtlanterhavsveien,
    shortDescription: "Geiranger → Ørnesvingen → Eidsdal ferge → Valldal → Trollstigen → Åndalsnes.",
    whyDrive:
      "Den ikoniske kombinasjonen. Geiranger fra Ørnesvingen, ferge over Norddalsfjorden, og Trollstigens 11 hårnålssvinger ned mot Åndalsnes. Best tidlig morgen for å unngå turistbusser.",
    origin: "Geiranger",
    destination: "Åndalsnes",
    originLoc: { lat: 62.103, lng: 7.207 },
    destinationLoc: { lat: 62.567, lng: 7.689 },
    tags: ["Nasjonale turistveier", "Hårnål", "Fjord", "MC-favoritt"],
    days: [
      {
        title: "Geiranger → Trollstigen → Åndalsnes",
        stops: [
          { name: "Ørnesvingen", location: "Geiranger", type: "viewpoint", description: "Klassisk utsiktspunkt mot Geirangerfjorden.", lat: 62.115, lng: 7.179 },
          { name: "Eidsdal–Linge ferge", location: "Norddal", type: "ferry", description: "20 min over Norddalsfjorden.", lat: 62.281, lng: 7.121 },
          { name: "Gudbrandsjuvet", location: "Valldal", type: "viewpoint", description: "Arkitektrasteplass over juvet.", lat: 62.314, lng: 7.391 },
          { name: "Trollstigen utsikt", location: "Rauma", type: "viewpoint", description: "Stigen ovenfra — 11 svinger ned.", lat: 62.456, lng: 7.660 },
          { name: "Åndalsnes", location: "Rauma", type: "city", description: "Lunsj og Romsdalseggen i synsfeltet.", lat: 62.567, lng: 7.689 },
        ],
      },
    ],
  },
  {
    id: t("helgelandskysten"),
    slug: "helgelandskysten",
    title: "Helgelandskysten",
    subtitle: "FV17 — Norges fineste kystvei",
    region: "Nordland",
    country: "no",
    macroRegions: ["nord-norge"],
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "scenic",
    distanceKm: 420,
    drivingTime: "2–3 dager med ferger",
    estimatedDurationMin: 720,
    stopsCount: 7,
    cover: "coast",
    coverImage: routeLofoten,
    shortDescription: "Brønnøysund → Sandnessjøen → Nesna → Bodø — 6 ferger og uendelig kyst.",
    whyDrive:
      "FV17 er Norges svar på en kystvei-roadtrip — øyhav, bruer og fergeforbindelser hele veien. Du trenger 2-3 dager og må reservere fergene på forhånd i juli. Ta turen i juni eller august for ledigere ferger.",
    origin: "Brønnøysund",
    destination: "Bodø",
    originLoc: { lat: 65.473, lng: 12.213 },
    destinationLoc: { lat: 67.280, lng: 14.405 },
    tags: ["Kystvei", "Ferje", "Etappetur", "Nasjonale turistveier"],
    days: [
      {
        title: "Brønnøysund → Sandnessjøen",
        stops: [
          { name: "Torghatten", location: "Brønnøy", type: "attraction", description: "Fjellet med hull i — kort tur opp.", lat: 65.405, lng: 12.107 },
          { name: "Tjøtta", location: "Alstahaug", type: "rest", description: "Krigshistorisk monument og kystutsikt.", lat: 65.825, lng: 12.430 },
          { name: "Sandnessjøen", location: "Alstahaug", type: "city", description: "De syv søstre i bakgrunnen.", lat: 66.022, lng: 12.628 },
        ],
      },
      {
        title: "Sandnessjøen → Nesna → Bodø",
        stops: [
          { name: "Nesna", location: "Nesna", type: "ferry", description: "Ferge nordover.", lat: 66.197, lng: 13.022 },
          { name: "Svartisen utsikt", location: "Meløy", type: "viewpoint", description: "Norges nest største isbre — fra veien.", lat: 66.838, lng: 13.730 },
          { name: "Saltstraumen", location: "Bodø", type: "attraction", description: "Verdens sterkeste tidevannsstrøm.", lat: 67.235, lng: 14.626 },
          { name: "Bodø", location: "Bodø", type: "city", description: "European Capital of Culture 2024.", lat: 67.280, lng: 14.405 },
        ],
      },
    ],
  },
  {
    id: t("sorlandet-kystcruise"),
    slug: "sorlandet-kystcruise",
    title: "Sørlandet kystcruise",
    subtitle: "Kragerø → Kristiansand → Mandal",
    region: "Agder",
    country: "no",
    macroRegions: ["sorlandet"],
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "cruise",
    distanceKm: 240,
    drivingTime: "5–6 t med stopp",
    estimatedDurationMin: 320,
    stopsCount: 6,
    cover: "coast",
    coverImage: routeAtlanterhavsveien,
    shortDescription: "Kragerø → Risør → Arendal → Lillesand → Kristiansand → Mandal — perler på rad og rekke.",
    whyDrive:
      "Det norske sommerpostkortet: hvite trehus, holmer og uthavner. Følg Riksvei 411 og 401 for kystnære alternativer til E18. Best i juni eller slutten av august for mindre folk.",
    origin: "Kragerø",
    destination: "Mandal",
    originLoc: { lat: 58.872, lng: 9.412 },
    destinationLoc: { lat: 58.029, lng: 7.456 },
    tags: ["Kystvei", "Trehus", "Sommer", "Søndagstur"],
    days: [
      {
        title: "Kragerø → Arendal → Kristiansand → Mandal",
        stops: [
          { name: "Risør", location: "Risør", type: "city", description: "Den hvite byen ved havet.", lat: 58.720, lng: 9.235 },
          { name: "Arendal", location: "Arendal", type: "city", description: "Pollen og Tyholmen.", lat: 58.461, lng: 8.769 },
          { name: "Lillesand", location: "Lillesand", type: "rest", description: "Sjarmerende havnefront.", lat: 58.249, lng: 8.378 },
          { name: "Kristiansand", location: "Kristiansand", type: "city", description: "Lunsj på Markens.", lat: 58.146, lng: 7.995 },
          { name: "Lindesnes fyr", location: "Lindesnes", type: "viewpoint", description: "Norges sørligste punkt.", lat: 57.984, lng: 7.048 },
          { name: "Mandal", location: "Mandal", type: "city", description: "Sjøsanden — Norges fineste bystrand.", lat: 58.029, lng: 7.456 },
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

// ---- Seed-time route geometry ---------------------------------------------
// Geometry for each curated trip is computed at seed time by the script
// `scripts/seed-curated-geometry.ts` and committed to `curated-geometry.json`.
// At runtime we just look it up by slug — no API call needed.
import curatedGeometryJson from "./curated-geometry.json";

interface CuratedGeometryEntry {
  geometry: Array<{ lat: number; lng: number }>;
  distanceKm: number;
  durationMin: number;
  provider?: string;
  computedAt?: string;
}

const CURATED_GEOMETRY = curatedGeometryJson as Record<string, CuratedGeometryEntry>;

export function getCuratedGeometry(slug: string): CuratedGeometryEntry | null {
  return CURATED_GEOMETRY[slug] ?? null;
}

/**
 * Region-relevance score for sorting curated trips against a selected macro
 * region. Lower = more relevant.
 *   0 = entire trip inside the region (start AND end)
 *   1 = starts in region
 *   2 = ends in region
 *   3 = passes through region
 *   4 = unrelated
 */
export function curatedRegionRelevance(c: CuratedTrip, region: MacroRegion): number {
  const regions = c.macroRegions;
  if (regions.length === 0) return 4;
  const starts = regions[0] === region;
  const ends = regions[regions.length - 1] === region;
  if (starts && ends) return 0;
  if (starts) return 1;
  if (ends) return 2;
  if (regions.includes(region)) return 3;
  return 4;
}

