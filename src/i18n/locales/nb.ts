// Veiglede landing page copy — Norwegian Bokmål (default for veiglede.no)
// Keep keys in sync with en.ts and de.ts.

export const nb = {
  meta: {
    title: "Veiglede — AI-drevet roadtrip-planlegger for Norge",
    description:
      "Planlegg den gode turen gjennom Norge — sceniske ruter, minneverdige stopp og roadbook tilpasset deg, kjøretøyet ditt og turfølget.",
    ogTitle: "Veiglede — Finn veien som betyr noe",
    ogDescription:
      "AI-drevet roadtrip-planlegger for Norge. Ruter, stopp, roadbook og fellestur — alt på ett sted.",
  },
  nav: {
    login: "Logg inn",
    startTrip: "Start ny tur",
    myTrips: "Mine turer",
    newTrip: "Ny tur",
  },
  hero: {
    eyebrow: "AI-drevet roadtrip-planlegger",
    titleLine1: "Finn veien",
    titleLine2Prefix: "som ",
    titleAccent: "betyr noe",
    body: "Planlegg den gode turen med ruter, stopp og roadbooks tilpasset kjøretøyet ditt, kjørestilen din og hvem du skal reise med.",
    ctaPrimary: "Start ny tur",
    ctaSecondary: "Utforsk ruter",
    note: "Gratis å teste. Lag konto når du vil lagre, dele eller fortsette senere.",
    panel: {
      label: "Din neste tur",
      vehicle: { k: "Kjøretøy", v: "Motorsykkel / Bil / Bobil" },
      style: { k: "Kjørestil", v: "Svingete vei / Fototur / Rolig cruise" },
      stops: { k: "Stopp", v: "Utsikt, mat, drivstoff, lokale tips" },
      share: { k: "Deling", v: "Roadbook-lenke og fellestur" },
      distance: "12 km",
    },
  },
  features: [
    { title: "Sceniske ruter", body: "Opplev mer av Norge\npå veien." },
    { title: "Minneverdige stopp", body: "Utsikt, mat, drivstoff\nog lokale perler." },
    { title: "AI-forslag", body: "Smarte forslag basert på\ndine preferanser." },
    { title: "Roadbook", body: "Oversiktlig guide du kan\nfølge og dele." },
    { title: "Planlegg sammen", body: "Lag fellestur og hold alle\npå samme plan." },
  ],
  what: {
    eyebrow: "Hva er Veiglede?",
    cards: [
      { title: "For deg selv", body: "Personlig rute og stopp som passer hvordan du liker å kjøre." },
      { title: "For turfølget", body: "Del turen med venner og la alle følge samme plan." },
      { title: "For opplevelsen", body: "Oppdag utsiktspunkt, matstopp, lokale tips og omveier som er verdt det." },
    ],
  },
  how: {
    eyebrow: "Slik fungerer det",
    title: "Planlegg reisen din i noen få enkle steg",
    steps: [
      { title: "Velg kjøretøy og kjørestil", body: "Fortell oss hva du kjører og hvordan du liker å kjøre." },
      { title: "Få rute og stoppforslag", body: "AI-en vår lager en rute med sceniske veier og gode stopp." },
      { title: "Åpne roadbook og del turen", body: "Følg roadbooken, naviger trygt og del med turfølget." },
    ],
  },
  together: {
    title: "Planlegg sammen",
    body: "Lag en felles tur, del roadbooken med venner og la reisefølget følge samme plan — perfekt for motorsykkelturer, helgeturer og roadtrips med flere.",
    mini: [
      { title: "Delbar roadbook", body: "Del én lenke — alle har samme plan." },
      { title: "Inviter reisefølge", body: "Inviter venner på turen med én invitasjon." },
      { title: "Live-deling kommer senere", body: "Følg posisjon og få oppdateringer underveis." },
    ],
  },
  routes: {
    title: "Start med en kjent rute — gjør den til din egen",
    days: (n: number) => (n === 1 ? "1 dag" : `${n} dager`),
    styles: {
      svingete: "Svingete vei",
      fototur: "Fototur",
      cruise: "Rolig cruise",
    },
  },
  cta: {
    title1: "Planlegg første tur ",
    titleAccent: "gratis",
    title2: " — ingen konto nødvendig.",
    body: "Test Veiglede direkte i nettleseren. Lag konto når du vil lagre turer, synkronisere mellom enheter eller dele roadbooken din.",
    primary: "Start ny tur",
    secondary: "Logg inn",
  },
  footer: {
    myTrips: "Mine turer",
    newTrip: "Ny tur",
    login: "Logg inn",
  },
  language: {
    label: "Språk",
    nb: "Norsk",
    en: "English",
    de: "Deutsch",
  },
} as const;

export type Dict = typeof nb;
