import type { VehicleType } from "@/lib/trips-store";
import type { PackingCategory } from "@/lib/trips-store";

export interface PackingTemplate {
  id: string;
  vehicle: VehicleType;
  emoji: string;
  label: string;
  items: { label: string; category: PackingCategory }[];
}

export const PACKING_TEMPLATES: PackingTemplate[] = [
  {
    id: "tpl-motorcycle",
    vehicle: "motorcycle",
    emoji: "🏍️",
    label: "Motorsykkeltur",
    items: [
      { label: "Hjelm", category: "utstyr" },
      { label: "Hansker", category: "utstyr" },
      { label: "Regntøy", category: "klær" },
      { label: "Mc-jakke med protektorer", category: "klær" },
      { label: "Mc-bukser", category: "klær" },
      { label: "Mc-støvler", category: "klær" },
      { label: "Verktøysett", category: "utstyr" },
      { label: "Reservepære og sikringer", category: "utstyr" },
      { label: "Lappesaker / dekkreparasjon", category: "utstyr" },
      { label: "Førerkort og vognkort", category: "dokumenter" },
      { label: "Forsikringsbevis", category: "dokumenter" },
      { label: "Drikkeflaske", category: "mat" },
      { label: "Energibarer", category: "mat" },
      { label: "Solbriller", category: "annet" },
      { label: "Powerbank", category: "annet" },
    ],
  },
  {
    id: "tpl-car",
    vehicle: "car",
    emoji: "🚗",
    label: "Biltur",
    items: [
      { label: "Førerkort og vognkort", category: "dokumenter" },
      { label: "Forsikringsbevis", category: "dokumenter" },
      { label: "Førstehjelpsskrin", category: "utstyr" },
      { label: "Refleksvest", category: "utstyr" },
      { label: "Varseltrekant", category: "utstyr" },
      { label: "Startkabler", category: "utstyr" },
      { label: "Skrape og kost", category: "utstyr" },
      { label: "Telefonlader", category: "utstyr" },
      { label: "Drikke og snacks", category: "mat" },
      { label: "Termos med kaffe", category: "mat" },
      { label: "Solbriller", category: "klær" },
      { label: "Skiftekasse / kontanter til bom", category: "annet" },
      { label: "Offline kart", category: "annet" },
    ],
  },
  {
    id: "tpl-rv",
    vehicle: "rv",
    emoji: "🚐",
    label: "Bobil",
    items: [
      { label: "Strømkabel og adaptere", category: "utstyr" },
      { label: "Vannslange", category: "utstyr" },
      { label: "Avløpsslange", category: "utstyr" },
      { label: "Kileklosser", category: "utstyr" },
      { label: "Gassflaske (full)", category: "utstyr" },
      { label: "Stekepanne og kasseroller", category: "utstyr" },
      { label: "Bestikk og tallerkener", category: "utstyr" },
      { label: "Campingstoler", category: "utstyr" },
      { label: "Sengetøy og dyner", category: "klær" },
      { label: "Håndklær", category: "klær" },
      { label: "Toalettpapir for kassett", category: "annet" },
      { label: "Grunnleggende matvarer", category: "mat" },
      { label: "Krydder og olje", category: "mat" },
      { label: "Førerkort og vognkort", category: "dokumenter" },
      { label: "Bobilforsikring", category: "dokumenter" },
    ],
  },
];

export function templateForVehicle(v: VehicleType): PackingTemplate | undefined {
  return PACKING_TEMPLATES.find((t) => t.vehicle === v);
}

export const PACKING_CATEGORIES: { value: PackingCategory; label: string; emoji: string }[] = [
  { value: "klær", label: "Klær", emoji: "👕" },
  { value: "utstyr", label: "Utstyr", emoji: "🧰" },
  { value: "dokumenter", label: "Dokumenter", emoji: "📄" },
  { value: "mat", label: "Mat & drikke", emoji: "🥪" },
  { value: "annet", label: "Annet", emoji: "✨" },
];

export function categoryMeta(c?: PackingCategory) {
  return PACKING_CATEGORIES.find((x) => x.value === c) ?? PACKING_CATEGORIES[4];
}
