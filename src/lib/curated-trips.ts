/**
 * Curated trips — Veiglede-authored seed content.
 *
 * These behave like real public route objects: they have stable ids
 * (`curated:<slug>`), live on their own `/inspirasjon/<slug>` page,
 * and can be reacted to / saved / copied just like a user-shared trip.
 *
 * The stable id prefix means existing `trip_reactions` and `saved_trips`
 * rows can target a curated trip without any schema change.
 */

import type { CoverKey, RouteStyle, VehicleType } from "@/lib/trips-store";
import routeLofoten from "@/assets/route-lofoten.jpg";
import routeAtlanterhavsveien from "@/assets/route-atlanterhavsveien.jpg";
import routeHardanger from "@/assets/route-hardanger.jpg";
import routeSognefjellet from "@/assets/route-sognefjellet.jpg";
import routeTrollstigen from "@/assets/route-trollstigen.jpg";
import heroFjord from "@/assets/hero-fjord.jpg";

export type Country = "no" | "se" | "dk" | "de";

export interface CuratedStop {
  name: string;
  location?: string;
  type: "viewpoint" | "photo" | "food" | "lodging" | "fuel" | "attraction" | "rest" | "city" | "experience" | "detour" | "ferry";
  description?: string;
  estimatedTime?: string;
}

export interface CuratedDay {
  title: string;
  summary?: string;
  stops: CuratedStop[];
}

export interface CuratedTrip {
  /** Stable id used across reactions/saves. Format: `curated:<slug>`. */
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  country: Country;
  /** Which vehicles this route is well suited for. */
  vehicleSuitability: VehicleType[];
  style: RouteStyle;
  distanceKm: number;
  drivingTime: string;
  stopsCount: number;
  cover: CoverKey;
  coverImage: string;
  /** Short one-liner — used in cards. */
  shortDescription: string;
  /** Long-form "why this route is worth driving". */
  whyDrive: string;
  origin: string;
  destination: string;
  days: CuratedDay[];
  /** Soft tag chips: scenic styles, road characteristics, etc. */
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
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "scenic",
    distanceKm: 230,
    drivingTime: "5–7 t kjøring + stopp",
    stopsCount: 7,
    cover: "lofoten",
    coverImage: routeLofoten,
    shortDescription: "Fra Svolvær til Å — alpetinder rett opp av havet og rorbuer på rad og rekke.",
    whyDrive:
      "Få strekninger i Norge gir like mye for hver kilometer som E10 gjennom Lofoten. Du kjører forbi tinder som stiger rett opp av havet, krysser broer mellom øyer og kommer til fiskevær som ser ut som postkort. Best i mai–september når veiene er åpne og det er lyst sent.",
    origin: "Svolvær",
    destination: "Å i Lofoten",
    tags: ["Kystvei", "Fototur", "Nasjonale turistveier", "Bro-arkitektur"],
    days: [
      {
        title: "Svolvær → Henningsvær → Nusfjord",
        summary: "Start mykt med fiskevær og en av Norges fineste sidegater (Henningsvær-broene).",
        stops: [
          { name: "Svolvær", location: "Svolvær, Vågan", type: "city", description: "Klassisk start på Lofoten — havn, kafé og Svolværgeita over byen." },
          { name: "Henningsvær", location: "Henningsvær", type: "viewpoint", description: "Sving av E10 og kjør broene ut til galleribyen.", estimatedTime: "1–2 t" },
          { name: "Nusfjord", location: "Nusfjord, Flakstad", type: "attraction", description: "Et av Norges best bevarte fiskevær. Liten omvei, stor opplevelse." },
        ],
      },
      {
        title: "Nusfjord → Ramberg → Reine → Å",
        summary: "Den fotogene halvdelen: hvit sand, Reinefjorden og Å som veis ende.",
        stops: [
          { name: "Rambergstranda", location: "Flakstad", type: "photo", description: "Hvit sandstrand med utsikt mot Hustinden." },
          { name: "Reinebringen utsiktspunkt", location: "Reine", type: "viewpoint", description: "Kjør forbi om du ikke skal gå opp — utsikten fra parkering er også bra." },
          { name: "Å i Lofoten", location: "Å, Moskenes", type: "city", description: "Veis ende. Tørrfiskmuseum og rorbuer fra 1800-tallet." },
          { name: "Anker for natten", location: "Reine eller Sakrisøy", type: "lodging", description: "Rorbu rett over fjorden." },
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
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "tourist",
    distanceKm: 160,
    drivingTime: "3–4 t med stopp",
    stopsCount: 5,
    cover: "coast",
    coverImage: routeAtlanterhavsveien,
    shortDescription: "Kristiansund → Molde via Storseisundet — broer som ser ut som de kaster bilen ut i havet.",
    whyDrive:
      "Selve Atlanterhavsveien er bare 8,3 km, men dette er strekningen som har vært på alle Top Gear-lister av en grunn. Best i kuling — bølgene slår over rekkverket og Storseisundet får sin signaturoptiske illusjon. Kombiner med Bremnes utkikkstårn og Bud fiskevær for en hel dag.",
    origin: "Kristiansund",
    destination: "Molde",
    tags: ["Nasjonale turistveier", "Kystvei", "Bro-arkitektur", "Fototur"],
    days: [
      {
        title: "Kristiansund → Atlanterhavsveien → Bud → Molde",
        summary: "Hele klassikeren i én dag — kort på papiret, men du vil stoppe ofte.",
        stops: [
          { name: "Kristiansund sentrum", location: "Kristiansund", type: "city", description: "Klippfiskbyen — ta en kaffe på Smia før du kjører." },
          { name: "Storseisundbrua", location: "Averøy", type: "viewpoint", description: "Selve bildet. Stopp ved Eldhusøya like før eller etter.", estimatedTime: "30–45 min" },
          { name: "Eldhusøya utsiktsplattform", location: "Averøy", type: "photo", description: "Arkitektonisk rasteplass med kafé." },
          { name: "Bud fiskevær", location: "Bud", type: "attraction", description: "Lite fiskevær med havkant og krigsminne (Ergan kystfort)." },
          { name: "Molde panorama", location: "Molde", type: "viewpoint", description: "Avslutt med utsikt over Romsdalsalpene fra Varden." },
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
    vehicleSuitability: ["motorcycle", "car", "rv"],
    style: "scenic",
    distanceKm: 600,
    drivingTime: "2–3 dager",
    stopsCount: 8,
    cover: "fjord",
    coverImage: routeHardanger,
    shortDescription: "Rundtur fra Bergen via Norheimsund, Eidfjord, Vøringsfossen og tilbake over Kvamskogen.",
    whyDrive:
      "Hardanger er Vestlandet i ett konsentrert område: dramatiske fjorder, brattlent frukthager (best i mai), Vøringsfossen som braser 182 meter rett ned og noen av landets fineste fjordveier. Egner seg som en avslappet helgetur med én eller to overnattinger.",
    origin: "Bergen",
    destination: "Bergen (rundtur)",
    tags: ["Fjord", "Nasjonale turistveier", "Foss", "Rolig cruise"],
    days: [
      {
        title: "Bergen → Norheimsund → Utne",
        stops: [
          { name: "Steinsdalsfossen", location: "Norheimsund", type: "viewpoint", description: "Gå bak fossen — bokstavelig talt." },
          { name: "Utne ferge", location: "Utne", type: "ferry", description: "Kort ferge over Hardangerfjorden — pakk kaffe." },
          { name: "Utne hotell", location: "Utne", type: "lodging", description: "Norges eldste hotell i drift (1722)." },
        ],
      },
      {
        title: "Utne → Eidfjord → Vøringsfossen",
        stops: [
          { name: "Eidfjord", location: "Eidfjord", type: "city", description: "Stopp for lunsj med utsikt." },
          { name: "Vøringsfossen", location: "Måbødalen", type: "viewpoint", description: "Den nye trappa og gangbroa er obligatorisk." },
          { name: "Hardangervidda Natursenter", location: "Eidfjord", type: "attraction", description: "Bra for regnvær." },
        ],
      },
      {
        title: "Eidfjord → Kvamskogen → Bergen",
        stops: [
          { name: "Skjeggedal", location: "Tyssedal", type: "detour", description: "Hvis du har gått Trolltunga, kjenner du parkeringa." },
          { name: "Kvamskogen", location: "Kvam", type: "viewpoint", description: "Fin avslutning over fjellet før du faller ned mot Bergen." },
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
    vehicleSuitability: ["motorcycle", "car"],
    style: "curvy",
    distanceKm: 108,
    drivingTime: "2,5–3 t",
    stopsCount: 5,
    cover: "mountain",
    coverImage: routeSognefjellet,
    shortDescription: "Lom → Skjolden over Sognefjellet — 1434 moh og snø langs veien til midten av juli.",
    whyDrive:
      "Sognefjellsvegen er en MC-klassiker. Asfalt i god stand, lange svinger med god sikt og et høydedrama som tar pusten fra deg. Best i juni–august; ofte stengt resten av året. Kombiner med Jotunheimen og Lustrafjorden for en perfekt helg.",
    origin: "Lom",
    destination: "Skjolden",
    tags: ["Svingete vei", "Fjellovergang", "MC-favoritt", "Nasjonale turistveier"],
    days: [
      {
        title: "Lom → Sognefjellshytta → Turtagrø → Skjolden",
        stops: [
          { name: "Lom stavkirke", location: "Lom", type: "attraction", description: "Klassisk start. Bakeriet i sentrum er en institusjon." },
          { name: "Sognefjellshytta", location: "Sognefjellet", type: "rest", description: "1430 moh, ofte snø rundt selv om sommeren." },
          { name: "Mefjellet utsiktspunkt", location: "Sognefjellet", type: "viewpoint", description: "Arkitektrasteplass — stopp for bildet." },
          { name: "Turtagrø", location: "Luster", type: "lodging", description: "Klatremiljøet sitt hjem; god kaffe." },
          { name: "Skjolden", location: "Skjolden", type: "city", description: "Innerst i Sognefjorden — videre mot Lustrafjorden." },
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
    vehicleSuitability: ["motorcycle", "car"],
    style: "curvy",
    distanceKm: 320,
    drivingTime: "5–6 t kjøring + stopp",
    stopsCount: 6,
    cover: "valley",
    coverImage: heroFjord,
    shortDescription: "Inn Numedal til Rødberg, opp på Hardangervidda og ned via Tinnsjø til Gaustatoppen.",
    whyDrive:
      "En perfekt langhelg fra Østlandet uten å måtte krysse hele landet. Numedalsdraget gir deg eldgammel stavkirke-arkitektur, Rødberg/Nore er et stille blikk inn i innlandet, og avslutningen på Gaustatoppen er Telemarks signaturbilde. Lite trafikk og god MC-asfalt.",
    origin: "Drammen",
    destination: "Rjukan / Gaustatoppen",
    tags: ["Svingete vei", "Innland", "Stavkirker", "MC-favoritt"],
    days: [
      {
        title: "Drammen → Kongsberg → Rødberg",
        stops: [
          { name: "Kongsberg sølvverk", location: "Kongsberg", type: "attraction", description: "Verdt en kort omvei." },
          { name: "Nore stavkirke", location: "Nore", type: "attraction", description: "1167. Stopp for et bilde og en tankepause." },
          { name: "Rødberg", location: "Rødberg", type: "lodging", description: "Lite tettsted, god base for natta." },
        ],
      },
      {
        title: "Rødberg → Geilo → Rjukan → Gaustatoppen",
        stops: [
          { name: "Dagali", location: "Dagali", type: "viewpoint", description: "Vidda åpner seg." },
          { name: "Rjukan", location: "Rjukan", type: "city", description: "Industri-arkitektur og solspeil." },
          { name: "Gaustatoppen", location: "Tuddal", type: "viewpoint", description: "1883 moh — på klare dager ser du 1/6 av Norge." },
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
    vehicleSuitability: ["motorcycle", "car"],
    style: "cruise",
    distanceKm: 180,
    drivingTime: "3–4 t",
    stopsCount: 4,
    cover: "forest",
    coverImage: routeHardanger,
    shortDescription: "Drammen → Eggedal → Sigdal → Krødsherad — rolig dagsrunde med god kaffe.",
    whyDrive:
      "Perfekt når du har 4 timer og vil ha noe finere enn motorveien. Lite trafikk, god asfalt, åpne jorder og noen av Buskeruds beste bakerier. Ideelt for en søndagstur med vennegjengen.",
    origin: "Drammen",
    destination: "Drammen (rundtur)",
    tags: ["Rolig cruise", "Kaffestopp", "Søndagstur", "Innland"],
    days: [
      {
        title: "Drammen rundt via Sigdal",
        stops: [
          { name: "Vikersund", location: "Modum", type: "rest", description: "Skiflygingsanlegget på avstand." },
          { name: "Sigdal", location: "Sigdal", type: "rest", description: "Theodor Kittelsens hjemtrakter." },
          { name: "Eggedal bakeri", location: "Eggedal", type: "food", description: "Kanelbolle og kaffe." },
          { name: "Krødsherad", location: "Krødsherad", type: "viewpoint", description: "Krøderen og siste etappe hjem." },
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
    vehicleSuitability: ["motorcycle", "car"],
    style: "scenic",
    distanceKm: 540,
    drivingTime: "9–10 t over 2 dager",
    stopsCount: 7,
    cover: "mountain",
    coverImage: routeSognefjellet,
    shortDescription: "Skjolden → Sognefjellet → Valdres → Hallingdal → Drammen.",
    whyDrive:
      "En klassisk sommeretappe hjem fra Vestlandet. Du tar høydedramaet over Sognefjellet, slipper deg ned gjennom Valdres med Strondafjorden og Slidrefjorden, og kommer hjem via Hallingdal. To dager med en god overnatting underveis (Beitostølen eller Gol) er perfekt.",
    origin: "Skjolden",
    destination: "Drammen",
    tags: ["Fjellovergang", "Svingete vei", "Innland", "Etappetur"],
    days: [
      {
        title: "Skjolden → Sognefjellet → Beitostølen",
        stops: [
          { name: "Turtagrø", location: "Luster", type: "rest", description: "Kaffepause før fjellet." },
          { name: "Sognefjellshytta", location: "Sognefjellet", type: "viewpoint", description: "Pause med utsikt." },
          { name: "Beitostølen", location: "Øystre Slidre", type: "lodging", description: "Overnatting på fjellet." },
        ],
      },
      {
        title: "Beitostølen → Valdres → Hallingdal → Drammen",
        stops: [
          { name: "Fagernes", location: "Valdres", type: "rest", description: "Lunsj ved Strondafjorden." },
          { name: "Gol", location: "Hallingdal", type: "rest", description: "Stavkirke (replika) og påfyll." },
          { name: "Hønefoss", location: "Ringerike", type: "city", description: "Siste etappe ned mot Drammen." },
          { name: "Drammen", location: "Drammen", type: "city", description: "Hjem." },
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

export const COUNTRY_LABEL: Record<Country, string> = {
  no: "Norge",
  se: "Sverige",
  dk: "Danmark",
  de: "Tyskland",
};
